"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import type { Route } from "@torpreca/shared";
import { Circle, Route as RouteIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Map as MapboxMap, type MapRef, Marker } from "react-map-gl/mapbox";
import { useAuthUser } from "@/app/(protected)/auth-context";
import { AddressSearch } from "@/components/ui/address-search";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Section } from "@/components/ui/section";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardSummary } from "@/lib/hooks/use-dashboard-summary";
import { useLiveLocations } from "@/lib/hooks/use-live-locations";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { useRoutes } from "@/lib/hooks/use-routes";
import { useUsers } from "@/lib/hooks/use-users";
import { useTranslation } from "@/lib/i18n/use-translation";
import { MAP_STYLES } from "@/lib/map/styles";
import { readStoredMapStyle, writeStoredMapStyle } from "@/lib/preferences/map-style";
import { usePreferences } from "@/lib/preferences/preferences-context";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

// Guatemala City — Torpreca's operating area. Just a sane default center for
// an empty map when the viewer has no saved preference yet (TOR-131's
// "Guardar vista actual" button, below); re-centers on nothing in particular
// until a route in the side list is clicked (see focusOnDriver below).
const DEFAULT_VIEW = { longitude: -90.5069, latitude: 14.6349, zoom: 11 };

const MAP_VIEW_ROLES = new Set(["admin", "supervisor", "super_admin"]);

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
  const { t } = useTranslation();

  if (routes.length === 0) {
    return (
      <EmptyState
        icon={RouteIcon}
        title={t.panel.noRoutesInProgressTitle}
        description={t.panel.noRoutesInProgressDescription}
        action={{ label: t.panel.goToRoutes, href: "/rutas" }}
        compact
      />
    );
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
              title={online ? undefined : t.panel.noRecentLocationTitle}
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
  const { t, language } = useTranslation();
  usePageTitle(t.panel.title);
  const { summary, isLoading, error } = useDashboardSummary();
  const { locations, status } = useLiveLocations();
  const { routes } = useRoutes();
  const { users } = useUsers();
  const { defaultMapView, saveDefaultMapView } = usePreferences();
  const role = useAuthUser()?.role;
  const canSaveMapView = !!role && MAP_VIEW_ROLES.has(role);

  const STATUS_LABEL: Record<ReturnType<typeof useLiveLocations>["status"], string> = {
    connecting: t.panel.statusConnecting,
    connected: t.panel.statusConnected,
    error: t.panel.statusError,
  };

  // Lazy initializer: reads localStorage once on mount, not on every render.
  const [mapStyle, setMapStyle] = useState<(typeof MAP_STYLES)[number]["value"]>(() =>
    readStoredMapStyle(),
  );
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [searchedAddress, setSearchedAddress] = useState<{
    lng: number;
    lat: number;
    name: string;
  } | null>(null);
  const [savedViewNotice, setSavedViewNotice] = useState(false);
  const mapRef = useRef<MapRef>(null);

  // TOR-131: initialViewState only applies once, at mount — usePreferences()
  // resolves this from localStorage synchronously on a returning visit (see
  // preferences-context.tsx), so this is only ever the Guatemala City
  // fallback on a device/browser that has never saved a preference yet.
  const initialView = defaultMapView
    ? { longitude: defaultMapView.lng, latitude: defaultMapView.lat, zoom: defaultMapView.zoom }
    : DEFAULT_VIEW;

  const driverNames = new Map((users ?? []).map((u) => [u.id, u.name]));
  const activeRoutes = (routes ?? []).filter((r) => r.status === "in_progress");
  const locationByDriver = new Map(locations.map((l) => [l.driverId, l]));

  function handleSaveCurrentView() {
    const map = mapRef.current;
    if (!map) return;
    const center = map.getCenter();
    saveDefaultMapView({ lat: center.lat, lng: center.lng, zoom: map.getZoom() });
    setSavedViewNotice(true);
    setTimeout(() => setSavedViewNotice(false), 3000);
  }

  function focusOnDriver(driverId: string) {
    const location = locationByDriver.get(driverId);
    if (!location) return;
    setSelectedDriverId(driverId);
    setSearchedAddress(null);
    mapRef.current?.flyTo({ center: [location.lng, location.lat], zoom: 15, duration: 800 });
  }

  function focusOnAddress(coordinates: { lng: number; lat: number }, name: string) {
    setSelectedDriverId(null);
    setSearchedAddress({ ...coordinates, name });
    mapRef.current?.flyTo({ center: [coordinates.lng, coordinates.lat], zoom: 15, duration: 800 });
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl text-text">{t.panel.title}</h1>
        <p className="text-sm text-outline">{t.panel.subtitle}</p>
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
          <MetricCard label={t.panel.routesInProgress} value={summary.routesInProgress} />
          <MetricCard label={t.panel.routesPendingToday} value={summary.routesPendingToday} />
          <MetricCard label={t.panel.driversOnline} value={summary.driversOnline} />
          <MetricCard label={t.panel.driversActive} value={summary.driversActive} />
          <MetricCard label={t.panel.vehiclesActive} value={summary.vehiclesActive} />
        </div>
      )}

      <Section title={t.panel.liveMap}>
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
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
            <div className="w-full sm:w-64">
              <AddressSearch
                accessToken={MAPBOX_TOKEN}
                proximity={{ lng: DEFAULT_VIEW.longitude, lat: DEFAULT_VIEW.latitude }}
                onSelect={focusOnAddress}
                placeholder={t.panel.addressSearchPlaceholder}
                language={language}
              />
            </div>
            <Select
              aria-label={t.panel.mapTypeLabel}
              className="w-36"
              value={mapStyle}
              onChange={(e) => {
                const next = e.target.value as (typeof MAP_STYLES)[number]["value"];
                setMapStyle(next);
                writeStoredMapStyle(next);
              }}
            >
              {MAP_STYLES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
            {canSaveMapView && (
              <button
                type="button"
                onClick={handleSaveCurrentView}
                className="flex h-9 items-center whitespace-nowrap rounded-md border border-outline px-3 text-sm font-medium text-text transition-opacity hover:opacity-90 cursor-pointer"
              >
                {savedViewNotice ? t.panel.savedView : t.panel.saveCurrentView}
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="h-[28rem] flex-1 overflow-hidden rounded-md">
            <MapboxMap
              ref={mapRef}
              mapboxAccessToken={MAPBOX_TOKEN}
              initialViewState={initialView}
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
              {searchedAddress && (
                <Marker longitude={searchedAddress.lng} latitude={searchedAddress.lat}>
                  <div
                    title={searchedAddress.name}
                    className="h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-secondary shadow"
                  />
                </Marker>
              )}
            </MapboxMap>
          </div>
          <div className="flex w-full flex-col gap-2 lg:w-64">
            <h3 className="text-xs font-medium text-outline">{t.panel.routesInCourse}</h3>
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