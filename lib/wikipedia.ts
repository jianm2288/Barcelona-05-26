"use client";

export type PlacePhoto = {
  url: string;
  caption: string;
};

type SrcsetEntry = { src?: string; scale?: string };
type MediaItem = {
  type?: string;
  showInGallery?: boolean;
  title?: string;
  caption?: { text?: string };
  srcset?: SrcsetEntry[];
};

const cache = new Map<string, Promise<PlacePhoto[]>>();

async function searchTitle(query: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/rest.php/v1/search/title?q=${encodeURIComponent(query)}&limit=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const body = (await res.json()) as { pages?: Array<{ key?: string }> };
    return body.pages?.[0]?.key ?? null;
  } catch {
    return null;
  }
}

function pickHighestRes(srcset: SrcsetEntry[]): string | null {
  let best: SrcsetEntry | null = null;
  let bestScale = -1;
  for (const entry of srcset) {
    if (!entry.src) continue;
    const scale = parseFloat(entry.scale ?? "1");
    if (scale > bestScale) {
      bestScale = scale;
      best = entry;
    }
  }
  if (!best?.src) return null;
  return best.src.startsWith("http") ? best.src : `https:${best.src}`;
}

// Wikipedia pages mix in logos, coats of arms, locator maps, and signatures
// alongside real photos. `showInGallery` catches some, but logos slip through.
// Title/URL pattern matching catches the rest.
const NON_PHOTO_TITLE = /logo|coat[_ ]of[_ ]arms|signature|locator|location[_ ]map|seal\b|emblem/i;

function isLikelyPhoto(title: string | undefined, src: string): boolean {
  // SVGs on Wikipedia are almost always vector graphics — logos, flags,
  // diagrams — not photos of the place.
  if (/\.svgg?($|\/|\?)/i.test(src)) return false;
  if (title && /\.svg($|\?)/i.test(title)) return false;
  if (title && NON_PHOTO_TITLE.test(title)) return false;
  return true;
}

async function fetchMediaList(key: string): Promise<PlacePhoto[]> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(key)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const body = (await res.json()) as { items?: MediaItem[] };
    const items = body.items ?? [];
    const photos: PlacePhoto[] = [];
    for (const it of items) {
      if (it.type !== "image") continue;
      if (it.showInGallery === false) continue;
      if (!it.srcset || it.srcset.length === 0) continue;
      const src = pickHighestRes(it.srcset);
      if (!src) continue;
      if (!isLikelyPhoto(it.title, src)) continue;
      const caption =
        it.caption?.text?.trim() ||
        (it.title ? it.title.replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, "") : "");
      photos.push({ url: src, caption });
      if (photos.length >= 8) break;
    }
    return photos;
  } catch {
    return [];
  }
}

async function fetchPlacePhotos(name: string, region: string): Promise<PlacePhoto[]> {
  // Prefer bare name — Wikipedia's relevance ranking surfaces the canonical
  // landmark above same-named metro stations / streets. Fall back to a
  // region-qualified query only when the bare name misses entirely.
  let key = await searchTitle(name);
  if (!key) key = await searchTitle(`${name} ${region}`);
  if (!key) return [];
  return fetchMediaList(key);
}

export function loadPlacePhotos(name: string, region: string): Promise<PlacePhoto[]> {
  const cacheKey = `${name}|${region}`;
  if (!cache.has(cacheKey)) cache.set(cacheKey, fetchPlacePhotos(name, region));
  return cache.get(cacheKey)!;
}
