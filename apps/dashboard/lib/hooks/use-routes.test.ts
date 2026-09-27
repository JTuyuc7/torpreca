import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withQueryClient } from "@/lib/test-utils/query-client";

const listRoutes = vi.fn();
const createRoute = vi.fn();
const updateRoute = vi.fn();
const duplicateRoute = vi.fn();
const closeRoute = vi.fn();
vi.mock("@/lib/api/routes-client", () => ({
  duplicateRoute: (...args: unknown[]) => duplicateRoute(...args),
  closeRoute: (...args: unknown[]) => closeRoute(...args),
  listRoutes: (...args: unknown[]) => listRoutes(...args),
  createRoute: (...args: unknown[]) => createRoute(...args),
  updateRoute: (...args: unknown[]) => updateRoute(...args),
}));

import { useRoutes } from "./use-routes";

const pendingRoute = {
  id: "r1",
  code: "R-20260910-01",
  driverId: "driver-1",
  vehicleId: null,
  createdBy: "admin-1",
  date: "2026-09-10",
  status: "pending" as const,
  plannedKm: 10,
  drivenKm: 0,
  startTime: null,
  endTime: null,
  createdAt: "2026-09-10T00:00:00.000Z",
  updatedAt: "2026-09-10T00:00:00.000Z",
};

beforeEach(() => {
  listRoutes.mockReset();
  createRoute.mockReset();
  updateRoute.mockReset();
  duplicateRoute.mockReset();
  closeRoute.mockReset();
});

function renderUseRoutes() {
  return renderHook(() => useRoutes(), { wrapper: ({ children }) => withQueryClient(children) });
}

describe("useRoutes", () => {
  it("loads the route list", async () => {
    listRoutes.mockResolvedValue({ ok: true, routes: [pendingRoute] });

    const { result } = renderUseRoutes();

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.routes).toEqual([pendingRoute]));
    expect(result.current.error).toBeNull();
  });

  it("surfaces a load failure as `error`", async () => {
    listRoutes.mockResolvedValue({ ok: false, status: 500 });

    const { result } = renderUseRoutes();

    await waitFor(() => expect(result.current.error).toBe("No se pudieron cargar las rutas."));
  });

  it("createRoute prepends the created route to the cached list on success", async () => {
    listRoutes.mockResolvedValue({ ok: true, routes: [] });
    createRoute.mockResolvedValue({ ok: true, route: pendingRoute });

    const { result } = renderUseRoutes();
    await waitFor(() => expect(result.current.routes).toEqual([]));

    result.current.createRoute.mutate({
      code: "R-20260910-01",
      driverId: "driver-1",
      vehicleId: null,
      date: "2026-09-10",
      plannedKm: 10,
    });

    await waitFor(() => expect(result.current.routes).toEqual([pendingRoute]));
  });

  it("updateRoute replaces the edited route in the cached list", async () => {
    listRoutes.mockResolvedValue({ ok: true, routes: [pendingRoute] });
    const edited = { ...pendingRoute, plannedKm: 25 };
    updateRoute.mockResolvedValue({ ok: true, route: edited });

    const { result } = renderUseRoutes();
    await waitFor(() => expect(result.current.routes).toEqual([pendingRoute]));

    result.current.updateRoute.mutate({ id: pendingRoute.id, input: { plannedKm: 25 } });

    await waitFor(() => expect(result.current.routes).toEqual([edited]));
    expect(updateRoute).toHaveBeenCalledWith(pendingRoute.id, { plannedKm: 25 });
  });

  it("updateRoute surfaces a 409 as a friendly 'not pending' message", async () => {
    listRoutes.mockResolvedValue({ ok: true, routes: [pendingRoute] });
    updateRoute.mockResolvedValue({ ok: false, status: 409 });

    const { result } = renderUseRoutes();
    await waitFor(() => expect(result.current.routes).toEqual([pendingRoute]));

    result.current.updateRoute.mutate({ id: pendingRoute.id, input: { plannedKm: 25 } });

    await waitFor(() =>
      expect(result.current.updateRoute.error?.message).toBe(
        "La ruta ya no está pendiente y no se puede editar.",
      ),
    );
  });

  it("duplicateRoute prepends the new route to the cached list", async () => {
    listRoutes.mockResolvedValue({ ok: true, routes: [pendingRoute] });
    const copy = { ...pendingRoute, id: "r2", date: "2026-09-27" };
    duplicateRoute.mockResolvedValue({ ok: true, route: copy });

    const { result } = renderUseRoutes();
    await waitFor(() => expect(result.current.routes).toEqual([pendingRoute]));

    const input = {
      code: "R-20260927-01",
      driverId: "driver-1",
      vehicleId: null,
      date: "2026-09-27",
      plannedKm: 10,
      stops: [],
    };
    result.current.duplicateRoute.mutate({ id: pendingRoute.id, input });

    await waitFor(() => expect(result.current.routes).toEqual([copy, pendingRoute]));
    expect(duplicateRoute).toHaveBeenCalledWith(pendingRoute.id, input);
  });

  it("duplicateRoute surfaces a 404 as 'the original route no longer exists'", async () => {
    listRoutes.mockResolvedValue({ ok: true, routes: [pendingRoute] });
    duplicateRoute.mockResolvedValue({ ok: false, status: 404 });

    const { result } = renderUseRoutes();
    await waitFor(() => expect(result.current.routes).toEqual([pendingRoute]));

    result.current.duplicateRoute.mutate({
      id: pendingRoute.id,
      input: {
        code: "R-1",
        driverId: "driver-1",
        vehicleId: null,
        date: "2026-09-27",
        plannedKm: null,
        stops: [],
      },
    });

    await waitFor(() =>
      expect(result.current.duplicateRoute.error?.message).toBe("La ruta original ya no existe."),
    );
  });

  it("closeRoute replaces the route in the cached list with the closed one", async () => {
    const running = { ...pendingRoute, status: "in_progress" as const };
    listRoutes.mockResolvedValue({ ok: true, routes: [running] });
    const closed = { ...running, status: "cancelled" as const, drivenKm: 3.2 };
    closeRoute.mockResolvedValue({ ok: true, route: closed });

    const { result } = renderUseRoutes();
    await waitFor(() => expect(result.current.routes).toEqual([running]));

    result.current.closeRoute.mutate(running.id);

    await waitFor(() => expect(result.current.routes).toEqual([closed]));
    expect(closeRoute).toHaveBeenCalledWith(running.id);
  });

  it("closeRoute surfaces a 409 as a friendly message", async () => {
    listRoutes.mockResolvedValue({ ok: true, routes: [pendingRoute] });
    closeRoute.mockResolvedValue({ ok: false, status: 409 });

    const { result } = renderUseRoutes();
    await waitFor(() => expect(result.current.routes).toEqual([pendingRoute]));

    result.current.closeRoute.mutate(pendingRoute.id);

    await waitFor(() =>
      expect(result.current.closeRoute.error?.message).toBe(
        "La ruta ya no está en curso o todavía no está vencida.",
      ),
    );
  });
});
