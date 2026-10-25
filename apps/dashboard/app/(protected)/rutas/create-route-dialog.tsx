"use client";

import {
  businessDate,
  CreateRouteWithStopsSchema,
  type User,
  type Vehicle,
} from "@torpreca/shared";
import { Plus } from "lucide-react";
import { useState } from "react";
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
import { useTranslation } from "@/lib/i18n/use-translation";
import { type CalculatedPoints, RouteKmCalculatorDialog } from "./route-km-calculator-dialog";
import { type DraftStop, RouteStopsEditor, toStopInputs } from "./route-stops-editor";

// "Nueva ruta": the route's fields and its stops in one modal, sent in a
// single request (the backend creates the route and every stop together). The
// stops are optional, but on purpose: leaving the list empty isn't enough, the
// user has to tick "Sin paradas" — so a route without stops is a decision, not
// something forgotten.
//
// The planned km aren't typed: they come from the map calculator, which also
// gives the A/B points the live map draws — a bare number would leave those
// empty. The route code isn't shown either: it's generated for the request and
// only visible once the route exists (it moves to the backend later in TOR-142).
export function CreateRouteDialog({
  drivers,
  vehicles,
  createRoute,
}: {
  drivers: User[];
  vehicles: Vehicle[];
  createRoute: ReturnType<typeof useRoutes>["createRoute"];
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const [date, setDate] = useState(businessDate);
  const [driverId, setDriverId] = useState("");
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [calculated, setCalculated] = useState<{
    km: number;
    points: CalculatedPoints | null;
  } | null>(null);
  const [noStops, setNoStops] = useState(false);
  const [draft, setDraft] = useState<DraftStop[]>([]);

  function resetAll() {
    setDate(businessDate());
    setDriverId("");
    setVehicleId(null);
    setCalculated(null);
    setNoStops(false);
    setDraft([]);
    createRoute.reset();
  }

  const today = businessDate();

  // The button stays disabled until everything is filled in, so there are no
  // per-field "required" messages to show after a failed submit.
  const ready =
    date >= today && driverId !== "" && calculated !== null && (noStops || draft.length > 0);

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;

    // Same schema the backend validates against.
    const parsed = CreateRouteWithStopsSchema.safeParse({
      driverId,
      vehicleId,
      date,
      plannedKm: calculated?.km ?? null,
      originLat: calculated?.points?.origin.lat ?? null,
      originLng: calculated?.points?.origin.lng ?? null,
      destinationLat: calculated?.points?.destination.lat ?? null,
      destinationLng: calculated?.points?.destination.lng ?? null,
      stops: noStops ? [] : toStopInputs(draft),
    });
    if (!parsed.success) return;

    createRoute.mutate(parsed.data, {
      onSuccess: () => {
        setOpen(false);
        resetAll();
      },
    });
  }

  const datePast = date !== "" && date < today;

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
          className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-on-primary transition-opacity hover:opacity-90 cursor-pointer"
        >
          <Plus size={14} />
          {t.createRoute.trigger}
        </button>
      </DialogTrigger>
      {/* No padding on the content itself: the header and footer stay put and
          only the body scrolls, so "Crear ruta" never covers the stop form. */}
      <DialogContent className="flex !max-w-2xl max-h-[90vh] flex-col overflow-hidden !p-0">
        <div className="shrink-0 px-5 pt-5">
          <DialogHeader>
            <DialogTitle>{t.createRoute.title}</DialogTitle>
            <DialogDescription>{t.createRoute.description}</DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-5">
          {createRoute.isError && <ErrorBanner message={createRoute.error.message} />}

          <section className="flex flex-col gap-4 rounded-lg border border-outline/20 p-4">
            <h3 className="text-sm font-semibold text-text">{t.createRoute.routeSection}</h3>

            <form id="create-route-form" onSubmit={handleCreate} noValidate>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="new-date" className="text-xs text-outline">
                    {t.rutas.dateLabel}
                  </label>
                  <Input
                    id="new-date"
                    type="date"
                    min={today}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                  {date === "" && <FieldError>{t.rutas.dateRequired}</FieldError>}
                  {datePast && <FieldError>{t.createRoute.datePast}</FieldError>}
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="new-driver" className="text-xs text-outline">
                    {t.rutas.driverLabel}
                  </label>
                  <Select
                    id="new-driver"
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
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="new-vehicle" className="text-xs text-outline">
                    {t.rutas.vehicleLabel}
                  </label>
                  <Select
                    id="new-vehicle"
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
              </div>
            </form>

            <div className="flex flex-col gap-1 border-t border-outline/20 pt-4">
              <span className="text-xs text-outline">{t.rutas.plannedKmLabel}</span>
              <div className="flex flex-wrap items-center gap-3">
                <RouteKmCalculatorDialog
                  onApply={(km, points) => setCalculated({ km, points })}
                />
                <span className="text-sm text-text">
                  {calculated ? (
                    <>
                      <span className="font-medium tabular-nums">{calculated.km} km</span>
                      {calculated.points && (
                        <span className="text-outline"> · {t.createRoute.withPoints}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-outline">{t.createRoute.kmRequired}</span>
                  )}
                </span>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4 rounded-lg border border-outline/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-text">{t.createRoute.stopsTitle}</h3>
              <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
                <input
                  type="checkbox"
                  checked={noStops}
                  onChange={(e) => setNoStops(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                {t.createRoute.noStopsLabel}
              </label>
            </div>

            {noStops ? (
              <p className="text-sm text-outline">{t.createRoute.noStopsHint}</p>
            ) : (
              <RouteStopsEditor
                idPrefix="new"
                stops={draft}
                onChange={setDraft}
                emptyText={t.createRoute.emptyStops}
                addTitle={t.createRoute.addTitle}
                addLabel={t.createRoute.add}
              />
            )}
          </section>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-outline/20 px-5 py-4">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-9 items-center rounded-md border border-outline px-3 text-sm font-medium text-text transition-opacity hover:opacity-90 cursor-pointer"
          >
            {t.common.cancel}
          </button>
          <button
            type="submit"
            form="create-route-form"
            disabled={!ready || createRoute.isPending}
            className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {createRoute.isPending && <Spinner className="h-3.5 w-3.5" />}
            {createRoute.isPending ? t.createRoute.creating : t.createRoute.create}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
