"""Extract trip data from the legacy generated HTML into JSON for the Next.js app.

This is a one-shot bridge while migrating to the Next.js stack. It reads the
generator-produced `pages/*.html` files and emits structured JSON under
`lib/data/`. Once the source-of-truth shifts to the new Next.js build pipeline,
the Python generator can be repointed at JSON directly instead of HTML.
"""

from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def text_inside(html: str) -> str:
    """Strip tags but preserve inline link anchors as markdown-ish [text](url)."""

    out: list[str] = []

    class Stripper(HTMLParser):
        def __init__(self) -> None:
            super().__init__()
            self.skip_depth = 0
            self.current_link: list[str] | None = None
            self.current_text: list[str] = []

        def handle_starttag(self, tag, attrs):  # type: ignore[override]
            if tag == "a":
                href = next((v for k, v in attrs if k == "href" and v), None)
                target_attr = next(
                    (v for k, v in attrs if k == "data-destination-target" and v),
                    None,
                )
                if target_attr:
                    self.current_link = [f"#destination-{target_attr.split('destination-')[-1]}"]
                elif href:
                    self.current_link = [href]
                else:
                    self.current_link = [""]
                self.current_text = []

        def handle_endtag(self, tag):  # type: ignore[override]
            if tag == "a" and self.current_link is not None:
                link_text = "".join(self.current_text).strip()
                href = self.current_link[0]
                if link_text and href:
                    out.append(f"[{link_text}]({href})")
                elif link_text:
                    out.append(link_text)
                self.current_link = None
                self.current_text = []

        def handle_data(self, data):  # type: ignore[override]
            if self.current_link is not None:
                self.current_text.append(data)
            else:
                out.append(data)

    parser = Stripper()
    parser.feed(html)
    return re.sub(r"\s+", " ", "".join(out)).strip()


def section_block(html: str, marker_id: str) -> str:
    """Return the substring of a section tagged with id=marker_id."""
    pattern = re.compile(
        rf'<section[^>]*id="{re.escape(marker_id)}"[^>]*>(.*?)</section>',
        re.DOTALL,
    )
    m = pattern.search(html)
    if not m:
        raise ValueError(f"section id={marker_id} not found")
    return m.group(1)


def parse_destinations(html: str) -> list[dict]:
    block = section_block(html, "destinations")
    items: list[dict] = []
    for art in re.finditer(
        r'<article class="destination-card"[^>]*id="([^"]+)"[^>]*>(.*?)</article>',
        block,
        re.DOTALL,
    ):
        item_id, body = art.group(1), art.group(2)
        tag = re.search(r'<span class="tag">([^<]+)</span>', body)
        name = re.search(r"<h3>(.*?)</h3>", body, re.DOTALL)
        summary = re.search(r"<p>(.*?)</p>", body, re.DOTALL)
        link = re.search(
            r'<a class="destination-link" href="([^"]+)"', body
        )
        if not (tag and name and summary):
            continue
        items.append(
            {
                "id": item_id,
                "region": tag.group(1).strip(),
                "name": text_inside(name.group(1)),
                "summary": text_inside(summary.group(1)),
                "link": link.group(1).replace("&amp;", "&") if link else None,
            }
        )
    return items


def parse_days(html: str) -> list[dict]:
    block = section_block(html, "days")
    days: list[dict] = []
    tab_pattern = re.compile(
        r'<a class="day-tab[^"]*"[^>]*data-day="(day\d+)"[^>]*>\s*'
        r'<span class="day-tab-date">([^<]+)</span>\s*'
        r'<span class="day-tab-title">([^<]+)</span>',
        re.DOTALL,
    )
    tabs = {m.group(1): {"shortDate": m.group(2).strip(), "title": m.group(3).strip()} for m in tab_pattern.finditer(block)}

    panels_block_match = re.search(
        r'<div class="day-panels">(.*?)</div>\s*</div>\s*</section>', block + "</section>", re.DOTALL
    )
    panels_block = panels_block_match.group(1) if panels_block_match else block
    panel_chunks = re.split(
        r'(?=<article class="day-panel)', panels_block
    )
    for chunk in panel_chunks:
        if 'class="day-panel' not in chunk:
            continue
        header_match = re.match(
            r'<article class="day-panel[^"]*"[^>]*id="(day\d+)"[^>]*>(.*)$',
            chunk,
            re.DOTALL,
        )
        if not header_match:
            continue
        day_id = header_match.group(1)
        rest = header_match.group(2)
        # body is everything up to (and including) the matching closing </article>
        depth = 1
        i = 0
        while i < len(rest) and depth > 0:
            next_open = rest.find("<article", i)
            next_close = rest.find("</article>", i)
            if next_close == -1:
                break
            if next_open != -1 and next_open < next_close:
                depth += 1
                i = next_open + len("<article")
            else:
                depth -= 1
                if depth == 0:
                    body = rest[:next_close]
                    break
                i = next_close + len("</article>")
        else:
            body = rest
        date = re.search(r'<p class="eyebrow">([^<]+)</p>', body)
        heading = re.search(r"<h3>(.*?)</h3>", body, re.DOTALL)
        pill = re.search(r'<span class="route-pill">([^<]+)</span>', body)
        summary = re.search(
            r'<p class="day-summary">(.*?)</p>', body, re.DOTALL
        )
        # day-level route links
        route_block = re.search(
            r'<div class="route-links day-route-links">(.*?)</div>', body, re.DOTALL
        )
        day_routes = []
        if route_block:
            for r in re.finditer(
                r'<a class="route-link" href="([^"]+)"[^>]*>([^<]+)</a>',
                route_block.group(1),
            ):
                day_routes.append(
                    {
                        "label": r.group(2).strip(),
                        "url": r.group(1).replace("&amp;", "&"),
                    }
                )
        # timeline
        timeline_items: list[dict] = []
        for ti in re.finditer(
            r'<article class="timeline-item">(.*?)</article>',
            body,
            re.DOTALL,
        ):
            ti_body = ti.group(1)
            ti_title = re.search(r"<h4>(.*?)</h4>", ti_body, re.DOTALL)
            ti_paras = re.findall(r"<p(?:\s+[^>]*)?>(.*?)</p>", ti_body, re.DOTALL)
            ti_meta = re.search(r'<p class="meta">(.*?)</p>', ti_body, re.DOTALL)
            ti_routes_block = re.search(
                r'<div class="route-links">(.*?)</div>', ti_body, re.DOTALL
            )
            ti_routes = []
            if ti_routes_block:
                for r in re.finditer(
                    r'<a class="route-link" href="([^"]+)"[^>]*>([^<]+)</a>',
                    ti_routes_block.group(1),
                ):
                    ti_routes.append(
                        {
                            "label": r.group(2).strip(),
                            "url": r.group(1).replace("&amp;", "&"),
                        }
                    )

            paragraphs = [
                text_inside(p)
                for p in ti_paras
                if 'class="meta"' not in p
            ]
            timeline_items.append(
                {
                    "title": text_inside(ti_title.group(1)) if ti_title else "",
                    "body": " ".join(paragraphs).strip(),
                    "meta": text_inside(ti_meta.group(1)) if ti_meta else None,
                    "routes": ti_routes,
                }
            )

        tab = tabs.get(day_id, {})
        days.append(
            {
                "id": day_id,
                "shortDate": tab.get("shortDate", ""),
                "title": tab.get("title", ""),
                "date": text_inside(date.group(1)) if date else "",
                "heading": text_inside(heading.group(1)) if heading else "",
                "pill": text_inside(pill.group(1)) if pill else None,
                "summary": text_inside(summary.group(1)) if summary else "",
                "routes": day_routes,
                "timeline": timeline_items,
            }
        )
    return days


def parse_hero(html: str) -> dict:
    eyebrow = re.search(r'<p class="eyebrow">([^<]+)</p>', html)
    h1 = re.search(r"<header[^>]*>.*?<h1>(.*?)</h1>", html, re.DOTALL)
    intro = re.search(r'<p class="hero-text">(.*?)</p>', html, re.DOTALL)
    snapshot = re.search(
        r'<ul class="snapshot-list">(.*?)</ul>', html, re.DOTALL
    )
    snapshot_items: list[str] = []
    if snapshot:
        snapshot_items = [
            text_inside(li)
            for li in re.findall(r"<li>(.*?)</li>", snapshot.group(1), re.DOTALL)
        ]
    # title from <title>
    title = re.search(r"<title>(.*?)</title>", html, re.DOTALL)
    return {
        "title": text_inside(title.group(1)) if title else "",
        "eyebrow": text_inside(eyebrow.group(1)) if eyebrow else "",
        "heading": text_inside(h1.group(1)) if h1 else "",
        "intro": text_inside(intro.group(1)) if intro else "",
        "snapshot": snapshot_items,
    }


def parse_overview(html: str) -> list[dict]:
    block = section_block(html, "overview")
    cards: list[dict] = []
    for art in re.finditer(
        r'<article class="card(?:\s+accent)?"[^>]*>(.*?)</article>',
        block,
        re.DOTALL,
    ):
        body = art.group(1)
        h2 = re.search(r"<h2>(.*?)</h2>", body, re.DOTALL)
        p = re.search(r"<p>(.*?)</p>", body, re.DOTALL)
        if not (h2 and p):
            continue
        cards.append(
            {
                "heading": text_inside(h2.group(1)),
                "body": text_inside(p.group(1)),
            }
        )
    return cards


def extract_page(html_path: Path, slug: str) -> dict:
    html = html_path.read_text(encoding="utf-8")
    return {
        "slug": slug,
        "hero": parse_hero(html),
        "overview": parse_overview(html),
        "destinations": parse_destinations(html),
        "days": parse_days(html),
    }


def main() -> int:
    raw_manifest = json.loads((ROOT / "site_manifest.json").read_text())
    manifest = raw_manifest.get("itineraries", raw_manifest) if isinstance(raw_manifest, dict) else raw_manifest
    out_dir = ROOT / "lib" / "data"
    out_dir.mkdir(parents=True, exist_ok=True)

    trips: list[dict] = []
    for entry in manifest:
        slug = entry["slug"]
        html_path = ROOT / "pages" / f"{slug}.html"
        if not html_path.exists():
            print(f"skip: {html_path} missing", file=sys.stderr)
            continue
        trip = extract_page(html_path, slug)
        trip["source"] = entry.get("source")
        trip["summary"] = entry.get("summary", "")
        trips.append(trip)
        (out_dir / f"{slug}.json").write_text(
            json.dumps(trip, indent=2, ensure_ascii=False)
        )
        print(f"wrote lib/data/{slug}.json")
    (out_dir / "index.json").write_text(
        json.dumps(
            [
                {
                    "slug": t["slug"],
                    "title": t["hero"]["title"],
                    "eyebrow": t["hero"]["eyebrow"],
                    "heading": t["hero"]["heading"],
                    "intro": t["hero"]["intro"],
                    "snapshot": t["hero"]["snapshot"],
                    "source": t.get("source"),
                    "summary": t.get("summary", ""),
                }
                for t in trips
            ],
            indent=2,
            ensure_ascii=False,
        )
    )
    print("wrote lib/data/index.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
