"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import type { FavoriteRoute } from "@torpreca/shared";
import { Eye, EyeOff, Map as MapIcon, MapPin, RotateCcw, Search, X } from "lucide-react";
import { useRef, useState } from "react";
import { Map as MapboxMap, type MapMouseEvent, type MapRef, Marker } from "react-map-gl/mapbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useFavoriteRoutes } from "@/lib/hooks/use-favorite-routes";
import {
  hideFavoriteRoute,
  readHiddenFavoriteRouteIds,
  unhideFavoriteRoute,
} from "@/lib/preferences/hidden-favorite-routes";
import { readStoredMapStyle } from "@/lib/preferences/map-style";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

// Same operating-area default as the live map in app/(protected)/page.tsx.
// TODO: add this to a settings page so it can be changed to set an initial view on the maps
const INITIAL_VIEW = { longitude: -90.5069, latitude: 14.6349, zoom: 11 };

type LngLat = { lng: number; lat: number };
type PointRole = "origin" | "destination";

function metersToKm(meters: number): number {
  return Math.round(meters / 10) / 100;
}

function PointMarker({ role }: { role: PointRole }) {
  const colorClass = role === "origin" ? "text-primary" : "text-error";
  return (
    <div className="relative flex flex-col items-center">
      <span
        className={`absolute -top-4 rounded-full border border-white px-1 text-[10px] font-bold text-white shadow ${role === "origin" ? "bg-primary" : "bg-error"}`}
      >
        {role === "origin" ? "A" : "B"}
      </span>
      <MapPin size={34} className={`${colorClass} drop-shadow-lg`} fill="currentColor" strokeWidth={1.5} />
    </div>
  );
}

export function RouteKmCalculatorDialog({ onApply }: { onApply: (km: number) => void }) {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<LngLat | null>(null);
  const [destination, setDestination] = useState<LngLat | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [favoriteLabel, setFavoriteLabel] = useState("");
  const [originQuery, setOriginQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [geocoding, setGeocoding] = useState<PointRole | null>(null);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>(() => readHiddenFavoriteRouteIds());
  const [showHidden, setShowHidden] = useState(false);

  const mapRef = useRef<MapRef>(null);
  const { favoriteRoutes, error: favoritesError, createFavoriteRoute, deleteFavoriteRoute } =
    useFavoriteRoutes();
  const mapStyle = readStoredMapStyle();

  const hiddenCount = (favoriteRoutes ?? []).filter((f) => hiddenIds.includes(f.id)).length;
  const visibleFavorites = (favoriteRoutes ?? []).filter(
    (f) => showHidden || !hiddenIds.includes(f.id),
  );

  // ~1m precision — tolerates float noise from re-clicking/re-searching the
  // "same" spot without treating two genuinely different points as equal.
  const roundCoord = (n: number) => Math.round(n * 100000) / 100000;
  const pointsMatch = (a: LngLat, b: LngLat) =>
    roundCoord(a.lat) === roundCoord(b.lat) && roundCoord(a.lng) === roundCoord(b.lng);
  const duplicateFavorite =
    origin && destination
      ? (favoriteRoutes ?? []).find(
          (f) =>
            pointsMatch(origin, { lng: f.originLng, lat: f.originLat }) &&
            pointsMatch(destination, { lng: f.destinationLng, lat: f.destinationLat }),
        )
      : undefined;

  function reset() {
    setOrigin(null);
    setDestination(null);
    setDistanceKm(null);
    setCalcError(null);
    setFavoriteLabel("");
    setOriginQuery("");
    setDestinationQuery("");
    setGeocodeError(null);
  }

  async function fetchDistance(a: LngLat, b: LngLat) {
    setCalculating(true);
    setCalcError(null);
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=simplified&access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url);
      const data = (await res.json()) as {
        code: string;
        routes?: { distance: number }[];
        message?: string;
      };
      if (!res.ok || data.code !== "Ok" || !data.routes?.[0]) {
        throw new Error(data.message ?? "No se pudo calcular la ruta entre esos dos puntos.");
      }
      setDistanceKm(metersToKm(data.routes[0].distance));
    } catch {
      setCalcError("No se pudo calcular la distancia. Verifica los puntos e intenta de nuevo.");
    } finally {
      setCalculating(false);
    }
  }

  // Shared by map clicks and the address search below — whichever sets the
  // second point triggers the Directions call.
  function commitPoint(role: PointRole, point: LngLat, opts: { fly?: boolean } = {}) {
    if (role === "origin") {
      setOrigin(point);
      if (destination) fetchDistance(point, destination);
    } else {
      setDestination(point);
      if (origin) fetchDistance(origin, point);
    }
    if (opts.fly) {
      mapRef.current?.flyTo({ center: [point.lng, point.lat], zoom: 15, duration: 800 });
    }
  }

  function handleMapClick(e: MapMouseEvent) {
    const point = { lng: e.lngLat.lng, lat: e.lngLat.lat };
    if (!origin) commitPoint("origin", point);
    else if (!destination) commitPoint("destination", point);
  }

  async function searchAddress(role: PointRole) {
    const query = (role === "origin" ? originQuery : destinationQuery).trim();
    if (!query) return;
    setGeocoding(role);
    setGeocodeError(null);
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=gt&proximity=${INITIAL_VIEW.longitude},${INITIAL_VIEW.latitude}&limit=1`;
      const res = await fetch(url);
      const data = (await res.json()) as { features?: { center: [number, number] }[] };
      const feature = data.features?.[0];
      if (!res.ok || !feature) throw new Error("not found");
      commitPoint(role, { lng: feature.center[0], lat: feature.center[1] }, { fly: true });
    } catch {
      setGeocodeError(
        role === "origin"
          ? "No se encontró esa dirección de origen."
          : "No se encontró esa dirección de destino.",
      );
    } finally {
      setGeocoding(null);
    }
  }

  async function reverseGeocode(point: LngLat): Promise<string | null> {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${point.lng},${point.lat}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
      const res = await fetch(url);
      const data = (await res.json()) as { features?: { place_name: string }[] };
      if (!res.ok) return null;
      return data.features?.[0]?.place_name ?? null;
    } catch {
      return null;
    }
  }

  async function applyFavorite(favorite: FavoriteRoute) {
    const originPoint = { lng: favorite.originLng, lat: favorite.originLat };
    const destinationPoint = { lng: favorite.destinationLng, lat: favorite.destinationLat };
    setOrigin(originPoint);
    setDestination(destinationPoint);
    setDistanceKm(favorite.plannedKm);
    setCalcError(null);
    mapRef.current?.flyTo({ center: [originPoint.lng, originPoint.lat], zoom: 13, duration: 800 });

    // Favorites only store coordinates — reverse-geocode both so the address
    // inputs aren't left blank after picking one.
    const [originName, destinationName] = await Promise.all([
      reverseGeocode(originPoint),
      reverseGeocode(destinationPoint),
    ]);
    setOriginQuery(originName ?? "");
    setDestinationQuery(destinationName ?? "");
  }

  function toggleHidden(id: string) {
    setHiddenIds(hiddenIds.includes(id) ? unhideFavoriteRoute(id) : hideFavoriteRoute(id));
  }

  function applyValue() {
    if (distanceKm == null) return;
    onApply(distanceKm);
    setOpen(false);
    reset();
  }

  function saveAndApplyValue() {
    if (distanceKm == null || !origin || !destination || !favoriteLabel.trim()) return;
    if (duplicateFavorite) return;
    createFavoriteRoute.mutate(
      {
        label: favoriteLabel.trim(),
        originLat: origin.lat,
        originLng: origin.lng,
        destinationLat: destination.lat,
        destinationLng: destination.lng,
        plannedKm: distanceKm,
      },
      { onSuccess: () => applyValue() },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-1.5 rounded-md border border-outline px-3 text-sm font-medium text-text transition-opacity hover:opacity-90 cursor-pointer"
        >
          <MapIcon size={14} />
          Calcular en mapa
        </button>
      </DialogTrigger>
      {/* !max-w-6xl (important modifier): DialogContent's base className
          hardcodes max-w-lg in the same template string as this override —
          same-specificity utility classes don't reliably resolve by string
          order, so plain max-w-6xl here was silently losing to it. */}
      <DialogContent className="!max-w-6xl">
        <DialogHeader>
          <DialogTitle>Calcular Km en mapa</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[22rem_1fr]">
          <div className="flex flex-col gap-3">
            {favoritesError && <p className="text-xs text-error">{favoritesError}</p>}

            {favoriteRoutes && favoriteRoutes.length > 0 && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-outline">Favoritas</span>
                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowHidden((v) => !v)}
                      className="text-xs text-outline underline transition-opacity hover:opacity-70 cursor-pointer"
                    >
                      {showHidden ? "Ocultar ocultas" : `Mostrar ocultas (${hiddenCount})`}
                    </button>
                  )}
                </div>
                <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto">
                  {visibleFavorites.map((favorite) => {
                    const isHidden = hiddenIds.includes(favorite.id);
                    return (
                      <li
                        key={favorite.id}
                        className={`flex items-center justify-between gap-1 ${isHidden ? "opacity-50" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => applyFavorite(favorite)}
                          className="flex-1 truncate rounded-md border border-outline/20 px-2 py-1 text-left text-sm text-text transition-colors hover:bg-outline/5 cursor-pointer"
                        >
                          {favorite.label} · {favorite.plannedKm} km
                        </button>
                        <button
                          type="button"
                          aria-label={
                            isHidden
                              ? `Mostrar favorita ${favorite.label}`
                              : `Ocultar favorita ${favorite.label}`
                          }
                          onClick={() => toggleHidden(favorite.id)}
                          className="rounded-md p-1 text-outline transition-opacity hover:opacity-70 cursor-pointer"
                        >
                          {isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button
                          type="button"
                          aria-label={`Borrar favorita ${favorite.label}`}
                          onClick={() => deleteFavoriteRoute.mutate(favorite.id)}
                          className="rounded-md p-1 text-outline transition-opacity hover:opacity-70 cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label htmlFor="originQuery" className="text-xs text-outline">
                Dirección de origen (opcional — también puedes hacer clic en el mapa)
              </label>
              <div className="flex gap-2">
                <Input
                  id="originQuery"
                  value={originQuery}
                  onChange={(e) => setOriginQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      searchAddress("origin");
                    }
                  }}
                  placeholder="Ej. Bodega Central, zona 4"
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => searchAddress("origin")}
                  disabled={geocoding === "origin" || !originQuery.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-outline text-text transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  aria-label="Buscar dirección de origen"
                >
                  {geocoding === "origin" ? <Spinner className="h-3.5 w-3.5" /> : <Search size={14} />}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="destinationQuery" className="text-xs text-outline">
                Dirección de destino (opcional)
              </label>
              <div className="flex gap-2">
                <Input
                  id="destinationQuery"
                  value={destinationQuery}
                  onChange={(e) => setDestinationQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      searchAddress("destination");
                    }
                  }}
                  placeholder="Ej. 5ta avenida, zona 1"
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => searchAddress("destination")}
                  disabled={geocoding === "destination" || !destinationQuery.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-outline text-text transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  aria-label="Buscar dirección de destino"
                >
                  {geocoding === "destination" ? (
                    <Spinner className="h-3.5 w-3.5" />
                  ) : (
                    <Search size={14} />
                  )}
                </button>
              </div>
            </div>
            {geocodeError && <p className="text-xs text-error">{geocodeError}</p>}

            <p className="text-xs text-outline">
              {!origin && "Busca una dirección o haz clic en el mapa para marcar el punto de origen (A)."}
              {origin && !destination && "Ahora busca una dirección o haz clic para marcar el destino (B)."}
              {origin && destination && "Ambos puntos marcados."}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={reset}
                className="flex h-9 items-center gap-1.5 rounded-md border border-outline px-3 text-sm font-medium text-text transition-opacity hover:opacity-90 cursor-pointer"
              >
                <RotateCcw size={14} />
                Reiniciar
              </button>
              {calculating && <span className="text-sm text-outline">Calculando...</span>}
            </div>
            {calcError && <span className="text-sm text-error">{calcError}</span>}
            {distanceKm != null && !calculating && (
              <span className="text-sm font-medium text-text">Distancia: {distanceKm} km</span>
            )}

            {createFavoriteRoute.isError && (
              <p className="text-xs text-error">{createFavoriteRoute.error.message}</p>
            )}
          </div>

          {/* min-w-0: grid items default to min-width:auto (shrink to fit
              content), which starves this column of the 1fr space the track
              should give it — mapbox-gl then sizes its canvas off that
              collapsed width, rendering a narrow strip instead of filling
              the column. */}
          <div className="h-96 w-full min-w-0 overflow-hidden rounded-md lg:h-[36rem]">
            <MapboxMap
              ref={mapRef}
              mapboxAccessToken={MAPBOX_TOKEN}
              initialViewState={INITIAL_VIEW}
              mapStyle={mapStyle}
              onClick={handleMapClick}
            >
              {origin && (
                <Marker longitude={origin.lng} latitude={origin.lat} anchor="bottom">
                  <PointMarker role="origin" />
                </Marker>
              )}
              {destination && (
                <Marker longitude={destination.lng} latitude={destination.lat} anchor="bottom">
                  <PointMarker role="destination" />
                </Marker>
              )}
            </MapboxMap>
          </div>
        </div>

        {duplicateFavorite && (
          <p className="mt-2 text-right text-xs text-error">
            Ya existe la favorita “{duplicateFavorite.label}” con este mismo origen y destino.
          </p>
        )}

        <DialogFooter>
          {distanceKm != null && (
            <>
              {/* sr-only (not a visible label above the input): DialogFooter's
                  row uses items-center — a label stacked above the input would
                  make this child taller than the h-9 buttons, so its center
                  (what items-center aligns to) sits lower than theirs, throwing
                  off the row's vertical alignment. */}
              <label htmlFor="favoriteLabel" className="sr-only">
                Nombre para guardar como favorita (opcional)
              </label>
              <Input
                id="favoriteLabel"
                value={favoriteLabel}
                onChange={(e) => setFavoriteLabel(e.target.value)}
                placeholder="Nombre para guardar como favorita (opcional)"
                className="w-64"
              />
            </>
          )}
          <button
            type="button"
            disabled={
              distanceKm == null ||
              !favoriteLabel.trim() ||
              !!duplicateFavorite ||
              createFavoriteRoute.isPending
            }
            onClick={saveAndApplyValue}
            className="flex h-9 items-center gap-1.5 rounded-md border border-outline px-3 text-sm font-medium text-text transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {createFavoriteRoute.isPending && <Spinner className="h-3.5 w-3.5" />}
            Guardar como favorita y usar
          </button>
          <button
            type="button"
            disabled={distanceKm == null}
            onClick={applyValue}
            className="flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            Usar este valor
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
