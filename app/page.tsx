import { TripView } from "@/components/TripView";
import { trip } from "@/lib/trips";

export default function HomePage() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
  return (
    <main>
      <TripView trip={trip} mapboxToken={token} />
    </main>
  );
}
