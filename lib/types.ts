export type RouteLink = {
  label: string;
  url: string;
};

export type Destination = {
  id: string;
  region: string;
  name: string;
  summary: string;
  link: string | null;
  lat: number;
  lng: number;
};

export type TimelineItem = {
  title: string;
  body: string;
  meta: string | null;
  routes: RouteLink[];
};

export type DayStopMode = "walking" | "driving";

export type DayStop = {
  destinationId: string;
  order: number;
  mode: DayStopMode;
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
