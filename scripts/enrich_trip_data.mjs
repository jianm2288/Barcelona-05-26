#!/usr/bin/env node
// Enriches each trip JSON in lib/data/ with:
//   - lat/lng on every destination (Mapbox Geocoding, or bundled seed)
//   - stops[] on every day (derived from markdown links in timeline bodies)
//   - routePolyline on every day (Mapbox Directions, or straight-line fallback)
//
// Usage:
//   MAPBOX_TOKEN=pk.xxx node scripts/enrich_trip_data.mjs
//   node scripts/enrich_trip_data.mjs --refresh        # force re-fetch
//   node scripts/enrich_trip_data.mjs --seed-only      # never call Mapbox API
//
// Caches Directions responses in scripts/.directions-cache.json so reruns
// don't re-spend quota. Geocode results live alongside the destination in
// the trip JSON; if name or region changes, that destination is re-geocoded.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "lib", "data");
const SEED_PATH = path.join(__dirname, "destination_coords_seed.json");
const CACHE_PATH = path.join(__dirname, ".directions-cache.json");
const STAMP_PATH = path.join(__dirname, ".geocode-stamps.json");

const args = new Set(process.argv.slice(2));
const REFRESH = args.has("--refresh");
const SEED_ONLY = args.has("--seed-only");
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN || "";
const USE_API = !SEED_ONLY && Boolean(MAPBOX_TOKEN);
const WALK_THRESHOLD_KM = 5;

async function readJSON(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJSON(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(sa));
}

async function geocode(name, region, seed, id) {
  const seeded = seed[id];
  if (seeded) return seeded;
  if (!USE_API) {
    console.warn(`  ! no seed and no MAPBOX_TOKEN — skipping ${id}`);
    return null;
  }
  const query = encodeURIComponent(`${name}, ${region}`);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?limit=1&access_token=${MAPBOX_TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  ! geocode failed for ${id}: ${res.status}`);
    return null;
  }
  const body = await res.json();
  const feat = body.features?.[0];
  if (!feat?.center) return null;
  return feat.center;
}

async function directions(origin, dest, mode, cache) {
  const key = `${origin.join(",")}|${dest.join(",")}|${mode}`;
  if (!REFRESH && cache[key]) return cache[key];
  if (!USE_API) {
    const line = [origin, dest];
    cache[key] = line;
    return line;
  }
  const profile = mode === "walking" ? "walking" : "driving";
  const coords = `${origin.join(",")};${dest.join(",")}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  ! directions failed (${res.status}) — using straight line`);
    cache[key] = [origin, dest];
    return cache[key];
  }
  const body = await res.json();
  const line = body.routes?.[0]?.geometry?.coordinates ?? [origin, dest];
  cache[key] = line;
  return line;
}

function parseStops(timeline) {
  // Pull every [name](#destination-id) link in body order, dedupe preserving
  // first occurrence — pin order follows when the author first mentioned it.
  const linkRe = /\[[^\]]+\]\(#(destination-[a-z0-9-]+)\)/g;
  const seen = new Set();
  const order = [];
  for (const item of timeline) {
    let m;
    const body = item.body || "";
    while ((m = linkRe.exec(body))) {
      const id = m[1];
      if (!seen.has(id)) {
        seen.add(id);
        order.push(id);
      }
    }
  }
  return order;
}

async function enrichTrip(filePath, seed, cache) {
  const trip = await readJSON(filePath, null);
  if (!trip) {
    console.warn(`skip ${filePath}: unreadable`);
    return;
  }
  const stamps = await readJSON(STAMP_PATH, {});
  const tripStamps = stamps[trip.slug] || {};

  console.log(`\n${trip.slug}`);

  // 1) geocode destinations
  const byId = new Map();
  for (const dest of trip.destinations) {
    const stamp = `${dest.name}|${dest.region}`;
    const stale = tripStamps[dest.id] !== stamp;
    const missing =
      typeof dest.lat !== "number" || typeof dest.lng !== "number";
    if (REFRESH || stale || missing) {
      const coords = await geocode(dest.name, dest.region, seed, dest.id);
      if (coords) {
        dest.lng = +coords[0].toFixed(6);
        dest.lat = +coords[1].toFixed(6);
        tripStamps[dest.id] = stamp;
        console.log(`  geo ${dest.id} → ${dest.lng}, ${dest.lat}`);
      }
    }
    byId.set(dest.id, dest);
  }
  stamps[trip.slug] = tripStamps;
  await writeJSON(STAMP_PATH, stamps);

  // 2 + 3 + 4) derive stops + polyline for each day
  for (const day of trip.days) {
    const ids = parseStops(day.timeline || []);
    const usable = ids.filter((id) => {
      const d = byId.get(id);
      return d && typeof d.lat === "number" && typeof d.lng === "number";
    });

    const stops = [];
    const segments = [];
    for (let i = 0; i < usable.length; i++) {
      const id = usable[i];
      const dest = byId.get(id);
      const here = [dest.lng, dest.lat];
      let mode = "walking";
      if (i > 0) {
        const prev = byId.get(usable[i - 1]);
        const km = haversineKm([prev.lng, prev.lat], here);
        mode = km < WALK_THRESHOLD_KM ? "walking" : "driving";
        const seg = await directions(
          [prev.lng, prev.lat],
          here,
          mode,
          cache,
        );
        segments.push(seg);
      }
      stops.push({ destinationId: id, order: i + 1, mode });
    }

    const coords = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (i === 0) coords.push(...seg);
      else coords.push(...seg.slice(1));
    }
    if (coords.length === 0 && usable.length === 1) {
      const only = byId.get(usable[0]);
      coords.push([only.lng, only.lat]);
    }

    day.stops = stops;
    day.routePolyline = { type: "LineString", coordinates: coords };
    console.log(`  ${day.id} — ${stops.length} stops, ${coords.length} coords`);
  }

  await writeJSON(filePath, trip);
  await writeJSON(CACHE_PATH, cache);
}

async function main() {
  console.log(
    USE_API ? "Using Mapbox API" : "Seed-only mode (no Mapbox calls)",
  );
  const seed = await readJSON(SEED_PATH, {});
  const cache = await readJSON(CACHE_PATH, {});
  const entries = await fs.readdir(DATA_DIR);
  for (const name of entries) {
    if (!name.endsWith(".json")) continue;
    if (name === "index.json") continue;
    await enrichTrip(path.join(DATA_DIR, name), seed, cache);
  }
  console.log("\ndone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
