"use client";

import { AUDIT_EVENTS } from "@torpreca/shared";
import { RefreshCw, ScrollText } from "lucide-react";
import { useState } from "react";
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

export default function LogsPage() {
  usePageTitle("Logs del sistema");
  const authUser = useAuthUser();
  const { logs, isLoading, isRefetching, error, refetch } = useAuditLogs();
  const { users } = useUsers();

  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

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

  const filteredLogs = (logs ?? []).filter((log) => {
    if (actionFilter !== "all" && log.action !== actionFilter) return false;
    if (userFilter !== "all" && log.userId !== userFilter) return false;
    if (dateFilter && !log.createdAt.startsWith(dateFilter)) return false;
    return true;
  });

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
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
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
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
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
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-40"
                />
              </div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setActionFilter("all");
                    setUserFilter("all");
                    setDateFilter("");
                  }}
                  className="text-sm text-outline hover:underline cursor-pointer"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </Section>

          {filteredLogs.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title={
                logs.length === 0
                  ? "Todavía no hay eventos registrados."
                  : "Ningún evento coincide con estos filtros."
              }
              description={
                logs.length === 0 ? undefined : "Probá ajustando o limpiando los filtros de arriba."
              }
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
                    {filteredLogs.map((log) => (
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
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
