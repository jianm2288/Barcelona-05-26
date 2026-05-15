"use client";

import { useEffect, useState } from "react";
import type {
  Day,
  DayStop,
  DayStopMode,
  Destination,
} from "@/lib/types";
import {
  loadDirections,
  type DirectionsProfile,
  type LatLng,
} from "@/lib/mapbox/directions";

export type CommuteLeg =
  | { state: "loading"; mode: DayStopMode }
  | {
      state: "ready";
      mode: DayStopMode;
      durationMin?: number;
      distanceKm?: number;
      note?: string;
      sameLocation?: boolean;
      destination: LatLng;
    }
  | { state: "hidden" };

export type UseCommutesResult = {
  legs: Record<string, CommuteLeg>;
};

const SAME_LOCATION_M = 30;

const PROFILE_FOR: Partial<Record<DayStopMode, DirectionsProfile>> = {
  walking: "walking",
  driving: "driving",
  transit: "driving", // proxy — Mapbox has no transit profile
};

function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function findHotelForRegion(
  region: string,
  destinations: Destination[],
): Destination | null {
  return (
    destinations.find(
      (d) => d.category === "hotel" && d.region === region,
    ) ?? null
  );
}

type LegPlan =
  | { kind: "hidden"; stopId: string }
  | {
      kind: "manual";
      stopId: string;
      mode: DayStopMode;
      durationMin?: number;
      distanceKm?: number;
      note?: string;
      destination: LatLng;
    }
  | {
      kind: "sameLocation";
      stopId: string;
      mode: DayStopMode;
      destination: LatLng;
    }
  | {
      kind: "fetch";
      stopId: string;
      mode: DayStopMode;
      profile: DirectionsProfile;
      from: LatLng;
      to: LatLng;
      note?: string;
    };

function planLegs(
  day: Day,
  destinations: Destination[],
): LegPlan[] {
  const byId = new Map(destinations.map((d) => [d.id, d]));
  const stops: DayStop[] = [...day.stops].sort((a, b) => a.order - b.order);
  const plans: LegPlan[] = [];

  let prev: Destination | null = null;
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    const dest = byId.get(stop.destinationId);
    if (!dest) {
      plans.push({ kind: "hidden", stopId: stop.destinationId });
      continue;
    }

    let origin: Destination | null;
    if (i === 0) {
      origin = findHotelForRegion(dest.region, destinations);
    } else {
      origin = prev;
    }

    // No valid origin → hide the pill (e.g., first stop with no hotel in region).
    // Also hide when the first stop IS the hotel (origin === destination).
    if (!origin || origin.id === dest.id) {
      plans.push({ kind: "hidden", stopId: stop.destinationId });
      prev = dest;
      continue;
    }

    const note = stop.commute?.note;
    const toPt: LatLng = { lng: dest.lng, lat: dest.lat };
    const fromPt: LatLng = { lng: origin.lng, lat: origin.lat };

    // Manual-only modes (flight, train): never call Mapbox.
    if (stop.mode === "flight" || stop.mode === "train") {
      plans.push({
        kind: "manual",
        stopId: stop.destinationId,
        mode: stop.mode,
        durationMin: stop.commute?.durationMin,
        distanceKm: stop.commute?.distanceKm,
        note,
        destination: toPt,
      });
      prev = dest;
      continue;
    }

    // Same-location short-circuit (e.g., consecutive stops inside one complex).
    if (haversineMeters(fromPt, toPt) < SAME_LOCATION_M) {
      plans.push({
        kind: "sameLocation",
        stopId: stop.destinationId,
        mode: stop.mode,
        destination: toPt,
      });
      prev = dest;
      continue;
    }

    const profile = PROFILE_FOR[stop.mode];
    if (!profile) {
      plans.push({ kind: "hidden", stopId: stop.destinationId });
      prev = dest;
      continue;
    }

    plans.push({
      kind: "fetch",
      stopId: stop.destinationId,
      mode: stop.mode,
      profile,
      from: fromPt,
      to: toPt,
      note,
    });
    prev = dest;
  }

  return plans;
}

export function useCommutes(
  day: Day,
  destinations: Destination[],
): UseCommutesResult {
  const [legs, setLegs] = useState<Record<string, CommuteLeg>>({});

  useEffect(() => {
    const controller = new AbortController();
    const plans = planLegs(day, destinations);

    const initial: Record<string, CommuteLeg> = {};
    for (const plan of plans) {
      if (plan.kind === "hidden") {
        initial[plan.stopId] = { state: "hidden" };
      } else if (plan.kind === "manual") {
        initial[plan.stopId] = {
          state: "ready",
          mode: plan.mode,
          durationMin: plan.durationMin,
          distanceKm: plan.distanceKm,
          note: plan.note,
          destination: plan.destination,
        };
      } else if (plan.kind === "sameLocation") {
        initial[plan.stopId] = {
          state: "ready",
          mode: plan.mode,
          sameLocation: true,
          destination: plan.destination,
        };
      } else {
        initial[plan.stopId] = { state: "loading", mode: plan.mode };
      }
    }
    setLegs(initial);

    const fetches = plans.filter(
      (p): p is Extract<LegPlan, { kind: "fetch" }> => p.kind === "fetch",
    );

    fetches.forEach((p) => {
      loadDirections(p.from, p.to, p.profile, controller.signal)
        .then((res) => {
          if (controller.signal.aborted) return;
          setLegs((cur) => ({
            ...cur,
            [p.stopId]: {
              state: "ready",
              mode: p.mode,
              durationMin: res.durationMin,
              distanceKm: res.distanceKm,
              note: p.note,
              destination: p.to,
            },
          }));
        })
        .catch((err) => {
          if (err?.name === "AbortError" || controller.signal.aborted) return;
          setLegs((cur) => ({
            ...cur,
            [p.stopId]: { state: "hidden" },
          }));
        });
    });

    return () => controller.abort();
  }, [day, destinations]);

  return { legs };
}
