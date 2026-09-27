import type { Role } from "@torpreca/shared";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthUserProvider } from "../auth-context";

const useAuditLogs = vi.fn();
vi.mock("@/lib/hooks/use-audit-logs", () => ({ useAuditLogs: (filter: unknown) => useAuditLogs(filter) }));

const useUsers = vi.fn();
vi.mock("@/lib/hooks/use-users", () => ({ useUsers: () => useUsers() }));

const replace = vi.fn();
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/logs",
  useSearchParams: () => searchParams,
}));

import LogsPage from "./page";

function renderPage(role: Role = "super_admin") {
  return render(
    <AuthUserProvider user={{ id: "u1", role, status: "active" }}>
      <LogsPage />
    </AuthUserProvider>,
  );
}

function lastFilterArg() {
  return useAuditLogs.mock.calls.at(-1)?.[0];
}

const driver = {
  id: "d1",
  authUserId: "auth-d1",
  name: "Carlos Pérez",
  email: "carlos@example.com",
  role: "driver" as const,
  status: "active" as const,
  deactivatedAt: null,
  deactivatedBy: null,
  reviewedAt: null,
  reviewedBy: null,
  createdAt: "t",
  updatedAt: "t",
};

const loginLog = {
  id: "l1",
  userId: "d1",
  role: "driver",
  action: "auth.login" as const,
  entity: null,
  entityId: null,
  ip: "127.0.0.1",
  metadata: null,
  createdAt: "2026-09-16T08:00:00.000Z",
  updatedAt: "t",
};

const routeFinishedLog = {
  id: "l2",
  userId: "d1",
  role: "driver",
  action: "route.finished" as const,
  entity: "routes",
  entityId: "r1",
  ip: "127.0.0.1",
  metadata: null,
  createdAt: "2026-09-17T10:00:00.000Z",
  updatedAt: "t",
};

const refetch = vi.fn();

beforeEach(() => {
  useAuditLogs.mockReset();
  useUsers.mockReset();
  refetch.mockReset();
  replace.mockReset();
  searchParams = new URLSearchParams();
  useAuditLogs.mockReturnValue({
    logs: [loginLog, routeFinishedLog],
    total: 2,
    isLoading: false,
    isRefetching: false,
    error: null,
    refetch,
  });
  useUsers.mockReturnValue({ users: [driver] });
});

describe("LogsPage", () => {
  it("blocks anyone who isn't super_admin", () => {
    renderPage("admin");

    expect(screen.getByText("No tenés acceso a esta pantalla.")).toBeInTheDocument();
    expect(screen.queryByText("auth.login")).not.toBeInTheDocument();
  });

  it("lists every event for super_admin, resolving the driver's name and showing the page count", () => {
    renderPage("super_admin");
    const table = within(screen.getByRole("table"));

    expect(table.getByText("auth.login")).toBeInTheDocument();
    expect(table.getByText("route.finished")).toBeInTheDocument();
    expect(table.getAllByText("Carlos Pérez")).toHaveLength(2);
    expect(screen.getByText("Página 1 de 1 · 2 eventos")).toBeInTheDocument();
  });

  it("requests the default page (limit 20, offset 0) with no filters applied", () => {
    renderPage();

    expect(lastFilterArg()).toEqual({
      action: undefined,
      userId: undefined,
      date: undefined,
      limit: 20,
      offset: 0,
    });
  });

  it("changing 'Evento' alone doesn't refetch — 'Aplicar' is enabled but not yet clicked", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Evento"), { target: { value: "route.finished" } });

    expect(lastFilterArg()).toMatchObject({ action: undefined, offset: 0 });
    expect(screen.getByRole("button", { name: "Aplicar" })).toBeEnabled();
  });

  it("clicking 'Aplicar' requests the pending 'Evento' server-side, resets to page 1, and syncs the URL", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Evento"), { target: { value: "route.finished" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(lastFilterArg()).toMatchObject({ action: "route.finished", offset: 0 });
    expect(replace).toHaveBeenLastCalledWith("/logs?action=route.finished", { scroll: false });
  });

  it("clicking 'Aplicar' requests the pending 'Fecha' server-side", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-09-16" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(lastFilterArg()).toMatchObject({ date: "2026-09-16", offset: 0 });
  });

  it("'Aplicar' starts disabled and stays disabled once the draft matches the applied filters", () => {
    renderPage();

    expect(screen.getByRole("button", { name: "Aplicar" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Evento"), { target: { value: "route.finished" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(screen.getByRole("button", { name: "Aplicar" })).toBeDisabled();
  });

  it("restores filters/pagination from the URL on load", () => {
    searchParams = new URLSearchParams("action=route.finished&size=50&page=2");

    renderPage();

    expect(lastFilterArg()).toMatchObject({ action: "route.finished", limit: 50, offset: 50 });
  });

  it("shows the empty state for no logs at all when there's no active filter", () => {
    useAuditLogs.mockReturnValue({
      logs: [],
      total: 0,
      isLoading: false,
      isRefetching: false,
      error: null,
      refetch,
    });

    renderPage();

    expect(screen.getByText("Todavía no hay eventos registrados.")).toBeInTheDocument();
  });

  it("shows a 'no matches' empty state when a filter is active and the page comes back empty", () => {
    useAuditLogs.mockReturnValue({
      logs: [],
      total: 0,
      isLoading: false,
      isRefetching: false,
      error: null,
      refetch,
    });
    renderPage();

    fireEvent.change(screen.getByLabelText("Evento"), { target: { value: "user.created" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(screen.getByText("Ningún evento coincide con estos filtros.")).toBeInTheDocument();
  });

  it("the 'Actualizar' button re-fetches the current page", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("'Página siguiente' advances the offset by the page size", () => {
    useAuditLogs.mockReturnValue({
      logs: [loginLog],
      total: 25,
      isLoading: false,
      isRefetching: false,
      error: null,
      refetch,
    });
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));

    expect(lastFilterArg()).toMatchObject({ limit: 20, offset: 20 });
  });

  it("'Página anterior' is disabled on the first page", () => {
    renderPage();

    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();
  });

  it("changing 'Filas por página' updates the limit and resets to page 1", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Filas por página"), { target: { value: "50" } });

    expect(lastFilterArg()).toMatchObject({ limit: 50, offset: 0 });
  });
});
