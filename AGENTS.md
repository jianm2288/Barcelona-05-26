# AGENTS.md

## Purpose

This repository generates static trip-planner pages from itinerary source files.

The agent's job is to preserve one shared trip-planner product while itinerary content changes over time. The content can change freely. The product shell, interaction model, mobile behavior, and performance characteristics must remain intentionally stable unless a shared improvement is being made.

## Source Of Truth

- Treat files under `raw/` as the only canonical publishing inputs.
- Do not treat `archive/` as a live source directory.
- Expect the set of files in `raw/` to change over time.
- Expect the number of itineraries to grow, shrink, or be replaced.
- Do not hardcode logic that only works for a single filename unless it is part of an explicitly scoped parser path and still fits within the multi-itinerary generator model.

## Current Repo Model

The repository currently behaves as follows:

- `scripts/generate_site.py`
  The shared generator and the primary place for parsing, mapping, and rendering logic.
- `site_manifest.json`
  Stable source-to-slug mapping.
- `index.html`
  Generated landing page.
- `pages/`
  Generated itinerary pages.
- `styles.css`
  Shared visual system for every page.
- `script.js`
  Shared interaction layer for day tabs, destination highlighting, and route-link handling.
- `archive/`
  Historical raw files, seed pages, and references. Useful context, but not a live publish input directory.

## Non-Negotiable Product Invariants

When content changes, all of the following must remain stable unless there is an intentional shared product update:

- same overall information architecture
- same page section order
- same day-navigation model
- same destination-card treatment
- same route-link treatment
- same mobile interaction model
- same accessibility baseline
- same static-site performance posture

Do not let display style, behavior, or perceived performance drift because:

- a new itinerary is added
- an old itinerary is removed
- one itinerary is more detailed than another
- a source document is reformatted
- a parser branch is updated for one trip

## Required Rendering Behavior

Every published itinerary page must include:

- a trip hero area
- a trip snapshot
- overview cards
- an overall destination section
- a day-by-day route browser
- clickable destination links where available or clearly inferable
- clickable route or map links at the day level and stop level where available or inferable

The landing page must:

- list every itinerary generated from `raw/`
- link to every generated itinerary page
- not list archived-only inputs as live pages

## Multi-Itinerary Rules

- Scan all supported files in `raw/` before making generation changes.
- Generate exactly one current webpage per canonical source file in `raw/`.
- Use `site_manifest.json` to preserve stable slugs.
- Update an existing itinerary page in place when its source stays mapped to the same slug.
- Never overwrite one itinerary with another because of a hardcoded filename assumption.
- If a fix improves shared layout or interaction, implement it in shared code so all current and future itineraries inherit it.

## Shared-Code Rule

If the change affects any of the following, implement it in shared code instead of patching a single generated page:

- parsing rules
- HTML structure
- route-link generation
- mobile interaction
- desktop interaction
- styling
- accessibility behavior

The correct places for shared changes are:

- `scripts/generate_site.py`
- `styles.css`
- `script.js`

Do not hand-maintain generated page behavior as a one-off fix unless the repo is explicitly being restructured away from generation.

## Content Extraction Rules

When converting a source itinerary into a page:

- preserve overall trip summary when available
- preserve destination coverage
- preserve chronological daily order
- preserve or infer route order within each day
- preserve embedded links from `.docx` when possible
- keep route links attached to the relevant day or stop
- keep important logistics, timing anchors, and transfers
- summarize prose only enough to fit the shared web format without losing key planning detail

## Performance And Drift Rules

The planner should remain a lightweight static site:

- keep shared JS small and focused
- avoid page-specific JS forks
- avoid introducing heavy client-side frameworks for content browsing
- avoid duplicating large CSS or script blocks into individual itinerary pages
- keep behavior fixes centralized so future regeneration does not regress older fixes

When raw materials change, verify that:

- existing tap and click behavior still works
- day navigation still opens the correct day panel
- route links still open correctly on both desktop and mobile
- location disambiguation still points to the intended city or country
- generated pages remain fast and static

## Archive Rules

- `archive/` is reference material, not the live planner input.
- Archived raw files may inform parser development or historical comparison.
- Archived seed pages may be used as reference, but not as a substitute for maintaining the shared generator.
- Do not accidentally re-publish archived inputs unless they are intentionally moved or remapped into the live source flow.

## Quality Bar

Before finishing work, verify:

- every supported file in `raw/` has one generated page
- `index.html` reflects the current `raw/` set
- all itinerary pages still share the same shell and interaction model
- destination links are clickable
- route or map links are clickable
- mobile interaction still works
- shared CSS and JS still support all pages
- no behavior fix exists only in one generated page

## Implementation Guidance

- Prefer reusable parser and renderer paths over manual HTML editing.
- Preserve embedded hyperlinks from `.docx` when possible.
- Keep source-to-slug mapping stable with `site_manifest.json`.
- Fix text corruption introduced during extraction.
- If itinerary-specific parsing is needed, keep it inside the generator while preserving the shared rendering contract.
- Treat generated pages as outputs of the system, not primary authored source.
