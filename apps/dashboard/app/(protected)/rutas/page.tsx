"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { businessDate, CreateRouteSchema, type Route, type User, type Vehicle, z } from "@torpreca/shared";
import { Route as RouteIcon } from "lucide-react";
import { useState } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input } from "@/components/ui/input";
import { RouteStatusBadge } from "@/components/ui/route-status-badge";
import { Section } from "@/components/ui/section";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { useRoutes } from "@/lib/hooks/use-routes";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useUsers } from "@/lib/hooks/use-users";
import { useVehicles } from "@/lib/hooks/use-vehicles";
import { RouteKmCalculatorDialog } from "./route-km-calculator-dialog";
import { RouteStopsDialog } from "./route-stops-dialog";

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-error">{children}</p>;
}

function todayIsoDate(): string {
  return businessDate();
}

// R-<YYYYMMDD>-<secuencia del día> — generado en el cliente a partir de las
// rutas ya cargadas para esa fecha, no en el backend (no hay una tabla de
// secuencias ni una constraint UNIQUE sobre `code` todavía). Evita que se
// escriba código a mano; el caso borde de dos admins creando al mismo
// segundo una ruta para el mismo día es un riesgo aceptado para el MVP de un
// solo administrador activo a la vez — si eso cambia, esto necesita moverse
// al backend.
function generateRouteCode(date: string, existingForDate: number): string {
  if (!date) return "";
  const compact = date.replaceAll("-", "");
  return `R-${compact}-${String(existingForDate + 1).padStart(2, "0")}`;
}

// Shared by the create form and each editable row below — `code` isn't part
// of it: it's either auto-generated (create) or left untouched (edit, see
// CLAUDE.md-adjacent decision in routes.service.ts: code isn't editable).
// Reusing CreateRouteSchema instead of hand-rolling a parallel one means the
// "plannedKm can't be negative" rule (and everything else) comes from the
// exact same schema the backend validates against — one source of truth.
//
// `plannedKm` gets a preprocess step (paired with `valueAsNumber: true` on
// the input, not a custom `setValueAs`) — see the identical note on
// VehicleFormSchema in app/(protected)/vehiculos/page.tsx for the real
// react-hook-form 7.87 + React 19 bug this works around: register(field,
// { setValueAs }) on an untouched type="number" input hands the resolver the
// raw DOM node instead of its value, silently breaking validation.
const RouteFormSchema = CreateRouteSchema.omit({ code: true }).extend({
  plannedKm: z.preprocess(
    (v) => (typeof v === "number" && Number.isNaN(v) ? null : v),
    CreateRouteSchema.shape.plannedKm,
  ),
});
type RouteFormValues = z.infer<typeof RouteFormSchema>;

// See the identical note on vehicleResolver in vehiculos/page.tsx: the
// preprocess step above types its input as `unknown`, which doesn't line up
// with Resolver<TFieldValues> — the runtime input is always `number | null`.
const routeResolver = zodResolver(RouteFormSchema) as Resolver<RouteFormValues>;

function CreateRouteForm({
  drivers,
  vehicles,
  routes,
  createRoute,
}: {
  drivers: User[];
  vehicles: Vehicle[];
  routes: Route[];
  createRoute: ReturnType<typeof useRoutes>["createRoute"];
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isValid },
  } = useForm<RouteFormValues>({
    resolver: routeResolver,
    mode: "onChange",
    defaultValues: { driverId: "", vehicleId: null, date: todayIsoDate(), plannedKm: null },
  });

  const date = watch("date");
  const generatedCode = generateRouteCode(date, routes.filter((r) => r.date === date).length);

  function onSubmit(values: RouteFormValues) {
    createRoute.mutate(
      { ...values, code: generatedCode },
      {
        onSuccess: () =>
          reset({ driverId: "", vehicleId: null, date: todayIsoDate(), plannedKm: null }),
      },
    );
  }

  return (
    <Section title={t.rutas.createTitle} description={t.rutas.createDescription}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="code" className="text-xs text-outline">
            {t.rutas.codeLabel}
          </label>
          <Input
            id="code"
            disabled
            value={generatedCode}
            className="w-32 bg-surface text-outline"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="date" className="text-xs text-outline">
            {t.rutas.dateLabel}
          </label>
          <Input id="date" type="date" {...register("date")} />
          {errors.date && <FieldError>{t.rutas.dateRequired}</FieldError>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="driverId" className="text-xs text-outline">
            {t.rutas.driverLabel}
          </label>
          <Select id="driverId" {...register("driverId")}>
            <option value="" disabled>
              {t.rutas.selectPlaceholder}
            </option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          {errors.driverId && <FieldError>{t.rutas.driverRequired}</FieldError>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="vehicleId" className="text-xs text-outline">
            {t.rutas.vehicleLabel}
          </label>
          <Select
            id="vehicleId"
            {...register("vehicleId", { setValueAs: (v) => (v === "" ? null : v) })}
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
          <label htmlFor="plannedKm" className="text-xs text-outline">
            {t.rutas.plannedKmLabel}
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="plannedKm"
              type="number"
              min={0}
              {...register("plannedKm", { valueAsNumber: true })}
              className="w-28"
            />
            <RouteKmCalculatorDialog
              onApply={(km) => setValue("plannedKm", km, { shouldValidate: true })}
            />
          </div>
          {errors.plannedKm && <FieldError>{t.rutas.plannedKmInvalid}</FieldError>}
        </div>
        <button
          type="submit"
          disabled={!isValid || createRoute.isPending}
          className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
        >
          {createRoute.isPending && <Spinner className="h-3.5 w-3.5" />}
          {createRoute.isPending ? t.rutas.creating : t.rutas.createRoute}
        </button>
        {createRoute.isError && <FieldError>{createRoute.error.message}</FieldError>}
      </form>
    </Section>
  );
}

function RouteEditRow({
  route,
  drivers,
  vehicles,
  updateRoute,
  onCancel,
}: {
  route: Route;
  drivers: User[];
  vehicles: Vehicle[];
  updateRoute: ReturnType<typeof useRoutes>["updateRoute"];
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isValid },
  } = useForm<RouteFormValues>({
    resolver: routeResolver,
    mode: "onChange",
    defaultValues: {
      driverId: route.driverId,
      vehicleId: route.vehicleId,
      date: route.date,
      plannedKm: route.plannedKm,
    },
  });

  const isSaving = updateRoute.isPending && updateRoute.variables?.id === route.id;

  function onSubmit(values: RouteFormValues) {
    updateRoute.mutate({ id: route.id, input: values }, { onSuccess: onCancel });
  }

  // No <form> wrapper: a <tr>'s only valid children are <td>/<th>, so
  // "Guardar" triggers handleSubmit directly from a plain button click
  // instead — a documented react-hook-form pattern for row-level editing.
  return (
    <tr className="border-b border-outline/10 align-middle text-text">
      <td className="py-3 pr-4 font-medium">{route.code}</td>
      <td className="py-3 pr-4">
        <Select {...register("driverId")}>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </td>
      <td className="py-3 pr-4">
        <Select {...register("vehicleId", { setValueAs: (v) => (v === "" ? null : v) })}>
          <option value="">{t.rutas.noVehicle}</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.plate}
            </option>
          ))}
        </Select>
      </td>
      <td className="py-3 pr-4">
        <Input type="date" {...register("date")} />
        {errors.date && <FieldError>{t.rutas.dateRequiredShort}</FieldError>}
      </td>
      <td className="py-3 pr-4">
        <RouteStatusBadge status={route.status} />
      </td>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            {...register("plannedKm", { valueAsNumber: true })}
            className="w-24"
          />
          <RouteKmCalculatorDialog
            onApply={(km) => setValue("plannedKm", km, { shouldValidate: true })}
          />
        </div>
        {errors.plannedKm && <FieldError>{t.rutas.plannedKmInvalidShort}</FieldError>}
      </td>
      <td className="py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!isValid || isSaving}
            onClick={handleSubmit(onSubmit)}
            className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {isSaving && <Spinner className="h-3.5 w-3.5" />}
            {t.common.save}
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onCancel}
            className="flex h-9 items-center rounded-md border border-outline px-3 text-sm font-medium text-text transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {t.common.cancel}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function RutasPage() {
  const { t } = useTranslation();
  usePageTitle(t.rutas.title);
  const { routes, isLoading, error, refetch, createRoute, updateRoute } = useRoutes();
  const { users } = useUsers();
  const { vehicles } = useVehicles();

  const drivers = users?.filter((u) => u.role === "driver" && u.status === "active") ?? [];
  // Assignment dropdowns only offer active vehicles, but plate lookups for
  // already-assigned routes must still resolve an inactive one by id instead
  // of falling back to showing the raw uuid.
  const activeVehicles = vehicles?.filter((v) => v.active) ?? [];
  const driverName = (id: string) => users?.find((u) => u.id === id)?.name ?? id;
  const vehiclePlate = (id: string | null) =>
    id ? (vehicles?.find((v) => v.id === id)?.plate ?? id) : "—";

  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl text-text">{t.rutas.title}</h1>
        <p className="text-sm text-outline">{t.rutas.subtitle}</p>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}
      {updateRoute.isError && <ErrorBanner message={updateRoute.error.message} />}

      {isLoading && (
        <div className="flex flex-col gap-6" aria-busy="true" aria-label={t.rutas.loadingLabel}>
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {routes !== undefined && (
        <div className="flex flex-col gap-6 animate-fade-in">
          <CreateRouteForm
            drivers={drivers}
            vehicles={activeVehicles}
            routes={routes}
            createRoute={createRoute}
          />

          {routes.length === 0 && (
            <EmptyState
              icon={RouteIcon}
              title={t.rutas.noRoutesTitle}
              description={t.rutas.noRoutesDescription}
            />
          )}

          {routes.length > 0 && (
            <Section title={t.rutas.allRoutesTitle}>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-outline/30 text-xs text-outline">
                    <th className="py-2 pr-4">{t.rutas.tableCode}</th>
                    <th className="py-2 pr-4">{t.rutas.tableDriver}</th>
                    <th className="py-2 pr-4">{t.rutas.tableVehicle}</th>
                    <th className="py-2 pr-4">{t.rutas.tableDate}</th>
                    <th className="py-2 pr-4">{t.rutas.tableStatus}</th>
                    <th className="py-2 pr-4">{t.rutas.tableKm}</th>
                    <th className="py-2">{t.rutas.tableActions}</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map((route) => {
                    if (editingId === route.id) {
                      return (
                        <RouteEditRow
                          key={route.id}
                          route={route}
                          drivers={drivers}
                          vehicles={activeVehicles}
                          updateRoute={updateRoute}
                          onCancel={() => setEditingId(null)}
                        />
                      );
                    }

                    return (
                      <tr
                        key={route.id}
                        className="border-b border-outline/10 text-text transition-colors hover:bg-outline/5"
                      >
                        <td className="py-3 pr-4 font-medium">{route.code}</td>
                        <td className="py-3 pr-4">{driverName(route.driverId)}</td>
                        <td className="py-3 pr-4">{vehiclePlate(route.vehicleId)}</td>
                        <td className="py-3 pr-4">{route.date}</td>
                        <td className="py-3 pr-4">
                          <RouteStatusBadge status={route.status} />
                        </td>
                        <td className="py-3 pr-4 tabular-nums">
                          {route.plannedKm ?? "—"} / {route.drivenKm}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <RouteStopsDialog route={route} />
                            {route.status === "pending" && (
                              <button
                                type="button"
                                onClick={() => setEditingId(route.id)}
                                className="flex h-9 items-center rounded-md border border-outline px-3 text-sm font-medium text-text transition-opacity hover:opacity-90 cursor-pointer"
                              >
                                {t.common.edit}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}