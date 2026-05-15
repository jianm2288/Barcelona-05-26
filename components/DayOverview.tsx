"use client";

import { Fragment } from "react";
import {
  Bed,
  ForkKnife,
  Martini,
  Bank,
  Tree,
  MapPin,
  Train,
  Storefront,
  SealCheck,
  type Icon,
} from "@phosphor-icons/react";
import type { Day, Destination, DestinationCategory } from "@/lib/types";
import { useCommutes } from "@/lib/hooks/useCommutes";
import { CommutePill } from "./CommutePill";
import { DayPhotos } from "./DayPhotos";

const CATEGORY_ICONS: Record<DestinationCategory, Icon> = {
  hotel: Bed,
  restaurant: ForkKnife,
  bar: Martini,
  museum: Bank,
  park: Tree,
  landmark: SealCheck,
  transit: Train,
  shopping: Storefront,
  unknown: MapPin,
};

type Props = {
  day: Day;
  destinations: Destination[];
  onStopTap: (destinationId: string) => void;
};

export function DayOverview({ day, destinations, onStopTap }: Props) {
  const byId = new Map(destinations.map((d) => [d.id, d]));
  const { legs } = useCommutes(day, destinations);

  return (
    <div className="px-5 pb-10 pt-14">
      <DayPhotos day={day} destinations={destinations} />
      <h2 className="text-display-md font-display text-ink">
        {day.heading}
      </h2>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <p className="text-caption text-ink-48">{day.date}</p>
        {day.pill && (
          <span className="rounded-pill bg-parchment px-2.5 py-0.5 text-caption text-ink-80">
            {day.pill}
          </span>
        )}
      </div>

      {day.summary && (
        <p className="mt-4 text-body text-ink-80">
          {stripMarkdownLinks(day.summary)}
        </p>
      )}

      <ul className="mt-5 flex flex-col">
        {day.stops.map((stop) => {
          const dest = byId.get(stop.destinationId);
          if (!dest) return null;
          const Icon = CATEGORY_ICONS[dest.category] ?? MapPin;
          const leg = legs[stop.destinationId] ?? {
            state: "loading" as const,
            mode: stop.mode,
          };
          return (
            <Fragment key={stop.destinationId}>
              <li>
                <CommutePill leg={leg} />
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onStopTap(stop.destinationId)}
                  className="press flex w-full items-start gap-3 rounded-md bg-white/70 p-3 text-left ring-1 ring-white/60 hover:bg-white"
                >
                  <span className="pin-badge pin-badge-inactive mt-0.5 shrink-0">
                    {stop.order}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <Icon size={16} weight="duotone" />
                      <span className="text-body-strong text-ink">
                        {dest.name}
                      </span>
                    </span>
                    <span className="block text-caption text-ink-48">
                      {dest.region} · {stop.mode}
                    </span>
                    <span className="mt-1 block text-caption text-ink-80">
                      {dest.summary}
                    </span>
                  </span>
                </button>
              </li>
            </Fragment>
          );
        })}
      </ul>
    </div>
  );
}

function stripMarkdownLinks(s: string): string {
  return s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}
