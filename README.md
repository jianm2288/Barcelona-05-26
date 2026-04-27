# Barcelona-05-26

Static trip-planner pages generated from itinerary source files and published with GitHub Pages.

## What this repo does

This repository turns source itineraries into a shared, browsable trip-planner experience.

The planner is designed to support:

- one canonical output page per itinerary source in `raw/`
- a shared landing page at `index.html`
- shared styling in `styles.css`
- shared interaction behavior in `script.js`
- shared generation logic in `scripts/generate_site.py`

The generator is the product surface. The HTML pages are generated outputs, not hand-maintained one-offs.

## Current structure

- `raw/`
  Active canonical itinerary inputs. Only files here should generate published pages.
- `pages/`
  Generated itinerary pages such as `pages/spain-trip-2026.html`.
- `index.html`
  Generated landing page linking every itinerary currently sourced from `raw/`.
- `styles.css`
  Shared visual system for every itinerary page and the landing page.
- `script.js`
  Shared client-side behavior for day navigation, destination highlighting, and route-link handling.
- `scripts/generate_site.py`
  The generator that scans `raw/`, maps sources to slugs, and rewrites `index.html` plus `pages/*.html`.
- `site_manifest.json`
  Stable source-to-slug mapping for generated itinerary pages.
- `archive/`
  Legacy inputs, earlier generated pages, and seed references. Files here are historical reference only and must not be treated as canonical publish inputs unless intentionally moved back into `raw/`.
- `.github/workflows/deploy-pages.yml`
  GitHub Pages deployment workflow.

## Supported source behavior

The generator currently supports itinerary source files in `raw/` with these extensions:

- `.docx`
- `.md`

It ignores temporary Word lock files such as `~$...docx`.

## Shared planner behavior

Every generated itinerary page is expected to keep the same product model:

- hero summary with trip snapshot
- overview cards
- overall destination grid
- day-by-day route browser
- route links on each day and stop when available or inferred
- the same shared CSS and JS behavior across all itineraries

The planner must not drift visually or behaviorally just because:

- a source file changes
- a new itinerary is added
- the number of itineraries grows or shrinks
- one itinerary has richer content than another

Content may change. The product shell should remain stable.

## Stability rules

When raw materials change, preserve these invariants unless the change is an intentional shared product improvement:

- Keep the same page section order across itineraries.
- Keep the same navigation model for browsing days.
- Keep the same route-link treatment and tap behavior.
- Keep the same destination-card treatment.
- Keep the same responsive behavior on desktop and mobile.
- Keep the same performance posture: static output, lightweight JS, shared assets, no page-specific script forks.
- Apply behavior fixes in shared code, not in one generated page only.

If a change is needed for one itinerary and it affects layout, navigation, route-link logic, or mobile compatibility, implement it in:

- `scripts/generate_site.py`
- `styles.css`
- `script.js`

not by hand-editing just one generated page.

## Regenerate the site

Run:

```bash
python scripts/generate_site.py
```

This refreshes:

- `index.html`
- `pages/*.html` for every supported source in `raw/`

## Publishing

Push to `main` and let GitHub Actions publish the generated static site through the configured Pages workflow.

## Maintenance expectations

When adding or updating itineraries:

1. Put active canonical sources in `raw/`.
2. Update `site_manifest.json` if you need a stable slug.
3. Regenerate with `python scripts/generate_site.py`.
4. Verify that every `raw/` source has one corresponding generated page.
5. Verify that shared behavior still works on desktop and mobile, especially:
   - day switching
   - route links
   - destination links

## Important note about archived material

`archive/` may contain older raw inputs and older page references that help with extraction logic or future migrations, but they are not the current publishing source of truth.

Only `raw/` determines what appears on the landing page and what gets regenerated as a live itinerary page.
