"use client";

import { useEffect, useRef } from "react";
import type { Day } from "@/lib/types";
import { isToday } from "@/lib/hooks/useToday";
import type { SheetDetent } from "./TripView";

type Props = {
  days: Day[];
  activeId: string;
  detent: SheetDetent;
  onSelect: (id: string) => void;
};

function dayNumber(day: Day): string {
  // "May 16" → "16"
  const m = day.shortDate.match(/(\d{1,2})\s*$/);
  return m ? m[1] : day.shortDate;
}

export function DayStrip({ days, activeId, detent, onSelect }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const visible = detent === "closed";

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current.querySelector<HTMLButtonElement>(
      `[data-day-id="${activeId}"]`,
    );
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeId, visible]);

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 top-0 z-30 transition-opacity duration-300 ease-apple ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden={!visible}
    >
      <div
        ref={ref}
        className={`mx-auto max-w-screen-md overflow-x-auto px-4 py-3 ${
          visible ? "pointer-events-auto" : ""
        }`}
        style={{
          paddingTop: "max(env(safe-area-inset-top), 0.75rem)",
          scrollbarWidth: "none",
        }}
      >
        <div className="mx-auto flex w-fit items-center gap-2">
        {days.map((d) => {
          const active = d.id === activeId;
          const today = isToday(d);
          return (
            <button
              key={d.id}
              data-day-id={d.id}
              onClick={() => onSelect(d.id)}
              aria-pressed={active}
              aria-label={`${d.shortDate} — ${d.title}`}
              className={`chip-button press shrink-0 ${active ? "chip-active" : "chip-inactive"}`}
            >
              <span className="font-display">{dayNumber(d)}</span>
              {today && (
                <span
                  aria-hidden
                  className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                    active ? "bg-white" : "bg-action"
                  }`}
                />
              )}
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}
