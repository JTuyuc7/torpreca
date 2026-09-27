"use client";

import {
  businessDate,
  DuplicateRouteSchema,
  type Route,
  type UpdateStopInput,
  type User,
  type Vehicle,
} from "@torpreca/shared";
import { ArrowDown, ArrowUp, Copy, MapPin, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AddressSearch } from "@/components/ui/address-search";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { useRoutes } from "@/lib/hooks/use-routes";
import { useStops } from "@/lib/hooks/use-stops";
import { useTranslation } from "@/lib/i18n/use-translation";
import { generateRouteCode } from "./route-code";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

// Same operating-area default as route-stops-dialog.tsx.
const SEARCH_PROXIMITY = { lng: -90.5069, lat: 14.6349 };

const iconButtonClass =
  "flex h-8 w-8 items-center justify-center rounded-md border border-outline text-text transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";

// A stop in the list being built. `key` only exists so React can keep rows
// stable while they're reordered/removed — the stops have no ids yet.
type DraftStop = UpdateStopInput & { key: string };

type Place = { lat: number; lng: number; address: string };

// "Duplicar" — the way to reschedule a route that wasn't completed (those are
// read-only) or to repeat one on another day. Creates a *new* pending route
// from the source's stops: they're loaded into a local list where they can be
// removed, reordered and added to before anything is sent, and the backend
// then creates the route and every stop in one request. The stops always
// start over as pending, whatever state the source's were in.
export function DuplicateRouteDialog({
  route,
  routes,
  drivers,
  vehicles,
  duplicateRoute,
}: {
  route: Route;
  routes: Route[];
  drivers: User[];
  vehicles: Vehicle[];
  duplicateRoute: ReturnType<typeof useRoutes>["duplicateRoute"];
}) {
  const { t, language } = useTranslation();
  const [open, setOpen] = useState(false);
  const {
    stops: sourceStops,
    isLoading,
    error,
    refetch,
  } = useStops(route.id, open);

  const [date, setDate] = useState(businessDate);
  const [driverId, setDriverId] = useState(route.driverId);
  const [vehicleId, setVehicleId] = useState<string | null>(route.vehicleId);
  const [plannedKm, setPlannedKm] = useState(route.plannedKm?.toString() ?? "");
  const [draft, setDraft] = useState<DraftStop[]>([]);
  const [submitted, setSubmitted] = useState(false);

  // Fill the list once per opening, when the source's stops arrive — not on
  // every refetch, which would throw away the user's edits.
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      loadedRef.current = false;
      return;
    }
    if (loadedRef.current || sourceStops === undefined) return;
    loadedRef.current = true;
    setDraft(
      sourceStops.map(({ customerName, address, lat, lng, instructions }) => ({
        key: crypto.randomUUID(),
        customerName,
        address,
        lat,
        lng,
        instructions,
      })),
    );
  }, [open, sourceStops]);

  // New-stop mini form (same fields as the stops dialog's).
  const [customerName, setCustomerName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [place, setPlace] = useState<Place | null>(null);
  const [stopSubmitted, setStopSubmitted] = useState(false);
  // Bumped to remount <AddressSearch>, which keeps its own input text.
  const [searchKey, setSearchKey] = useState(0);

  function resetStopForm() {
    setCustomerName("");
    setInstructions("");
    setPlace(null);
    setStopSubmitted(false);
    setSearchKey((k) => k + 1);
  }

  function resetAll() {
    setDate(businessDate());
    setDriverId(route.driverId);
    setVehicleId(route.vehicleId);
    setPlannedKm(route.plannedKm?.toString() ?? "");
    setDraft([]);
    setSubmitted(false);
    resetStopForm();
    duplicateRoute.reset();
  }

  function addStop(event: React.FormEvent) {
    event.preventDefault();
    setStopSubmitted(true);
    const name = customerName.trim();
    if (!name || !place) return;
    setDraft((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        customerName: name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        instructions: instructions.trim() || null,
      },
    ]);
    resetStopForm();
  }

  function move(index: number, delta: -1 | 1) {
    setDraft((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target] as DraftStop, next[index] as DraftStop];
      return next;
    });
  }

  const code = generateRouteCode(date, routes.filter((r) => r.date === date).length);
  const parsedKm = plannedKm.trim() === "" ? null : Number(plannedKm);

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);

    // Same schema the backend validates against.
    const parsed = DuplicateRouteSchema.safeParse({
      code,
      driverId,
      vehicleId,
      date,
      plannedKm: parsedKm,
      stops: draft.map((s) => ({
        customerName: s.customerName,
        address: s.address,
        lat: s.lat,
        lng: s.lng,
        instructions: s.instructions,
      })),
    });
    if (!parsed.success) return;

    duplicateRoute.mutate(
      { id: route.id, input: parsed.data },
      {
        onSuccess: () => {
          setOpen(false);
          resetAll();
        },
      },
    );
  }

  const dateInvalid = submitted && !date;
  const driverInvalid = submitted && !driverId;
  const kmInvalid = submitted && parsedKm !== null && !(Number.isFinite(parsedKm) && parsedKm >= 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetAll();
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-1.5 rounded-md border border-outline px-3 text-sm font-medium text-text transition-opacity hover:opacity-90 cursor-pointer"
        >
          <Copy size={14} />
          {t.duplicateRoute.trigger}
        </button>
      </DialogTrigger>
      <DialogContent className="!max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t.duplicateRoute.title} · {route.code}
          </DialogTitle>
          <DialogDescription>{t.duplicateRoute.description}</DialogDescription>
        </DialogHeader>

        {error && <ErrorBanner message={error} onRetry={() => refetch()} />}
        {duplicateRoute.isError && <ErrorBanner message={duplicateRoute.error.message} />}

        <form onSubmit={handleCreate} noValidate className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="dup-code" className="text-xs text-outline">
                {t.rutas.codeLabel}
              </label>
              <Input
                id="dup-code"
                disabled
                value={code}
                className="w-32 bg-surface text-outline"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="dup-date" className="text-xs text-outline">
                {t.rutas.dateLabel}
              </label>
              <Input
                id="dup-date"
                type="date"
                min={businessDate()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              {dateInvalid && <FieldError>{t.rutas.dateRequired}</FieldError>}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="dup-driver" className="text-xs text-outline">
                {t.rutas.driverLabel}
              </label>
              <Select
                id="dup-driver"
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
              >
                <option value="" disabled>
                  {t.rutas.selectPlaceholder}
                </option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
              {driverInvalid && <FieldError>{t.rutas.driverRequired}</FieldError>}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="dup-vehicle" className="text-xs text-outline">
                {t.rutas.vehicleLabel}
              </label>
              <Select
                id="dup-vehicle"
                value={vehicleId ?? ""}
                onChange={(e) => setVehicleId(e.target.value === "" ? null : e.target.value)}
              >
                <option value="">{t.rutas.noVehicle}</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="dup-km" className="text-xs text-outline">
                {t.rutas.plannedKmLabel}
              </label>
              <Input
                id="dup-km"
                type="number"
                min={0}
                value={plannedKm}
                onChange={(e) => setPlannedKm(e.target.value)}
                className="w-28"
              />
              {kmInvalid && <FieldError>{t.rutas.plannedKmInvalid}</FieldError>}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-text">{t.duplicateRoute.stopsTitle}</h3>

            {isLoading && (
              <div
                className="flex flex-col gap-2"
                aria-busy="true"
                aria-label={t.duplicateRoute.loadingStops}
              >
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            )}

            {!isLoading && draft.length === 0 && (
              <p className="text-sm text-outline">{t.duplicateRoute.noStops}</p>
            )}

            {draft.length > 0 && (
              <ol className="flex max-h-56 flex-col gap-2 overflow-y-auto">
                {draft.map((stop, index) => (
                  <li
                    key={stop.key}
                    className="flex items-center gap-3 rounded-md border border-outline/20 px-3 py-2"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text">{stop.customerName}</p>
                      <p className="truncate text-xs text-outline">{stop.address}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        className={iconButtonClass}
                        aria-label={`${t.stops.moveUp}: ${stop.customerName}`}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className={iconButtonClass}
                        aria-label={`${t.stops.moveDown}: ${stop.customerName}`}
                        disabled={index === draft.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        className={iconButtonClass}
                        aria-label={`${t.stops.delete}: ${stop.customerName}`}
                        onClick={() => setDraft((prev) => prev.filter((s) => s.key !== stop.key))}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="submit"
              disabled={duplicateRoute.isPending}
              className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {duplicateRoute.isPending && <Spinner className="h-3.5 w-3.5" />}
              {duplicateRoute.isPending ? t.duplicateRoute.creating : t.duplicateRoute.create}
            </button>
          </div>
        </form>

        {/* A separate form (not nested): "Agregar a la lista" must not submit
            the route. */}
        <form
          onSubmit={addStop}
          noValidate
          className="flex flex-col gap-3 border-t border-outline/20 pt-4"
        >
          <h3 className="text-sm font-medium text-text">{t.duplicateRoute.addTitle}</h3>

          <div className="flex flex-col gap-1">
            <label htmlFor="dup-stop-customer" className="text-xs text-outline">
              {t.stops.customerLabel}
            </label>
            <Input
              id="dup-stop-customer"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            {stopSubmitted && !customerName.trim() && (
              <FieldError>{t.stops.customerRequired}</FieldError>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-outline">{t.stops.addressLabel}</span>
            <AddressSearch
              key={searchKey}
              accessToken={MAPBOX_TOKEN}
              proximity={SEARCH_PROXIMITY}
              onSelect={(coordinates, placeName) =>
                setPlace({ lat: coordinates.lat, lng: coordinates.lng, address: placeName })
              }
              placeholder={t.stops.addressSearchPlaceholder}
              language={language}
            />
            {place && (
              <p className="flex items-center gap-1.5 text-xs text-text">
                <MapPin size={12} className="shrink-0 text-primary" />
                <span className="truncate">{place.address}</span>
              </p>
            )}
            {stopSubmitted && !place && <FieldError>{t.stops.addressRequired}</FieldError>}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="dup-stop-instructions" className="text-xs text-outline">
              {t.stops.instructionsLabel}
            </label>
            <Textarea
              id="dup-stop-instructions"
              rows={2}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="flex h-9 items-center rounded-md border border-outline px-3 text-sm font-medium text-text transition-opacity hover:opacity-90 cursor-pointer"
            >
              {t.duplicateRoute.add}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
