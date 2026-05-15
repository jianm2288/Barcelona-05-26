"use client";

import { useEffect, useState } from "react";
import type { Destination } from "@/lib/types";
import { loadPoi, type PoiData } from "@/lib/mapbox/poi";
import { PhotoGallery } from "./PhotoGallery";
import { PlacePhotos } from "./PlacePhotos";

type Props = {
  destination: Destination;
  onBack: () => void;
};

export function StopDetail({ destination, onBack }: Props) {
  const [poi, setPoi] = useState<PoiData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setPoi(null);
    loadPoi(destination.lng, destination.lat).then((data) => {
      if (!alive) return;
      setPoi(data);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [destination.id, destination.lng, destination.lat]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-5 pb-24 pt-14">
        <PlacePhotos name={destination.name} region={destination.region} />
        <h2 className="text-display-md font-display text-ink">
          {destination.name}
        </h2>
        <p className="mt-1 text-caption text-ink-48">{destination.region}</p>

        <p className="mt-4 text-body text-ink-80">{destination.summary}</p>

        <dl className="mt-6 flex flex-col gap-3">
          <PoiRow label="Category" value={poi?.category ?? null} loading={loading} />
          <PoiRow label="Address" value={poi?.address ?? null} loading={loading} />
          <PoiRow label="Hours" value={poi?.hours ?? null} loading={loading} />
          <PoiRow label="Phone" value={poi?.phone ?? null} loading={loading} />
        </dl>

        <PhotoGallery destinationId={destination.id} />
      </div>

      <div className="border-t border-white/40 bg-white/60 px-5 py-3 backdrop-blur-xl">
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="press inline-flex w-full items-center justify-center rounded-pill bg-action px-4 py-3 text-body-strong text-white"
        >
          Get directions in Google Maps
        </a>
      </div>
    </div>
  );
}

function PoiRow({
  label,
  value,
  loading,
}: {
  label: string;
  value: string | null;
  loading: boolean;
}) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3">
      <dt className="text-caption text-ink-48">{label}</dt>
      <dd className="min-w-0 text-caption text-ink">
        {loading ? (
          <span className="block h-3 w-2/3 animate-pulse rounded bg-ink/10" />
        ) : value ? (
          <span className="block break-words">{value}</span>
        ) : (
          <span className="text-ink-48">—</span>
        )}
      </dd>
    </div>
  );
}
