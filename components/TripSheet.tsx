"use client";

import { useEffect, useRef, useState } from "react";
import type { Day, Destination } from "@/lib/types";
import type { SheetDetent } from "./TripView";
import { DayOverview } from "./DayOverview";
import { StopDetail } from "./StopDetail";

type Props = {
  day: Day;
  destinations: Destination[];
  selectedStopId: string | null;
  detent: SheetDetent;
  onDetentChange: (d: SheetDetent) => void;
  onPrevDay: () => void;
  onNextDay: () => void;
  onStopTap: (destinationId: string) => void;
  onClearStop: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onSheetHeightChange?: (px: number) => void;
};

const SHEET_HEIGHT: Record<Exclude<SheetDetent, "closed">, string> = {
  medium: "60dvh",
  expanded: "95dvh",
};

function nextDetentForDrag(detent: SheetDetent, delta: number): SheetDetent {
  const threshold = 72;
  if (delta > threshold) {
    return detent === "closed" ? "closed" : "closed";
  }
  if (delta < -threshold) {
    if (detent === "closed") return "medium";
    if (detent === "medium") return "expanded";
    return "expanded";
  }
  return detent;
}

export function TripSheet({
  day,
  destinations,
  selectedStopId,
  detent,
  onDetentChange,
  onPrevDay,
  onNextDay,
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
    const report = () => {
      const rect = el.getBoundingClientRect();
      onSheetHeightChange(Math.max(0, window.innerHeight - rect.top));
    };
    const ro = new ResizeObserver(report);
    ro.observe(el);
    window.addEventListener("resize", report);
    const raf = requestAnimationFrame(report);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", report);
      cancelAnimationFrame(raf);
    };
  }, [onSheetHeightChange, detent]);

  const dragOffset = drag ? Math.max(0, drag.delta) : 0;
  const isClosed = detent === "closed";
  const sheetHeight = isClosed ? SHEET_HEIGHT.medium : SHEET_HEIGHT[detent];

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ startY: e.clientY, delta: 0 });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    setDrag((current) =>
      current ? { ...current, delta: e.clientY - current.startY } : current,
    );
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const next = nextDetentForDrag(detent, drag.delta);
    if (next !== detent) onDetentChange(next);
    setDrag(null);
  };

  const handleDateLabelClick = () => {
    if (detent === "closed") onDetentChange("medium");
    else onDetentChange(detent === "expanded" ? "medium" : "expanded");
  };

  const selectedDest = selectedStopId
    ? destinations.find((d) => d.id === selectedStopId)
    : null;

  return (
    <div
      ref={sheetRef}
      className="glass-light absolute bottom-0 left-1/2 z-40 flex w-full max-w-[560px] flex-col rounded-t-lg shadow-glass"
      style={{
        height: sheetHeight,
        transform: isClosed
          ? "translate(-50%, calc(100% - 64px))"
          : `translate(-50%, ${dragOffset}px)`,
        transition: drag
          ? "none"
          : "transform 300ms cubic-bezier(0.4,0,0.2,1), height 300ms cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className="cursor-grab select-none"
        style={{ touchAction: "none" }}
      >
        <div className="flex justify-center pt-2">
          <span className="h-1 w-10 rounded-full bg-ink/20" aria-hidden />
        </div>
        <div className="flex items-center justify-between px-4 py-2.5">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
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
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              handleDateLabelClick();
            }}
            className="text-caption-strong text-ink"
          >
            {day.shortDate} · {day.title}
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
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

      <div
        className="relative flex-1 overflow-y-auto"
        style={{ maxHeight: "calc(100% - 64px)" }}
      >
        <div className="progressive-blur" aria-hidden>
          <div />
          <div />
          <div />
          <div />
          <div />
        </div>
        {selectedDest ? (
          <StopDetail destination={selectedDest} onBack={onClearStop} />
        ) : (
          <DayOverview
            day={day}
            destinations={destinations}
            onStopTap={onStopTap}
          />
        )}
      </div>
    </div>
  );
}
