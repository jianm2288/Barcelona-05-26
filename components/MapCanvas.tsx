"use client";

import { useEffect, useMemo, useRef } from "react";
import mapboxgl, { type LngLatBoundsLike, type Map as MapboxMap } from "mapbox-gl";
import type { Day, Destination } from "@/lib/types";
import type { Geo } from "@/lib/hooks/useGeolocation";

type StopWithPoint = {
  id: string;
  order: number;
  lng: number;
  lat: number;
  destination: Destination;
};

type Props = {
  token: string;
  day: Day;
  destinations: Destination[];
  selectedStopId: string | null;
  geo: Geo | null;
  sheetOpen: boolean;
  sheetHeightPx: number;
  onPinTap: (destinationId: string) => void;
  onMapTap: () => void;
};

const STYLE_URL = "mapbox://styles/mapbox/light-v11";
const ROUTE_SRC = "trip-route";
const ROUTE_LAYER = "trip-route-line";
const ROUTE_LAYER_SHADOW = "trip-route-line-shadow";

export function MapCanvas({
  token,
  day,
  destinations,
  selectedStopId,
  geo,
  sheetOpen,
  sheetHeightPx,
  onPinTap,
  onMapTap,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const pinMarkers = useRef<mapboxgl.Marker[]>([]);
  const geoMarker = useRef<mapboxgl.Marker | null>(null);

  const stopsWithPoints = useMemo<StopWithPoint[]>(() => {
    const byId = new Map(destinations.map((d) => [d.id, d]));
    return day.stops
      .map((s) => {
        const d = byId.get(s.destinationId);
        if (!d) return null;
        return {
          id: d.id,
          order: s.order,
          lng: d.lng,
          lat: d.lat,
          destination: d,
        };
      })
      .filter((s): s is StopWithPoint => s !== null);
  }, [day, destinations]);

  // create the map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!token) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      attributionControl: true,
      center: [0, 20],
      zoom: 1.5,
      cooperativeGestures: false,
      preserveDrawingBuffer: true,
    });
    mapRef.current = map;
    map.on("click", () => onMapTap());
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ensure handler tracks latest closure
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = () => onMapTap();
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [onMapTap]);

  // render pins + route when day changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      // wipe old markers
      pinMarkers.current.forEach((m) => m.remove());
      pinMarkers.current = [];

      // place pins
      stopsWithPoints.forEach((p) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "pin-badge pin-badge-inactive";
        el.setAttribute("data-stop-id", p.id);
        el.textContent = String(p.order);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onPinTap(p.id);
        });
        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([p.lng, p.lat])
          .addTo(map);
        pinMarkers.current.push(marker);
      });

      // route line
      const source = map.getSource(ROUTE_SRC) as mapboxgl.GeoJSONSource | undefined;
      const data = {
        type: "Feature" as const,
        properties: {},
        geometry: day.routePolyline,
      };
      if (source) {
        source.setData(data as GeoJSON.Feature);
      } else {
        map.addSource(ROUTE_SRC, {
          type: "geojson",
          data: data as GeoJSON.Feature,
        });
        map.addLayer({
          id: ROUTE_LAYER_SHADOW,
          type: "line",
          source: ROUTE_SRC,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#000",
            "line-width": 6,
            "line-opacity": 0.12,
            "line-blur": 4,
          },
        });
        map.addLayer({
          id: ROUTE_LAYER,
          type: "line",
          source: ROUTE_SRC,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#ffffff",
            "line-width": 3.5,
          },
        });
      }

      // fit bounds
      if (stopsWithPoints.length === 0) return;
      if (stopsWithPoints.length === 1) {
        map.flyTo({
          center: [stopsWithPoints[0].lng, stopsWithPoints[0].lat],
          zoom: 14,
          duration: 1200,
          essential: true,
        });
        return;
      }
      const lngs = stopsWithPoints.map((s) => s.lng);
      const lats = stopsWithPoints.map((s) => s.lat);
      const bounds: LngLatBoundsLike = [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ];
      map.fitBounds(bounds, {
        padding: {
          top: 80,
          left: 24,
          right: 24,
          bottom: sheetOpen ? sheetHeightPx + 24 : 80,
        },
        maxZoom: 15,
        duration: 1200,
        essential: true,
      });
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.id, stopsWithPoints]);

  // re-fit when sheet opens/closes — pins shouldn't get covered.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || stopsWithPoints.length === 0) return;
    if (stopsWithPoints.length === 1) return;
    const lngs = stopsWithPoints.map((s) => s.lng);
    const lats = stopsWithPoints.map((s) => s.lat);
    const bounds: LngLatBoundsLike = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];
    map.fitBounds(bounds, {
      padding: {
        top: 80,
        left: 24,
        right: 24,
        bottom: sheetOpen ? sheetHeightPx + 24 : 80,
      },
      maxZoom: 15,
      duration: 600,
      essential: true,
    });
  }, [sheetOpen, sheetHeightPx, stopsWithPoints]);

  // selected-pin styling
  useEffect(() => {
    pinMarkers.current.forEach((marker) => {
      const el = marker.getElement();
      const id = el.getAttribute("data-stop-id");
      if (!id) return;
      const isActive = id === selectedStopId;
      el.classList.toggle("pin-badge-active", isActive);
      el.classList.toggle("pin-badge-inactive", !isActive);
      el.style.zIndex = isActive ? "10" : "1";
      el.style.transform = `${isActive ? "scale(1.15)" : "scale(1)"}`;
      el.style.transition = "transform 180ms cubic-bezier(0.4, 0, 0.2, 1)";
    });
  }, [selectedStopId, day.id]);

  // geolocation dot
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!geo) {
      geoMarker.current?.remove();
      geoMarker.current = null;
      return;
    }
    if (!geoMarker.current) {
      const el = document.createElement("div");
      el.style.width = "16px";
      el.style.height = "16px";
      el.style.borderRadius = "9999px";
      el.style.background = "#0a84ff";
      el.style.boxShadow =
        "0 0 0 4px rgba(10,132,255,0.25), 0 0 0 2px #fff";
      geoMarker.current = new mapboxgl.Marker({ element: el }).setLngLat([
        geo.lng,
        geo.lat,
      ]);
      const apply = () => geoMarker.current?.addTo(map);
      if (map.isStyleLoaded()) apply();
      else map.once("load", apply);
    } else {
      geoMarker.current.setLngLat([geo.lng, geo.lat]);
    }
  }, [geo]);

  if (!token) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-parchment px-6 text-center">
        <div className="max-w-sm text-ink-80">
          <p className="text-display-sm font-display text-ink mb-3">
            Map needs a token
          </p>
          <p className="text-body">
            Add{" "}
            <code className="rounded bg-white px-1.5 py-0.5 ring-1 ring-hairline">
              NEXT_PUBLIC_MAPBOX_TOKEN
            </code>{" "}
            to <code>.env.local</code> and reload.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
