import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withQueryClient } from "@/lib/test-utils/query-client";

vi.mock("@/lib/supabase/access-token", () => ({ getAccessToken: vi.fn(async () => "tok") }));

const listRoutes = vi.fn();
const createRoute = vi.fn();
const updateRoute = vi.fn();
vi.mock("@/lib/api/routes-client", () => ({
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
    expect(updateRoute).toHaveBeenCalledWith("tok", pendingRoute.id, { plannedKm: 25 });
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
});