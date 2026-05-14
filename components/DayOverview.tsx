"use client";

import type { Day, Destination } from "@/lib/types";

type Props = {
  tripTitle: string;
  day: Day;
  destinations: Destination[];
  onStopTap: (destinationId: string) => void;
};

export function DayOverview({ tripTitle, day, destinations, onStopTap }: Props) {
  const byId = new Map(destinations.map((d) => [d.id, d]));

  return (
    <div className="px-5 pb-10 pt-2">
      <p className="text-caption-strong uppercase tracking-[0.12em] text-ink-48">
        {tripTitle}
      </p>
      <h2 className="mt-2 text-display-md font-display text-ink">
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

      <ul className="mt-5 flex flex-col gap-2">
        {day.stops.map((stop) => {
          const dest = byId.get(stop.destinationId);
          if (!dest) return null;
          return (
            <li key={stop.destinationId}>
              <button
                type="button"
                onClick={() => onStopTap(stop.destinationId)}
                className="press flex w-full items-start gap-3 rounded-md bg-white/70 p-3 text-left ring-1 ring-white/60 hover:bg-white"
              >
                <span className="pin-badge pin-badge-inactive mt-0.5">
                  {stop.order}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body-strong text-ink">
                    {dest.name}
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
          );
        })}
      </ul>
    </div>
  );
}

function stripMarkdownLinks(s: string): string {
  return s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}
