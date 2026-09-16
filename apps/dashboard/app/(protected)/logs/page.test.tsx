import type { Role } from "@torpreca/shared";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthUserProvider } from "../auth-context";

const useAuditLogs = vi.fn();
vi.mock("@/lib/hooks/use-audit-logs", () => ({ useAuditLogs: () => useAuditLogs() }));

const useUsers = vi.fn();
vi.mock("@/lib/hooks/use-users", () => ({ useUsers: () => useUsers() }));

import LogsPage from "./page";

function renderPage(role: Role = "super_admin") {
  return render(
    <AuthUserProvider user={{ id: "u1", role, status: "active" }}>
      <LogsPage />
    </AuthUserProvider>,
  );
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
  useAuditLogs.mockReturnValue({
    logs: [loginLog, routeFinishedLog],
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

  it("lists every event for super_admin, resolving the driver's name", () => {
    renderPage("super_admin");
    const table = within(screen.getByRole("table"));

    expect(table.getByText("auth.login")).toBeInTheDocument();
    expect(table.getByText("route.finished")).toBeInTheDocument();
    expect(table.getAllByText("Carlos Pérez")).toHaveLength(2);
  });

  it("filters by event type", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Evento"), { target: { value: "route.finished" } });
    const table = within(screen.getByRole("table"));

    expect(table.queryByText("auth.login")).not.toBeInTheDocument();
    expect(table.getByText("route.finished")).toBeInTheDocument();
  });

  it("filters by date", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-09-16" } });
    const table = within(screen.getByRole("table"));

    expect(table.getByText("auth.login")).toBeInTheDocument();
    expect(table.queryByText("route.finished")).not.toBeInTheDocument();
  });

  it("shows an empty state distinguishing no logs at all from no filter matches", () => {
    useAuditLogs.mockReturnValue({
      logs: [],
      isLoading: false,
      isRefetching: false,
      error: null,
      refetch,
    });

    renderPage();

    expect(screen.getByText("Todavía no hay eventos registrados.")).toBeInTheDocument();
  });

  it("shows a 'no matches' empty state when filters exclude every log", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Evento"), { target: { value: "user.created" } });

    expect(screen.getByText("Ningún evento coincide con estos filtros.")).toBeInTheDocument();
  });

  it("the 'Actualizar' button re-fetches the logs", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
