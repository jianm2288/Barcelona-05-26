"use client";

export type PoiData = {
  category: string | null;
  address: string | null;
  hours: string | null;
  phone: string | null;
};

const cache = new Map<string, Promise<PoiData>>();

function getToken(): string {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
}

async function fetchPoi(lng: number, lat: number): Promise<PoiData> {
  const token = getToken();
  if (!token) {
    return { category: null, address: null, hours: null, phone: null };
  }
  // Mapbox Search Box reverse — returns POI with category and address.
  const url =
    `https://api.mapbox.com/search/searchbox/v1/reverse` +
    `?longitude=${lng}&latitude=${lat}` +
    `&types=poi,address&limit=1&access_token=${token}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const body = await res.json();
    const feat = body.features?.[0];
    if (!feat) {
      return { category: null, address: null, hours: null, phone: null };
    }
    const props = feat.properties ?? {};
    const meta = props.metadata ?? {};
    return {
      category: props.poi_category?.[0] ?? props.category ?? null,
      address: props.full_address ?? props.address ?? null,
      hours: meta.open_hours_display ?? null,
      phone: meta.phone ?? null,
    };
  } catch {
    return { category: null, address: null, hours: null, phone: null };
  }
}

export function loadPoi(lng: number, lat: number): Promise<PoiData> {
  const key = `${lng.toFixed(5)},${lat.toFixed(5)}`;
  if (!cache.has(key)) cache.set(key, fetchPoi(lng, lat));
  return cache.get(key)!;
}
