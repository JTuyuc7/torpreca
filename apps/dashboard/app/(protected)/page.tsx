"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import type { Route } from "@torpreca/shared";
import { Circle } from "lucide-react";
import { useRef, useState } from "react";
import { Map as MapboxMap, type MapRef, Marker } from "react-map-gl/mapbox";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Section } from "@/components/ui/section";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardSummary } from "@/lib/hooks/use-dashboard-summary";
import { useLiveLocations } from "@/lib/hooks/use-live-locations";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { useRoutes } from "@/lib/hooks/use-routes";
import { useUsers } from "@/lib/hooks/use-users";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

// Guatemala City — Torpreca's operating area. Just a sane default center for
// an empty map; it re-centers on nothing in particular until a route in the
// side list is clicked (see focusOnDriver below).
const INITIAL_VIEW = { longitude: -90.5069, latitude: 14.6349, zoom: 11 };

const MAP_STYLES = [
  { label: "Calles", value: "mapbox://styles/mapbox/streets-v12" },
  { label: "Satélite", value: "mapbox://styles/mapbox/satellite-streets-v12" },
  { label: "Oscuro", value: "mapbox://styles/mapbox/dark-v11" },
] as const;

const STATUS_LABEL: Record<ReturnType<typeof useLiveLocations>["status"], string> = {
  connecting: "Conectando...",
  connected: "En vivo",
  error: "Sin conexión",
};

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-outline/20 bg-surface p-4">
      <span className="text-xs text-outline">{label}</span>
      <span className="text-2xl font-semibold text-text">{value}</span>
    </div>
  );
}

function ActiveRoutesList({
  routes,
  driverNames,
  hasLocation,
  selectedDriverId,
  onSelect,
}: {
  routes: Route[];
  driverNames: Map<string, string>;
  hasLocation: (driverId: string) => boolean;
  selectedDriverId: string | null;
  onSelect: (driverId: string) => void;
}) {
  if (routes.length === 0) {
    return <p className="text-sm text-outline">No hay rutas en curso ahora mismo.</p>;
  }

  return (
    <ul className="flex flex-col gap-1">
      {routes.map((route) => {
        const online = hasLocation(route.driverId);
        return (
          <li key={route.id}>
            <button
              type="button"
              onClick={() => onSelect(route.driverId)}
              disabled={!online}
              title={online ? undefined : "Sin ubicación reciente de este conductor"}
              className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                selectedDriverId === route.driverId
                  ? "border-primary bg-primary/10"
                  : "border-outline/20 hover:bg-outline/5"
              }`}
            >
              <span className="flex flex-col">
                <span className="font-medium text-text">{route.code}</span>
                <span className="text-xs text-outline">
                  {driverNames.get(route.driverId) ?? route.driverId}
                </span>
              </span>
              <Circle
                size={8}
                className={online ? "fill-primary text-primary" : "fill-outline text-outline"}
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default function HomePage() {
  usePageTitle("Panel principal");
  const { summary, isLoading, error } = useDashboardSummary();
  const { locations, status } = useLiveLocations();
  const { routes } = useRoutes();
  const { users } = useUsers();

  const [mapStyle, setMapStyle] = useState<(typeof MAP_STYLES)[number]["value"]>(
    MAP_STYLES[0].value,
  );
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const mapRef = useRef<MapRef>(null);

  const driverNames = new Map((users ?? []).map((u) => [u.id, u.name]));
  const activeRoutes = (routes ?? []).filter((r) => r.status === "in_progress");
  const locationByDriver = new Map(locations.map((l) => [l.driverId, l]));

  function focusOnDriver(driverId: string) {
    const location = locationByDriver.get(driverId);
    if (!location) return;
    setSelectedDriverId(driverId);
    mapRef.current?.flyTo({ center: [location.lng, location.lat], zoom: 15, duration: 800 });
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl text-text">Panel principal</h1>
        <p className="text-sm text-outline">Estado de la flota en tiempo real.</p>
      </div>

      {error && <ErrorBanner message={error} />}

      {isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            // Fixed-size skeleton grid, not data-driven — safe to key by
            // position since nothing here is ever reordered or removed.
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 animate-fade-in">
          <MetricCard label="Rutas en progreso" value={summary.routesInProgress} />
          <MetricCard label="Rutas pendientes hoy" value={summary.routesPendingToday} />
          <MetricCard label="Conductores en línea" value={summary.driversOnline} />
          <MetricCard label="Conductores activos" value={summary.driversActive} />
          <MetricCard label="Vehículos activos" value={summary.vehiclesActive} />
        </div>
      )}

      <Section title="Mapa en vivo">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-outline">
            <Circle
              size={8}
              className={
                status === "connected"
                  ? "fill-primary text-primary"
                  : status === "error"
                    ? "fill-error text-error"
                    : "fill-outline text-outline"
              }
            />
            {STATUS_LABEL[status]}
          </div>
          <Select
            aria-label="Tipo de mapa"
            className="w-36"
            value={mapStyle}
            onChange={(e) => setMapStyle(e.target.value as (typeof MAP_STYLES)[number]["value"])}
          >
            {MAP_STYLES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="h-[28rem] flex-1 overflow-hidden rounded-md">
            <MapboxMap
              ref={mapRef}
              mapboxAccessToken={MAPBOX_TOKEN}
              initialViewState={INITIAL_VIEW}
              mapStyle={mapStyle}
            >
              {locations.map((location) => (
                <Marker key={location.driverId} longitude={location.lng} latitude={location.lat}>
                  <div
                    title={driverNames.get(location.driverId) ?? location.driverId}
                    className={`rounded-full border-2 border-white shadow transition-all ${
                      selectedDriverId === location.driverId
                        ? "h-5 w-5 bg-secondary"
                        : "h-3.5 w-3.5 bg-primary"
                    }`}
                  />
                </Marker>
              ))}
            </MapboxMap>
          </div>
          <div className="flex w-full flex-col gap-2 lg:w-64">
            <h3 className="text-xs font-medium text-outline">Rutas en curso</h3>
            <ActiveRoutesList
              routes={activeRoutes}
              driverNames={driverNames}
              hasLocation={(driverId) => locationByDriver.has(driverId)}
              selectedDriverId={selectedDriverId}
              onSelect={focusOnDriver}
            />
          </div>
        </div>
      </Section>
    </div>
  );
}