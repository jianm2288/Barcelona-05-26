"use client";

import { useMemo } from "react";
import type { Day } from "@/lib/types";

const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

function parseDayDate(str: string): Date | null {
  // e.g. "Saturday, May 16, 2026"
  const m = str.match(/(\w+) (\d{1,2}),\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  const day = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (month === undefined) return null;
  return new Date(year, month, day);
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function pickInitialDayId(days: Day[], now: Date = new Date()): string {
  if (days.length === 0) return "";
  const today = startOfDay(now).getTime();
  for (const day of days) {
    const parsed = parseDayDate(day.date);
    if (parsed && startOfDay(parsed).getTime() === today) return day.id;
  }
  return days[0].id;
}

export function isToday(day: Day, now: Date = new Date()): boolean {
  const parsed = parseDayDate(day.date);
  if (!parsed) return false;
  return startOfDay(parsed).getTime() === startOfDay(now).getTime();
}

export function useToday(days: Day[]): { initialDayId: string } {
  return useMemo(() => ({ initialDayId: pickInitialDayId(days) }), [days]);
}
