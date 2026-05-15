"use client";

import { useEffect, useMemo, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Trip } from "@/lib/types";
import { useToday } from "@/lib/hooks/useToday";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import { MapCanvas } from "./MapCanvas";
import { DayStrip } from "./DayStrip";
import { TripSheet } from "./TripSheet";

export type SheetDetent = "closed" | "medium" | "expanded";

type Props = {
  trip: Trip;
  mapboxToken: string;
};

export function TripView({ trip, mapboxToken }: Props) {
  const { initialDayId } = useToday(trip.days);
  const [activeDayId, setActiveDayId] = useState(initialDayId);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [detent, setDetent] = useState<SheetDetent>("medium");
  const [sheetHeightPx, setSheetHeightPx] = useState(0);
  const geo = useGeolocation(true);

  useEffect(() => {
    if (!activeDayId && initialDayId) setActiveDayId(initialDayId);
  }, [initialDayId, activeDayId]);

  const dayIndex = useMemo(
    () => Math.max(0, trip.days.findIndex((d) => d.id === activeDayId)),
    [trip.days, activeDayId],
  );
  const day = trip.days[dayIndex] ?? trip.days[0];

  const handleSelectDay = (id: string) => {
    setActiveDayId(id);
    setSelectedStopId(null);
    if (detent === "closed") setDetent("medium");
  };

  const handlePrev = () => {
    if (dayIndex > 0) handleSelectDay(trip.days[dayIndex - 1].id);
  };
  const handleNext = () => {
    if (dayIndex < trip.days.length - 1)
      handleSelectDay(trip.days[dayIndex + 1].id);
  };

  // Pin tap: toggle selection if same pin tapped twice; otherwise select.
  const handlePinTap = (id: string) => {
    if (id === selectedStopId) {
      setSelectedStopId(null);
      return;
    }
    setSelectedStopId(id);
    if (detent === "closed") setDetent("medium");
  };

  const handleMapTap = () => {
    if (selectedStopId) setSelectedStopId(null);
  };

  return (
    <>
      <MapCanvas
        token={mapboxToken}
        day={day}
        destinations={trip.destinations}
        selectedStopId={selectedStopId}
        geo={geo}
        sheetOpen={detent !== "closed"}
        sheetHeightPx={sheetHeightPx}
        onPinTap={handlePinTap}
        onMapTap={handleMapTap}
      />

      <DayStrip
        days={trip.days}
        activeId={day.id}
        detent={detent}
        onSelect={handleSelectDay}
      />

      <TripSheet
        day={day}
        destinations={trip.destinations}
        selectedStopId={selectedStopId}
        detent={detent}
        onDetentChange={setDetent}
        onPrevDay={handlePrev}
        onNextDay={handleNext}
        onStopTap={handlePinTap}
        onClearStop={() => setSelectedStopId(null)}
        hasPrev={dayIndex > 0}
        hasNext={dayIndex < trip.days.length - 1}
        onSheetHeightChange={setSheetHeightPx}
      />
    </>
  );
}
