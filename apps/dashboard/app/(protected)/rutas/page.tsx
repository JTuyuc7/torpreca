"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  businessDate,
  CreateRouteSchema,
  isRouteOverdue,
  ROUTE_STATUS_FILTERS,
  type Route,
  type RouteStatusFilter,
  type User,
  type Vehicle,
  z,
} from "@torpreca/shared";
import { ChevronLeft, ChevronRight, RefreshCw, Route as RouteIcon, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";
import { type Resolver, type UseFormSetValue, useForm } from "react-hook-form";
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
import { useRoutesSearch } from "@/lib/hooks/use-routes-search";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useUsers } from "@/lib/hooks/use-users";
import { useVehicles } from "@/lib/hooks/use-vehicles";
import { CreateRouteDialog } from "./create-route-dialog";
import { DuplicateRouteDialog } from "./duplicate-route-dialog";
import { type CalculatedPoints, RouteKmCalculatorDialog } from "./route-km-calculator-dialog";
import { RouteStopsDialog } from "./route-stops-dialog";

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-error">{children}</p>;
}

function todayIsoDate(): string {
  return businessDate();
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
const RouteFormSchema = CreateRouteSchema.extend({
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

// The calculator's A/B go into the form next to the km, so the route is saved
// with them and the live map can draw them (see the routes.origin_* columns).
function applyPoints(
  setValue: UseFormSetValue<RouteFormValues>,
  { origin, destination }: CalculatedPoints,
) {
  setValue("originLat", origin.lat);
  setValue("originLng", origin.lng);
  setValue("destinationLat", destination.lat);
  setValue("destinationLng", destination.lng);
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
            onApply={(km, points) => {
                setValue("plannedKm", km, { shouldValidate: true });
                if (points) applyPoints(setValue, points);
              }}
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

const PAGE_SIZE = 10;

type Filters = {
  q: string;
  status: RouteStatusFilter | "";
  driverId: string;
  vehicleId: string;
  from: string;
  to: string;
  page: number;
};

const NO_FILTERS: Filters = { q: "", status: "", driverId: "", vehicleId: "", from: "", to: "", page: 0 };

// Reads the applied filters back out of the URL so a reload (or a shared link)
// lands on the same view — same approach as the logs screen.
function filtersFromParams(params: URLSearchParams): Filters {
  const status = params.get("status") ?? "";
  const page = Number(params.get("page"));
  return {
    q: params.get("q") ?? "",
    status: (ROUTE_STATUS_FILTERS as readonly string[]).includes(status)
      ? (status as RouteStatusFilter)
      : "",
    driverId: params.get("driver") ?? "",
    vehicleId: params.get("vehicle") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    page: Number.isInteger(page) && page > 0 ? page - 1 : 0,
  };
}

function paramsFromFilters(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.status) params.set("status", filters.status);
  if (filters.driverId) params.set("driver", filters.driverId);
  if (filters.vehicleId) params.set("vehicle", filters.vehicleId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.page > 0) params.set("page", String(filters.page + 1));
  return params.toString();
}

// useSearchParams() (filters live in the URL) needs a Suspense boundary in
// production builds — see the same note on the logs screen.
export default function RutasPage() {
  return (
    <Suspense fallback={null}>
      <RutasContent />
    </Suspense>
  );
}

function RutasContent() {
  const { t } = useTranslation();
  usePageTitle(t.rutas.title);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = filtersFromParams(searchParams);

  const { createRoute, updateRoute, duplicateRoute, closeRoute } = useRoutes({ list: false });
  const {
    routes,
    total,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useRoutesSearch({
    q: filters.q || undefined,
    status: filters.status || undefined,
    driverId: filters.driverId || undefined,
    vehicleId: filters.vehicleId || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
    limit: PAGE_SIZE,
    offset: filters.page * PAGE_SIZE,
  });
  const { users } = useUsers();
  const { vehicles } = useVehicles();

  const drivers = users?.filter((u) => u.role === "driver" && u.status === "active") ?? [];
  // Whoever ever drove a route can be filtered on, even if deactivated since.
  const filterDrivers = users?.filter((u) => u.role === "driver") ?? [];
  // Assignment dropdowns only offer active vehicles, but plate lookups for
  // already-assigned routes must still resolve an inactive one by id instead
  // of falling back to showing the raw uuid.
  const activeVehicles = vehicles?.filter((v) => v.active) ?? [];
  const driverName = (id: string) => users?.find((u) => u.id === id)?.name ?? id;
  const vehiclePlate = (id: string | null) =>
    id ? (vehicles?.find((v) => v.id === id)?.plate ?? id) : "—";

  // Any change of a filter goes back to the first page; only the pager passes
  // its own `page`.
  function navigate(next: Filters) {
    const query = paramsFromFilters(next);
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function applyFilters(patch: Partial<Filters>) {
    navigate({ ...filters, page: 0, ...patch });
  }

  // The filter inputs are a draft: nothing is requested until "Search" (or
  // Enter) applies them to the URL. `edits` holds only what differs from the
  // applied filters, so it resets itself whenever the URL changes under it.
  const [edits, setEdits] = useState<Partial<Filters>>({});
  const draft: Filters = { ...filters, ...edits };
  const hasActiveFilters = JSON.stringify({ ...filters, page: 0 }) !== JSON.stringify(NO_FILTERS);

  function edit(patch: Partial<Filters>) {
    setEdits((current) => ({ ...current, ...patch }));
  }

  function search(e: FormEvent) {
    e.preventDefault();
    setEdits({});
    navigate({ ...draft, q: draft.q.trim(), page: 0 });
  }

  function clearFilters() {
    setEdits({});
    navigate({ ...NO_FILTERS });
  }

  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmCloseId, setConfirmCloseId] = useState<string | null>(null);
  const today = todayIsoDate();

  const totalPages = total ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 1;
  const hasNextPage = total !== undefined && (filters.page + 1) * PAGE_SIZE < total;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl text-text">{t.rutas.title}</h1>
          <p className="text-sm text-outline">{t.rutas.subtitle}</p>
        </div>
        <CreateRouteDialog drivers={drivers} vehicles={activeVehicles} createRoute={createRoute} />
      </div>

      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}
      {updateRoute.isError && <ErrorBanner message={updateRoute.error.message} />}
      {closeRoute.isError && <ErrorBanner message={closeRoute.error.message} />}

      {isLoading && (
        <div className="flex flex-col gap-6" aria-busy="true" aria-label={t.rutas.loadingLabel}>
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {routes !== undefined && (
        <div className="flex flex-col gap-6 animate-fade-in">
          <Section title={t.rutas.filtersTitle}>
            <form onSubmit={search} className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="routeSearch" className="text-xs text-outline">
                  {t.rutas.searchLabel}
                </label>
                <div className="relative">
                  <Search
                    size={14}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-outline"
                  />
                  <Input
                    id="routeSearch"
                    value={draft.q}
                    onChange={(e) => edit({ q: e.target.value })}
                    placeholder={t.rutas.searchPlaceholder}
                    className="w-48 pl-8"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="statusFilter" className="text-xs text-outline">
                  {t.rutas.statusLabel}
                </label>
                <Select
                  id="statusFilter"
                  value={draft.status}
                  onChange={(e) => edit({ status: e.target.value as Filters["status"] })}
                  className="w-40"
                >
                  <option value="">{t.rutas.allStatuses}</option>
                  {ROUTE_STATUS_FILTERS.map((status) => (
                    <option key={status} value={status}>
                      {t.routeStatus[status]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="driverFilter" className="text-xs text-outline">
                  {t.rutas.driverFilterLabel}
                </label>
                <Select
                  id="driverFilter"
                  value={draft.driverId}
                  onChange={(e) => edit({ driverId: e.target.value })}
                  className="w-48"
                >
                  <option value="">{t.rutas.allDrivers}</option>
                  {filterDrivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="vehicleFilter" className="text-xs text-outline">
                  {t.rutas.vehicleFilterLabel}
                </label>
                <Select
                  id="vehicleFilter"
                  value={draft.vehicleId}
                  onChange={(e) => edit({ vehicleId: e.target.value })}
                  className="w-40"
                >
                  <option value="">{t.rutas.allVehicles}</option>
                  {(vehicles ?? []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="fromFilter" className="text-xs text-outline">
                  {t.rutas.fromLabel}
                </label>
                <Input
                  id="fromFilter"
                  type="date"
                  value={draft.from}
                  max={draft.to || undefined}
                  onChange={(e) => edit({ from: e.target.value })}
                  className="w-40"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="toFilter" className="text-xs text-outline">
                  {t.rutas.toLabel}
                </label>
                <Input
                  id="toFilter"
                  type="date"
                  value={draft.to}
                  min={draft.from || undefined}
                  onChange={(e) => edit({ to: e.target.value })}
                  className="w-40"
                />
              </div>
              <button
                type="submit"
                className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-on-primary transition-opacity hover:opacity-90 cursor-pointer"
              >
                <Search size={14} />
                {t.rutas.searchButton}
              </button>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex h-9 items-center text-sm text-outline hover:underline cursor-pointer"
                >
                  {t.rutas.clearFilters}
                </button>
              )}
            </form>
          </Section>

          {routes.length === 0 && (
            <EmptyState
              icon={RouteIcon}
              title={hasActiveFilters ? t.rutas.noMatchTitle : t.rutas.noRoutesTitle}
              description={
                hasActiveFilters ? t.rutas.noMatchDescription : t.rutas.noRoutesDescription
              }
            />
          )}

          {routes.length > 0 && (
            <Section
              title={t.rutas.allRoutesTitle}
              action={
                <button
                  type="button"
                  disabled={isRefetching}
                  onClick={() => refetch()}
                  title={t.rutas.refresh}
                  aria-label={t.rutas.refresh}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-outline/30 text-outline transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw size={14} className={isRefetching ? "animate-spin" : undefined} />
                </button>
              }
            >
              {/* Fixed-height window: the page doesn't grow with the rows, the
                  table scrolls inside it and keeps its header in view. */}
              <div className="max-h-[32rem] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-surface">
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

                      // Sin completar: its day passed without being finished —
                      // read-only, it can only be duplicated (or closed, if it
                      // was started and left running).
                      const overdue = isRouteOverdue(route, today);
                      const closing = closeRoute.isPending && closeRoute.variables === route.id;

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
                            <RouteStatusBadge status={route.status} overdue={overdue} />
                          </td>
                          <td className="py-3 pr-4 tabular-nums">
                            {route.plannedKm ?? "—"} / {route.drivenKm}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <RouteStopsDialog route={route} />
                              {route.status === "pending" && !overdue && (
                                <button
                                  type="button"
                                  onClick={() => setEditingId(route.id)}
                                  className="flex h-9 items-center rounded-md border border-outline px-3 text-sm font-medium text-text transition-opacity hover:opacity-90 cursor-pointer"
                                >
                                  {t.common.edit}
                                </button>
                              )}
                              <DuplicateRouteDialog
                                route={route}
                                drivers={drivers}
                                vehicles={activeVehicles}
                                duplicateRoute={duplicateRoute}
                              />
                              {overdue && route.status === "in_progress" && (
                                <button
                                  type="button"
                                  disabled={closing}
                                  onClick={() =>
                                    confirmCloseId === route.id
                                      ? closeRoute.mutate(route.id, {
                                          onSettled: () => setConfirmCloseId(null),
                                        })
                                      : setConfirmCloseId(route.id)
                                  }
                                  className={
                                    confirmCloseId === route.id
                                      ? "flex h-9 items-center gap-1.5 rounded-md bg-error px-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                                      : "flex h-9 items-center rounded-md border border-outline px-3 text-sm font-medium text-text transition-opacity hover:opacity-90 cursor-pointer"
                                  }
                                >
                                  {closing && <Spinner className="h-3.5 w-3.5" />}
                                  {closing
                                    ? t.rutas.closing
                                    : confirmCloseId === route.id
                                      ? t.rutas.confirmCloseRoute
                                      : t.rutas.closeRoute}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {routes.some((r) => isRouteOverdue(r, today)) && (
                <p className="mt-3 text-xs text-outline">{t.rutas.overdueNotice}</p>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-end gap-3 border-t border-outline/10 pt-3 text-xs text-outline">
                <span>
                  {t.rutas.page} {filters.page + 1} {t.rutas.of} {totalPages} · {total}{" "}
                  {total === 1 ? t.rutas.routeCountOne : t.rutas.routeCountMany}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={filters.page === 0 || isRefetching}
                    onClick={() => applyFilters({ page: Math.max(0, filters.page - 1) })}
                    aria-label={t.rutas.previousPage}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-outline/30 text-text transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={!hasNextPage || isRefetching}
                    onClick={() => applyFilters({ page: filters.page + 1 })}
                    aria-label={t.rutas.nextPage}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-outline/30 text-text transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
