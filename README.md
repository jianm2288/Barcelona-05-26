# Trip Planner

Mobile-first single-trip map viewer. Liquid-glass day chips at the top, a draggable bottom sheet, and a Mapbox map with day-scoped numbered pins and a drawn route between them.

## Stack

- **Next.js 14** (App Router) — the runtime trip viewer.
- **mapbox-gl** — map rendering, route line, pin markers.
- **Tailwind CSS** — visual tokens (`tailwind.config.ts`) and liquid-glass utilities (`app/globals.css`).
- **TypeScript** end-to-end.

## Develop

```bash
npm install
echo "NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_public_token_here" > .env.local
npm run dev   # http://localhost:3000
```

Without `NEXT_PUBLIC_MAPBOX_TOKEN`, the canvas shows a setup hint instead of the map. Create a free Mapbox account and grab a public token from your account dashboard. You can scope the token to specific URLs/styles before deploying.

## Data enrichment

`scripts/enrich_trip_data.mjs` is the build-time pass that turns the editable trip JSON into something the map can render. For each trip file under `lib/data/`:

1. Geocodes every destination (Mapbox Geocoding API) and writes `lat`/`lng` back onto each destination.
2. Parses the `[name](#destination-id)` links in each day's `timeline[].body` to derive an ordered `stops[]` with walking/driving mode per inbound segment (threshold: 5 km straight-line).
3. Calls the Mapbox Directions API for each stop pair and stitches the segments into a single `Day.routePolyline` `LineString`.

Run with a server-side token (this token can be different from the browser token):

```bash
MAPBOX_TOKEN=pk.xxx npm run enrich-data
MAPBOX_TOKEN=pk.xxx npm run enrich-data -- --refresh   # force re-geocode + re-fetch
npm run enrich-data -- --seed-only                     # bundled coords, straight-line polylines
```

Directions responses are cached in `scripts/.directions-cache.json` and committed so CI re-runs don't burn quota. Geocode staleness is tracked in `scripts/.geocode-stamps.json` (gitignored); editing a destination's name or region invalidates that entry on the next run.

`scripts/destination_coords_seed.json` holds known coordinates for the bundled Spain trip, so the app works out of the box even before anyone has set a `MAPBOX_TOKEN`.

## Layout

- `app/page.tsx` — single root page that hands the trip JSON to a client `<TripView>`.
- `components/TripView.tsx` — top-level state machine: active day, selected stop, sheet open/closed.
- `components/MapCanvas.tsx` — Mapbox map, route layer, numbered pin markers, geolocation dot.
- `components/DayStrip.tsx` — top liquid-glass day chips (only visible when the sheet is dismissed).
- `components/TripSheet.tsx` — bottom liquid-glass sheet with drag-to-dismiss + prev/next arrows.
- `components/DayOverview.tsx` / `components/StopDetail.tsx` — the two sheet modes.
- `lib/hooks/useToday.ts` — picks the day matching today's date, or day 1 if outside the trip range.
- `lib/hooks/useGeolocation.ts` — wraps `navigator.geolocation.watchPosition`.
- `lib/mapbox/poi.ts` — client-side POI enrichment (Mapbox Search Box reverse).
- `lib/types.ts` — Trip / Day / Destination / DayStop / LineString types.

## Adding a trip

1. Drop the source file in `raw/`.
2. Map it to a slug in `site_manifest.json`.
3. Produce `lib/data/<slug>.json` matching `lib/types.ts` (coordinates can be empty; the enrich pass fills them).
4. Register it in `lib/trips.ts` (the current build assumes a single trip; widen this when you add a second one).
5. `MAPBOX_TOKEN=pk.xxx npm run enrich-data && npm run build`.

## Deploy

The app is a runtime Next.js application — it needs the browser token (`NEXT_PUBLIC_MAPBOX_TOKEN`) baked in at build time. GitHub Pages works if you store the token as a repository secret and inject it in `.github/workflows/deploy-pages.yml` before running `npm run build`.
