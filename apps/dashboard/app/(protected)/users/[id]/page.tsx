"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import { ArrowLeft, MapPin, Route as RouteIcon, UserX } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Map as MapboxMap, Marker } from "react-map-gl/mapbox";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { RouteStatusBadge } from "@/components/ui/route-status-badge";
import { Section } from "@/components/ui/section";
import { Skeleton } from "@/components/ui/skeleton";
import { useLiveLocations } from "@/lib/hooks/use-live-locations";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { useRoutes } from "@/lib/hooks/use-routes";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useUsers } from "@/lib/hooks/use-users";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

function BackLink() {
  const { t } = useTranslation();
  return (
    <Link
      href="/users"
      className="mb-2 inline-flex items-center gap-1 text-sm text-outline hover:underline"
    >
      <ArrowLeft size={14} />
      {t.driverDetail.backLink}
    </Link>
  );
}

// TOR-33 — "Detalle de conductor": reached by clicking a driver's name in
// "Todos los usuarios" (TOR-31 deliberately left rows non-clickable "for
// now", waiting on this ticket). First dynamic page route in the dashboard —
// reuses useUsers/useRoutes/useLiveLocations exactly as already cached by
// the rest of the app instead of adding a dedicated GET /users/:id call;
// filtering client-side by driverId mirrors how rutas/vehiculos already
// cross-reference these same lists.
export default function DriverDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { users, isLoading: usersLoading, error: usersError } = useUsers();
  const { routes, isLoading: routesLoading, error: routesError } = useRoutes();
  const { locations } = useLiveLocations();

  const driver = users?.find((u) => u.id === id);
  usePageTitle(driver ? `${t.driverDetail.pageTitleFallback}: ${driver.name}` : t.driverDetail.pageTitleFallback);

  if (usersLoading || routesLoading) {
    return (
      <div
        className="flex flex-1 flex-col gap-6 p-6"
        aria-busy="true"
        aria-label={t.driverDetail.loadingLabel}
      >
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (usersError || routesError) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <BackLink />
        <ErrorBanner message={usersError ?? routesError ?? t.driverDetail.loadErrorFallback} />
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <BackLink />
        <EmptyState
          icon={UserX}
          title={t.driverDetail.notFoundTitle}
          description={t.driverDetail.notFoundDescription}
          action={{ label: t.driverDetail.backToUsers, href: "/users" }}
        />
      </div>
    );
  }

  if (driver.role !== "driver") {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <BackLink />
        <EmptyState
          icon={UserX}
          title={t.driverDetail.notADriverTitle}
          description={`${driver.name} es ${driver.role}.`}
          action={{ label: t.driverDetail.backToUsers, href: "/users" }}
        />
      </div>
    );
  }

  const location = locations.find((l) => l.driverId === driver.id);
  const driverRoutes = (routes ?? [])
    .filter((r) => r.driverId === driver.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <BackLink />
        <h1 className="text-xl text-text">{driver.name}</h1>
        <p className="text-sm text-outline">{driver.email}</p>
      </div>

      <Section title={t.driverDetail.liveLocation}>
        {location ? (
          <div className="h-72 overflow-hidden rounded-md">
            <MapboxMap
              mapboxAccessToken={MAPBOX_TOKEN}
              initialViewState={{ longitude: location.lng, latitude: location.lat, zoom: 14 }}
              mapStyle="mapbox://styles/mapbox/streets-v12"
            >
              <Marker longitude={location.lng} latitude={location.lat}>
                <div className="h-4 w-4 rounded-full border-2 border-white bg-primary shadow" />
              </Marker>
            </MapboxMap>
          </div>
        ) : (
          <EmptyState
            icon={MapPin}
            compact
            title={t.driverDetail.noRecentLocationTitle}
            description={t.driverDetail.noRecentLocationDescription}
          />
        )}
      </Section>

      <Section title={t.driverDetail.routeHistory}>
        {driverRoutes.length === 0 ? (
          <EmptyState icon={RouteIcon} compact title={t.driverDetail.noRoutesYet} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-outline/30 text-xs text-outline">
                  <th className="py-2 pr-4">{t.driverDetail.tableCode}</th>
                  <th className="py-2 pr-4">{t.driverDetail.tableDate}</th>
                  <th className="py-2 pr-4">{t.driverDetail.tableStatus}</th>
                  <th className="py-2 pr-4">{t.driverDetail.tableKm}</th>
                </tr>
              </thead>
              <tbody>
                {driverRoutes.map((route) => (
                  <tr key={route.id} className="border-b border-outline/10 text-text">
                    <td className="py-2.5 pr-4 font-medium">{route.code}</td>
                    <td className="py-2.5 pr-4">{route.date}</td>
                    <td className="py-2.5 pr-4">
                      <RouteStatusBadge status={route.status} />
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums">
                      {route.plannedKm ?? "—"} / {route.drivenKm}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
