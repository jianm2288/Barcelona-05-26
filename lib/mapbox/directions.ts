"use client";

export type DirectionsProfile = "walking" | "driving";

export type DirectionsResult = {
  durationMin: number;
  distanceKm: number;
};

export type LatLng = {
  lng: number;
  lat: number;
};

const cache = new Map<string, Promise<DirectionsResult>>();

function getToken(): string {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
}

function keyFor(from: LatLng, to: LatLng, profile: DirectionsProfile): string {
  return (
    `${from.lng.toFixed(5)},${from.lat.toFixed(5)}|` +
    `${to.lng.toFixed(5)},${to.lat.toFixed(5)}|${profile}`
  );
}

async function fetchDirections(
  from: LatLng,
  to: LatLng,
  profile: DirectionsProfile,
  signal: AbortSignal,
): Promise<DirectionsResult> {
  const token = getToken();
  if (!token) throw new Error("missing mapbox token");

  const coords =
    `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}` +
    `?geometries=geojson&overview=simplified&access_token=${token}`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`directions status ${res.status}`);
  const body = await res.json();
  const route = body.routes?.[0];
  if (!route) throw new Error("no route");

  return {
    durationMin: Math.round(route.duration / 60),
    distanceKm: route.distance / 1000,
  };
}

export function loadDirections(
  from: LatLng,
  to: LatLng,
  profile: DirectionsProfile,
  signal: AbortSignal,
): Promise<DirectionsResult> {
  const key = keyFor(from, to, profile);
  const hit = cache.get(key);
  if (hit) return hit;

  // Drop cache entry on failure/abort so a future call can retry.
  const promise = fetchDirections(from, to, profile, signal).catch((err) => {
    cache.delete(key);
    throw err;
  });
  cache.set(key, promise);
  return promise;
}
