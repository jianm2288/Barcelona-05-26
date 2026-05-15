"use client";

import {
  PersonSimpleWalk,
  Car,
  Subway,
  Train,
  AirplaneTakeoff,
  type Icon,
} from "@phosphor-icons/react";
import type { CommuteLeg } from "@/lib/hooks/useCommutes";
import type { DayStopMode } from "@/lib/types";

type Props = {
  leg: CommuteLeg;
};

const ICON_FOR: Record<DayStopMode, Icon> = {
  walking: PersonSimpleWalk,
  driving: Car,
  transit: Subway,
  flight: AirplaneTakeoff,
  train: Train,
};

const GOOGLE_TRAVELMODE: Record<DayStopMode, string | null> = {
  walking: "walking",
  driving: "driving",
  transit: "transit",
  flight: null,
  train: null,
};

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round((km * 1000) / 10) * 10} m`;
  return `${km.toFixed(1)} km`;
}

export function CommutePill({ leg }: Props) {
  if (leg.state === "hidden") return null;

  if (leg.state === "loading") {
    return (
      <div className="commute-row" aria-hidden="true">
        <span className="commute-pill commute-pill-skeleton" />
      </div>
    );
  }

  const Icon = ICON_FOR[leg.mode] ?? PersonSimpleWalk;
  const parts: string[] = [];

  if (leg.sameLocation) {
    parts.push("Same location");
  } else {
    if (leg.durationMin != null) parts.push(formatDuration(leg.durationMin));
    if (leg.distanceKm != null) parts.push(formatDistance(leg.distanceKm));
  }
  if (leg.note) parts.push(leg.note);

  const travelmode = GOOGLE_TRAVELMODE[leg.mode];
  const href =
    travelmode && !leg.sameLocation
      ? `https://www.google.com/maps/dir/?api=1` +
        `&destination=${leg.destination.lat},${leg.destination.lng}` +
        `&travelmode=${travelmode}`
      : null;

  const inner = (
    <>
      <Icon size={13} weight="bold" />
      {parts.map((p, i) => (
        <span key={i} className="commute-pill-part">
          {p}
        </span>
      ))}
    </>
  );

  return (
    <div className="commute-row">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="commute-pill commute-pill-link"
          aria-label={`${parts.join(", ")}. Opens directions in Google Maps.`}
        >
          {inner}
        </a>
      ) : (
        <span className="commute-pill">{inner}</span>
      )}
    </div>
  );
}
