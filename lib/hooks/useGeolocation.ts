"use client";

import { useEffect, useState } from "react";

export type Geo = { lat: number; lng: number };

export function useGeolocation(enabled: boolean = true): Geo | null {
  const [pos, setPos] = useState<Geo | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined") return;
    if (!("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {
        /* silent — plan calls for no fallback UI */
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  return pos;
}
