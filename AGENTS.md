# AGENTS.md

## Purpose

This project turns itinerary source files in `raw/` into polished, browsable webpages.

The agent's job is not to maintain only one trip page. It must support multiple itinerary source files, generate one webpage per itinerary, and keep all generated pages aligned to the same content and interaction requirements.

## Source Of Truth

- Treat files under `raw/` as the canonical itinerary inputs.
- Expect more than one source file over time.
- Do not hardcode logic for a single file such as `raw/5dayItineary.docx`.
- Preserve useful structure from the source documents, especially:
  - overall trip summary and destination coverage
  - per-day breakdowns
  - destination hyperlinks
  - daily navigation or map-route hyperlinks

## Core Requirements For Every Webpage

Every itinerary webpage must include all of the following:

- An overview of the trip's overall destinations.
- Clickable links for destinations whenever the source provides them or they can be clearly carried over from the itinerary.
- A day-by-day route presentation.
- Clickable map/navigation links for each daily route segment whenever the source provides them.
- A consistent information architecture across all itinerary pages so users can move between trips without relearning the UI.

## Multi-Itinerary Behavior

The agent must support multiple source itineraries and multiple output pages.

- Scan `raw/` for all supported itinerary inputs before making changes.
- Create or maintain one output webpage per itinerary source file.
- Use a stable naming convention so each source maps predictably to one webpage.
- Avoid overwriting one itinerary page with another.
- If an itinerary already has a webpage, update it in place instead of duplicating it.
- If shared layout, styling, or interaction code is improved for one itinerary, apply that improvement in the shared implementation so all itinerary pages stay consistent.

## Recommended Project Shape

Prefer this structure unless the repository evolves in a better direction:

- Shared assets:
  - `styles.css`
  - `script.js`
- Output pages:
  - one HTML file per itinerary, or
  - a dedicated pages folder if the project grows
- Raw inputs:
  - `raw/`

If multiple pages are present, add or maintain a simple index or landing page that links to each generated itinerary page.

## Content Extraction Rules

When converting an itinerary source into a webpage:

- Extract the trip title, dates, base location, and trip theme when available.
- Build a destination overview section from the complete set of noteworthy places in the itinerary.
- Build daily sections from the itinerary's chronological structure.
- Preserve the intended route order within each day.
- Carry over external links from the source document instead of replacing them with plain text.
- Keep map-route links directly attached to the relevant stop or route segment so they are easy to use.
- Summarize long prose into web-friendly copy only when needed, but do not remove important logistics.

## Consistency Rules

All itinerary pages should share the same product expectations:

- same page sections in roughly the same order
- same visual system
- same interaction model for daily browsing
- same treatment of destination cards and route links
- same accessibility baseline

Differences between pages should come from the itinerary content, not from ad hoc layout changes.

## Maintenance Rules

When new source files appear in `raw/`:

- detect them
- generate a matching webpage
- ensure shared assets still work for all pages
- update any landing or cross-linking page if one exists

When an existing source file changes:

- update only the corresponding webpage content
- keep the shared layout and behavior intact unless a shared improvement is needed

## Quality Bar

Before finishing work, verify:

- every itinerary source in `raw/` has a corresponding webpage
- every webpage includes overall destinations and daily routes
- destination links are clickable
- route or map links are clickable
- no existing itinerary page was accidentally broken while updating another one
- shared CSS/JS still supports all itinerary pages

## Implementation Guidance

- Favor reusable templates, data structures, and shared rendering patterns over one-off hardcoded HTML.
- If the input format is `.docx`, preserve embedded hyperlinks during extraction.
- Keep content encoding clean and fix obvious text corruption introduced during conversion.
- Prefer maintainable generation/update workflows over manual page-by-page edits when the number of itineraries grows.
