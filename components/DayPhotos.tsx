"use client";

import { useEffect, useState } from "react";
import type { Day, Destination } from "@/lib/types";
import { loadPlacePhotos, type PlacePhoto } from "@/lib/wikipedia";

type Props = {
  day: Day;
  destinations: Destination[];
};

// Cap per-stop photos so one famous landmark doesn't dominate the strip.
// Lets a typical 6-8 stop day surface variety across stops.
const PHOTOS_PER_STOP = 2;

export function DayPhotos({ day, destinations }: Props) {
  const [photos, setPhotos] = useState<PlacePhoto[]>([]);

  useEffect(() => {
    let alive = true;
    setPhotos([]);
    const byId = new Map(destinations.map((d) => [d.id, d]));
    const stopDests = day.stops
      .map((s) => byId.get(s.destinationId))
      .filter((d): d is Destination => Boolean(d));

    Promise.all(
      stopDests.map((d) => loadPlacePhotos(d.name, d.region)),
    ).then((results) => {
      if (!alive) return;
      // Interleave by rank: take the #1 photo from every stop first, then #2
      // from every stop, etc. The visible head of the strip shows variety
      // across the day instead of two consecutive shots of the first stop.
      const merged: PlacePhoto[] = [];
      for (let rank = 0; rank < PHOTOS_PER_STOP; rank++) {
        for (const list of results) {
          if (list[rank]) merged.push(list[rank]);
        }
      }
      setPhotos(merged);
    });

    return () => {
      alive = false;
    };
  }, [day.id, destinations]);

  if (photos.length === 0) return null;

  return (
    <div className="-mx-5 mb-3">
      <div
        className="flex gap-1 overflow-x-auto px-5 pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        {photos.map((p) => (
          <img
            key={p.url}
            src={p.url}
            alt={p.caption}
            draggable={false}
            loading="lazy"
            className="h-16 w-24 flex-none rounded-md bg-ink/5 object-cover ring-1 ring-white/40"
          />
        ))}
      </div>
    </div>
  );
}
