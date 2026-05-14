"use client";

import { useEffect, useRef, useState } from "react";
import type { Day, Destination } from "@/lib/types";
import { DayOverview } from "./DayOverview";
import { StopDetail } from "./StopDetail";

type Props = {
  tripTitle: string;
  day: Day;
  destinations: Destination[];
  selectedStopId: string | null;
  open: boolean;
  onPrevDay: () => void;
  onNextDay: () => void;
  onToggle: () => void;
  onStopTap: (destinationId: string) => void;
  onClearStop: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onSheetHeightChange?: (px: number) => void;
};

export function TripSheet({
  tripTitle,
  day,
  destinations,
  selectedStopId,
  open,
  onPrevDay,
  onNextDay,
  onToggle,
  onStopTap,
  onClearStop,
  hasPrev,
  hasNext,
  onSheetHeightChange,
}: Props) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<{ startY: number; delta: number } | null>(
    null,
  );

  useEffect(() => {
    if (!sheetRef.current || !onSheetHeightChange) return;
    const el = sheetRef.current;
    const ro = new ResizeObserver(() => {
      onSheetHeightChange(el.offsetHeight);
    });
    ro.observe(el);
    onSheetHeightChange(el.offsetHeight);
    return () => ro.disconnect();
  }, [onSheetHeightChange]);

  const dragOffset = drag ? Math.max(0, drag.delta) : 0;

  const handleTouchStart = (e: React.TouchEvent) => {
    setDrag({ startY: e.touches[0].clientY, delta: 0 });
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    setDrag((d) =>
      d ? { ...d, delta: e.touches[0].clientY - d.startY } : d,
    );
  };
  const handleTouchEnd = () => {
    if (!drag) return;
    const threshold = 60;
    if (open && drag.delta > threshold) onToggle();
    else if (!open && drag.delta < -threshold) onToggle();
    setDrag(null);
  };

  const selectedDest = selectedStopId
    ? destinations.find((d) => d.id === selectedStopId)
    : null;

  return (
    <div
      ref={sheetRef}
      className="glass-light absolute bottom-0 left-1/2 z-40 w-full max-w-[480px] rounded-t-lg shadow-glass"
      style={{
        height: "var(--sheet-open-height)",
        transform: open
          ? `translate(-50%, ${dragOffset}px)`
          : `translate(-50%, calc(100% - 64px))`,
        transition: drag ? "none" : "transform 300ms cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {/* drag handle + header */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (!open) onToggle();
        }}
        className="cursor-grab select-none"
      >
        <div className="flex justify-center pt-2">
          <span className="h-1 w-10 rounded-full bg-ink/20" aria-hidden />
        </div>
        <div className="flex items-center justify-between px-4 py-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (selectedStopId) onClearStop();
              else if (hasPrev) onPrevDay();
            }}
            disabled={!selectedStopId && !hasPrev}
            aria-label="Previous"
            className={`press flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-ink ring-1 ring-white/60 ${
              !selectedStopId && !hasPrev ? "opacity-30" : ""
            }`}
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="text-caption-strong text-ink"
          >
            {day.shortDate} · {day.title}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (hasNext) onNextDay();
            }}
            disabled={!hasNext}
            aria-label="Next day"
            className={`press flex h-9 w-9 items-center justify-center rounded-full bg-white/70 text-ink ring-1 ring-white/60 ${
              !hasNext ? "opacity-30" : ""
            }`}
          >
            ›
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ maxHeight: "calc(100% - 64px)" }}>
        {selectedDest ? (
          <StopDetail destination={selectedDest} onBack={onClearStop} />
        ) : (
          <DayOverview
            tripTitle={tripTitle}
            day={day}
            destinations={destinations}
            onStopTap={onStopTap}
          />
        )}
      </div>
    </div>
  );
}
