"use client";

import {
  businessDate,
  DuplicateRouteSchema,
  type Route,
  type User,
  type Vehicle,
} from "@torpreca/shared";
import { Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { Spinner } from "@/components/ui/spinner";
import type { useRoutes } from "@/lib/hooks/use-routes";
import { useStops } from "@/lib/hooks/use-stops";
import { useTranslation } from "@/lib/i18n/use-translation";
import { type DraftStop, RouteStopsEditor, toStopInputs } from "./route-stops-editor";

// "Duplicar" — the way to reschedule a route that wasn't completed (those are
// read-only) or to repeat one on another day. Creates a *new* pending route
// from the source's stops: they're loaded into a local list where they can be
// removed, reordered and added to before anything is sent, and the backend
// then creates the route and every stop in one request. The stops always
// start over as pending, whatever state the source's were in.
export function DuplicateRouteDialog({
  route,
  drivers,
  vehicles,
  duplicateRoute,
}: {
  route: Route;
  drivers: User[];
  vehicles: Vehicle[];
  duplicateRoute: ReturnType<typeof useRoutes>["duplicateRoute"];
}) {
  const { t } = useTranslation();
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

  function resetAll() {
    setDate(businessDate());
    setDriverId(route.driverId);
    setVehicleId(route.vehicleId);
    setPlannedKm(route.plannedKm?.toString() ?? "");
    setDraft([]);
    setSubmitted(false);
    duplicateRoute.reset();
  }

  const parsedKm = plannedKm.trim() === "" ? null : Number(plannedKm);

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);

    // Same schema the backend validates against.
    const parsed = DuplicateRouteSchema.safeParse({
      driverId,
      vehicleId,
      date,
      plannedKm: parsedKm,
      // The copy keeps the source's A/B so the live map can still draw them.
      originLat: route.originLat ?? null,
      originLng: route.originLng ?? null,
      destinationLat: route.destinationLat ?? null,
      destinationLng: route.destinationLng ?? null,
      stops: toStopInputs(draft),
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

        <form id="dup-form" onSubmit={handleCreate} noValidate className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start gap-3">
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

        </form>

        <RouteStopsEditor
          idPrefix="dup"
          stops={draft}
          onChange={setDraft}
          loading={isLoading}
          loadingLabel={t.duplicateRoute.loadingStops}
          title={t.duplicateRoute.stopsTitle}
          emptyText={t.duplicateRoute.noStops}
          addTitle={t.duplicateRoute.addTitle}
          addLabel={t.duplicateRoute.add}
        />

        <div className="flex justify-end">
          <button
            type="submit"
            form="dup-form"
            disabled={duplicateRoute.isPending}
            className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {duplicateRoute.isPending && <Spinner className="h-3.5 w-3.5" />}
            {duplicateRoute.isPending ? t.duplicateRoute.creating : t.duplicateRoute.create}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
