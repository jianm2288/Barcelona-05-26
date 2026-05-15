"use client";

import { useEffect, useState } from "react";
import { loadPlacePhotos, type PlacePhoto } from "@/lib/wikipedia";

type Props = {
  name: string;
  region: string;
};

export function PlacePhotos({ name, region }: Props) {
  const [photos, setPhotos] = useState<PlacePhoto[]>([]);

  useEffect(() => {
    let alive = true;
    setPhotos([]);
    loadPlacePhotos(name, region).then((rows) => {
      if (alive) setPhotos(rows);
    });
    return () => {
      alive = false;
    };
  }, [name, region]);

  if (photos.length === 0) return null;

  return (
    <div className="-mx-5 mb-5">
      <div
        className="flex gap-2 overflow-x-auto px-5 pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        {photos.map((p) => (
          <img
            key={p.url}
            src={p.url}
            alt={p.caption}
            draggable={false}
            loading="lazy"
            className="h-44 w-72 flex-none rounded-2xl bg-ink/5 object-cover ring-1 ring-white/40"
          />
        ))}
      </div>
    </div>
  );
}
