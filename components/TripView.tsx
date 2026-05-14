"use client";

import { useEffect, useMemo, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Trip } from "@/lib/types";
import { useToday } from "@/lib/hooks/useToday";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import { MapCanvas } from "./MapCanvas";
import { DayStrip } from "./DayStrip";
import { TripSheet } from "./TripSheet";

type Props = {
  trip: Trip;
  mapboxToken: string;
};

export function TripView({ trip, mapboxToken }: Props) {
  const { initialDayId } = useToday(trip.days);
  const [activeDayId, setActiveDayId] = useState(initialDayId);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(true);
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
    setSheetOpen(true);
  };

  const handlePrev = () => {
    if (dayIndex > 0) handleSelectDay(trip.days[dayIndex - 1].id);
  };
  const handleNext = () => {
    if (dayIndex < trip.days.length - 1)
      handleSelectDay(trip.days[dayIndex + 1].id);
  };

  const handlePinTap = (id: string) => {
    setSelectedStopId(id);
    setSheetOpen(true);
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
        sheetOpen={sheetOpen}
        sheetHeightPx={sheetHeightPx}
        onPinTap={handlePinTap}
        onMapTap={handleMapTap}
      />

      <DayStrip
        days={trip.days}
        activeId={day.id}
        visible={!sheetOpen}
        onSelect={handleSelectDay}
      />

      <TripSheet
        tripTitle={trip.hero?.title || ""}
        day={day}
        destinations={trip.destinations}
        selectedStopId={selectedStopId}
        open={sheetOpen}
        onPrevDay={handlePrev}
        onNextDay={handleNext}
        onToggle={() => setSheetOpen((o) => !o)}
        onStopTap={handlePinTap}
        onClearStop={() => setSelectedStopId(null)}
        hasPrev={dayIndex > 0}
        hasNext={dayIndex < trip.days.length - 1}
        onSheetHeightChange={setSheetHeightPx}
      />
    </>
  );
}
