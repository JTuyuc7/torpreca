"use client";

import { AUDIT_EVENTS, type AuditEvent } from "@torpreca/shared";
import { ChevronLeft, ChevronRight, RefreshCw, ScrollText, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuthUser } from "@/app/(protected)/auth-context";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuditLogs } from "@/lib/hooks/use-audit-logs";
import { usePageTitle } from "@/lib/hooks/use-page-title";
import { useUsers } from "@/lib/hooks/use-users";

const PAGE_SIZE_OPTIONS = [20, 30, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

function isPageSize(value: number): value is PageSize {
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(value);
}

// Reads the *applied* filters/pagination back out of the URL so a reload (or
// a shared link) lands on the same page instead of resetting to defaults.
function readParams(params: URLSearchParams) {
  const action = params.get("action") ?? "all";
  const userId = params.get("userId") ?? "all";
  const date = params.get("date") ?? "";
  const sizeParam = Number(params.get("size"));
  const pageSize = isPageSize(sizeParam) ? sizeParam : 20;
  const pageParam = Number(params.get("page"));
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam - 1 : 0;
  return { action, userId, date, pageSize, page };
}

// useSearchParams() (used to keep filters/pagination in the URL) requires a
// Suspense boundary in production builds — see
// node_modules/next/dist/docs/.../use-search-params.md "Prerendering".
export default function LogsPage() {
  return (
    <Suspense fallback={null}>
      <LogsPageContent />
    </Suspense>
  );
}

function LogsPageContent() {
  usePageTitle("Logs del sistema");
  const authUser = useAuthUser();
  const { users } = useUsers();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initial = readParams(searchParams);

  // Applied filters — these drive the actual query and the URL.
  const [actionFilter, setActionFilter] = useState(initial.action);
  const [userFilter, setUserFilter] = useState(initial.userId);
  const [dateFilter, setDateFilter] = useState(initial.date);
  const [pageSize, setPageSize] = useState<PageSize>(initial.pageSize);
  const [page, setPage] = useState(initial.page);

  // Draft filters — what the selects/input show while the user is still
  // picking, only committed to the filters above (and re-queried) on
  // "Aplicar". Page size/pagination stay instant since they aren't really
  // "search criteria" to confirm.
  const [draftAction, setDraftAction] = useState(initial.action);
  const [draftUser, setDraftUser] = useState(initial.userId);
  const [draftDate, setDraftDate] = useState(initial.date);
  const hasPendingChanges =
    draftAction !== actionFilter || draftUser !== userFilter || draftDate !== dateFilter;

  // TOR-135: event/user/date/page all live server-side now — GET /audit-logs
  // only ever returns this one page's worth of rows, not the whole table.
  const { logs, total, isLoading, isRefetching, error, refetch } = useAuditLogs({
    action: actionFilter !== "all" ? (actionFilter as AuditEvent) : undefined,
    userId: userFilter !== "all" ? userFilter : undefined,
    date: dateFilter || undefined,
    limit: pageSize,
    offset: page * pageSize,
  });

  // Keeps the URL in sync with the applied filters/pagination (replace, not
  // push, so paging through logs doesn't spam browser history) — this is
  // what lets a reload preserve the current view.
  function syncUrl(next: { action: string; userId: string; date: string; pageSize: PageSize; page: number }) {
    const params = new URLSearchParams();
    if (next.action !== "all") params.set("action", next.action);
    if (next.userId !== "all") params.set("userId", next.userId);
    if (next.date) params.set("date", next.date);
    if (next.pageSize !== 20) params.set("size", String(next.pageSize));
    if (next.page > 0) params.set("page", String(next.page + 1));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function applyFilters() {
    setActionFilter(draftAction);
    setUserFilter(draftUser);
    setDateFilter(draftDate);
    setPage(0);
    syncUrl({ action: draftAction, userId: draftUser, date: draftDate, pageSize, page: 0 });
  }

  function clearFilters() {
    setDraftAction("all");
    setDraftUser("all");
    setDraftDate("");
    setActionFilter("all");
    setUserFilter("all");
    setDateFilter("");
    setPage(0);
    syncUrl({ action: "all", userId: "all", date: "", pageSize, page: 0 });
  }

  function changePageSize(size: PageSize) {
    setPageSize(size);
    setPage(0);
    syncUrl({ action: actionFilter, userId: userFilter, date: dateFilter, pageSize: size, page: 0 });
  }

  function changePage(next: number) {
    setPage(next);
    syncUrl({ action: actionFilter, userId: userFilter, date: dateFilter, pageSize, page: next });
  }

  // CLAUDE.md: "Pantalla de logs solo renderiza si rol === 'super_admin'" —
  // the sidebar already hides this link for anyone else (see layout.tsx's
  // NAV_ITEMS), but a direct URL visit still needs to be turned away here.
  if (authUser?.role !== "super_admin") {
    return (
      <div className="flex flex-1 flex-col gap-6 p-6">
        <EmptyState
          icon={ScrollText}
          title="No tenés acceso a esta pantalla."
          description="Los logs del sistema solo están disponibles para super_admin."
        />
      </div>
    );
  }

  const userName = (id: string | null) =>
    id ? (users?.find((u) => u.id === id)?.name ?? id) : "—";

  const hasActiveFilters = actionFilter !== "all" || userFilter !== "all" || dateFilter !== "";

  const totalPages = total ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const hasNextPage = total !== undefined && (page + 1) * pageSize < total;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl text-text">Logs del sistema</h1>
        <p className="text-sm text-outline">Historial de eventos de auditoría.</p>
      </div>

      {error && <ErrorBanner message={error} onRetry={() => refetch()} />}

      {isLoading && (
        <div className="flex flex-col gap-6" aria-busy="true" aria-label="Cargando logs">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      )}

      {logs !== undefined && (
        <div className="flex flex-col gap-6 animate-fade-in">
          <Section title="Filtros">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="actionFilter" className="text-xs text-outline">
                  Evento
                </label>
                <Select
                  id="actionFilter"
                  value={draftAction}
                  onChange={(e) => setDraftAction(e.target.value)}
                  className="w-56"
                >
                  <option value="all">Todos</option>
                  {AUDIT_EVENTS.map((event) => (
                    <option key={event} value={event}>
                      {event}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="userFilter" className="text-xs text-outline">
                  Usuario
                </label>
                <Select
                  id="userFilter"
                  value={draftUser}
                  onChange={(e) => setDraftUser(e.target.value)}
                  className="w-56"
                >
                  <option value="all">Todos</option>
                  {(users ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="dateFilter" className="text-xs text-outline">
                  Fecha
                </label>
                <Input
                  id="dateFilter"
                  type="date"
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <button
                type="button"
                disabled={!hasPendingChanges}
                onClick={applyFilters}
                className="flex h-9 items-center gap-1.5 rounded-md bg-brand px-3 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer"
              >
                <Search size={14} />
                Aplicar
              </button>
              {hasActiveFilters && (
                <button type="button" onClick={clearFilters} className="text-sm text-outline hover:underline cursor-pointer">
                  Limpiar filtros
                </button>
              )}
            </div>
          </Section>

          {logs.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title={
                hasActiveFilters
                  ? "Ningún evento coincide con estos filtros."
                  : "Todavía no hay eventos registrados."
              }
              description={hasActiveFilters ? "Probá ajustando o limpiando los filtros de arriba." : undefined}
            />
          ) : (
            <Section
              title="Eventos"
              action={
                <button
                  type="button"
                  disabled={isRefetching}
                  onClick={() => refetch()}
                  title="Actualizar"
                  aria-label="Actualizar"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-outline/30 text-outline transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw size={14} className={isRefetching ? "animate-spin" : undefined} />
                </button>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-outline/30 text-xs text-outline">
                      <th className="py-2 pr-4">Fecha</th>
                      <th className="py-2 pr-4">Evento</th>
                      <th className="py-2 pr-4">Usuario</th>
                      <th className="py-2 pr-4">Rol</th>
                      <th className="py-2 pr-4">Entidad</th>
                      <th className="py-2">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-outline/10 text-text">
                        <td className="py-2.5 pr-4 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 pr-4 font-medium">{log.action}</td>
                        <td className="py-2.5 pr-4">{userName(log.userId)}</td>
                        <td className="py-2.5 pr-4">{log.role ?? "—"}</td>
                        <td className="py-2.5 pr-4">{log.entity ?? "—"}</td>
                        <td className="py-2.5 text-outline">{log.ip ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-outline/10 pt-3">
                <div className="flex items-center gap-2 text-xs text-outline">
                  <label htmlFor="pageSize">Filas por página</label>
                  <Select
                    id="pageSize"
                    value={String(pageSize)}
                    onChange={(e) => changePageSize(Number(e.target.value) as PageSize)}
                    className="w-20"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex items-center gap-3 text-xs text-outline">
                  <span>
                    Página {page + 1} de {totalPages} · {total} evento{total === 1 ? "" : "s"}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={page === 0 || isRefetching}
                      onClick={() => changePage(Math.max(0, page - 1))}
                      aria-label="Página anterior"
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-outline/30 text-text transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={!hasNextPage || isRefetching}
                      onClick={() => changePage(page + 1)}
                      aria-label="Página siguiente"
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-outline/30 text-text transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
