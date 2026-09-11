"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CreateRouteSchema, type Route, type User, type Vehicle, z } from "@torpreca/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Section } from "@/components/ui/section";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { useRoutes } from "@/lib/hooks/use-routes";
import { useUsers } from "@/lib/hooks/use-users";
import { useVehicles } from "@/lib/hooks/use-vehicles";

const STATUS_LABELS: Record<Route["status"], string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completada",
  delayed: "Retrasada",
  cancelled: "Cancelada",
};

// Only the tokens the design system actually defines (outline/primary/error)
// — no new colors invented for this: neutral for pending, primary for the
// two "moving forward" states, error for the two "went wrong" states.
const STATUS_BADGE_CLASSES: Record<Route["status"], string> = {
  pending: "bg-outline/15 text-outline",
  in_progress: "bg-primary/15 text-primary",
  completed: "bg-primary text-white",
  delayed: "bg-error/15 text-error",
  cancelled: "bg-error text-white",
};

function StatusBadge({ status }: { status: Route["status"] }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-error">{children}</p>;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
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
const RouteFormSchema = CreateRouteSchema.omit({ code: true });
type RouteFormValues = z.infer<typeof RouteFormSchema>;

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
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isValid },
  } = useForm<RouteFormValues>({
    resolver: zodResolver(RouteFormSchema),
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
    <Section title="Crear ruta" description="Asigna un conductor y, opcionalmente, un vehículo.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="code" className="text-xs text-outline">
            Código (autogenerado)
          </label>
          <input
            id="code"
            disabled
            value={generatedCode}
            className="h-9 w-32 rounded-md border border-outline/30 bg-surface px-2 text-sm text-outline"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="date" className="text-xs text-outline">
            Fecha
          </label>
          <input
            id="date"
            type="date"
            {...register("date")}
            className="h-9 rounded-md border border-outline/30 bg-background px-2 text-sm text-text"
          />
          {errors.date && <FieldError>Selecciona una fecha.</FieldError>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="driverId" className="text-xs text-outline">
            Conductor
          </label>
          <Select id="driverId" {...register("driverId")}>
            <option value="" disabled>
              Selecciona
            </option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
          {errors.driverId && <FieldError>Selecciona un conductor.</FieldError>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="vehicleId" className="text-xs text-outline">
            Vehículo
          </label>
          <Select
            id="vehicleId"
            {...register("vehicleId", { setValueAs: (v) => (v === "" ? null : v) })}
          >
            <option value="">Sin vehículo</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="plannedKm" className="text-xs text-outline">
            Km planeados
          </label>
          <input
            id="plannedKm"
            type="number"
            min={0}
            {...register("plannedKm", { setValueAs: (v) => (v === "" ? null : Number(v)) })}
            className="h-9 w-28 rounded-md border border-outline/30 bg-background px-2 text-sm text-text"
          />
          {errors.plannedKm && <FieldError>Debe ser 0 o mayor.</FieldError>}
        </div>
        <button
          type="submit"
          disabled={!isValid || createRoute.isPending}
          className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
        >
          {createRoute.isPending && <Spinner className="h-3.5 w-3.5" />}
          {createRoute.isPending ? "Creando..." : "Crear ruta"}
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
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<RouteFormValues>({
    resolver: zodResolver(RouteFormSchema),
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
    <tr className="border-b border-outline/10 text-text">
      <td className="py-3 font-medium">{route.code}</td>
      <td className="py-3">
        <Select {...register("driverId")}>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </td>
      <td className="py-3">
        <Select {...register("vehicleId", { setValueAs: (v) => (v === "" ? null : v) })}>
          <option value="">Sin vehículo</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.plate}
            </option>
          ))}
        </Select>
      </td>
      <td className="py-3">
        <input
          type="date"
          {...register("date")}
          className="h-9 rounded-md border border-outline/30 bg-background px-2 text-sm text-text"
        />
        {errors.date && <FieldError>Requerida</FieldError>}
      </td>
      <td className="py-3">
        <StatusBadge status={route.status} />
      </td>
      <td className="py-3">
        <input
          type="number"
          min={0}
          {...register("plannedKm", { setValueAs: (v) => (v === "" ? null : Number(v)) })}
          className="h-9 w-24 rounded-md border border-outline/30 bg-background px-2 text-sm text-text"
        />
        {errors.plannedKm && <FieldError>≥ 0</FieldError>}
      </td>
      <td className="py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!isValid || isSaving}
            onClick={handleSubmit(onSubmit)}
            className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {isSaving && <Spinner className="h-3.5 w-3.5" />}
            Guardar
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onCancel}
            className="flex h-9 items-center rounded-md border border-outline/30 px-3 text-sm font-medium text-text transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function RutasPage() {
  usePageTitle("Gestión de rutas");
  const { routes, isLoading, error, refetch, createRoute, updateRoute } = useRoutes();
  const { users } = useUsers();
  const { vehicles } = useVehicles();

  const drivers = users?.filter((u) => u.role === "driver" && u.status === "active") ?? [];
  const activeVehicles = vehicles ?? [];
  const driverName = (id: string) => users?.find((u) => u.id === id)?.name ?? id;
  const vehiclePlate = (id: string | null) =>
    id ? (activeVehicles.find((v) => v.id === id)?.plate ?? id) : "—";

  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl text-text">Gestión de rutas</h1>
        <p className="text-sm text-outline">Crear, asignar y editar rutas de reparto.</p>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}
      {updateRoute.isError && <ErrorBanner message={updateRoute.error.message} />}

      {isLoading && (
        <div className="flex flex-col gap-6" aria-busy="true" aria-label="Cargando rutas">
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

          {routes.length === 0 && <p className="text-sm text-outline">No hay rutas registradas.</p>}

          {routes.length > 0 && (
            <Section title="Todas las rutas">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-outline/30 text-xs text-outline">
                    <th className="py-2">Código</th>
                    <th className="py-2">Conductor</th>
                    <th className="py-2">Vehículo</th>
                    <th className="py-2">Fecha</th>
                    <th className="py-2">Estado</th>
                    <th className="py-2">Km (plan/real)</th>
                    <th className="py-2">Acciones</th>
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
                        <td className="py-3 font-medium">{route.code}</td>
                        <td className="py-3">{driverName(route.driverId)}</td>
                        <td className="py-3">{vehiclePlate(route.vehicleId)}</td>
                        <td className="py-3">{route.date}</td>
                        <td className="py-3">
                          <StatusBadge status={route.status} />
                        </td>
                        <td className="py-3 tabular-nums">
                          {route.plannedKm ?? "—"} / {route.drivenKm}
                        </td>
                        <td className="py-3">
                          {route.status === "pending" && (
                            <button
                              type="button"
                              onClick={() => setEditingId(route.id)}
                              className="flex h-9 items-center rounded-md border border-outline/30 px-3 text-sm font-medium text-text transition-opacity hover:opacity-90 cursor-pointer"
                            >
                              Editar
                            </button>
                          )}
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