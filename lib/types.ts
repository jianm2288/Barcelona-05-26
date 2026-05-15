export type RouteLink = {
  label: string;
  url: string;
};

export type DestinationCategory =
  | "hotel"
  | "restaurant"
  | "bar"
  | "museum"
  | "park"
  | "landmark"
  | "transit"
  | "shopping"
  | "unknown";

export type Destination = {
  id: string;
  region: string;
  name: string;
  summary: string;
  link: string | null;
  lat: number;
  lng: number;
  category: DestinationCategory;
};

export type TimelineItem = {
  title: string;
  body: string;
  meta: string | null;
  routes: RouteLink[];
};

export type DayStopMode =
  | "walking"
  | "driving"
  | "transit"
  | "flight"
  | "train";

// Describes the leg leading TO this stop (from the previous stop, or from the
// day's hotel for the first stop). Only honored for `flight` / `train` modes;
// `walking` / `driving` / `transit` always use Mapbox Directions at runtime.
export type DayStopCommute = {
  durationMin?: number;
  distanceKm?: number;
  note?: string;
};

export type DayStop = {
  destinationId: string;
  order: number;
  mode: DayStopMode;
  commute?: DayStopCommute | null;
};

export type LineStringGeometry = {
  type: "LineString";
  coordinates: [number, number][];
};

export type Day = {
  id: string;
  shortDate: string;
  title: string;
  date: string;
  heading: string;
  pill: string | null;
  summary: string;
  routes: RouteLink[];
  timeline: TimelineItem[];
  stops: DayStop[];
  routePolyline: LineStringGeometry;
};

export type OverviewCard = {
  heading: string;
  body: string;
};

export type Hero = {
  title: string;
  eyebrow: string;
  heading: string;
  intro: string;
  snapshot: string[];
};

export type Trip = {
  slug: string;
  hero: Hero;
  overview: OverviewCard[];
  destinations: Destination[];
  days: Day[];
  source: string | null;
  summary: string;
};

export type TripSummary = {
  slug: string;
  title: string;
  eyebrow: string;
  heading: string;
  intro: string;
  snapshot: string[];
  source: string | null;
  summary: string;
};
