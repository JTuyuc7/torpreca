import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withQueryClient } from "@/lib/test-utils/query-client";

vi.mock("@/lib/supabase/access-token", () => ({ getAccessToken: vi.fn(async () => "tok") }));

const listAllVehicles = vi.fn();
const createVehicle = vi.fn();
const updateVehicle = vi.fn();
const deactivateVehicle = vi.fn();
vi.mock("@/lib/api/vehicles-client", () => ({
  listAllVehicles: (...args: unknown[]) => listAllVehicles(...args),
  createVehicle: (...args: unknown[]) => createVehicle(...args),
  updateVehicle: (...args: unknown[]) => updateVehicle(...args),
  deactivateVehicle: (...args: unknown[]) => deactivateVehicle(...args),
}));

import { useVehicles } from "./use-vehicles";

const vehicle = {
  id: "v1",
  plate: "P-123ABC",
  model: "NPR",
  capacity: 10,
  category: "truck" as const,
  notes: null,
  active: true,
  createdAt: "2026-09-10T00:00:00.000Z",
  updatedAt: "2026-09-10T00:00:00.000Z",
};

beforeEach(() => {
  listAllVehicles.mockReset();
  createVehicle.mockReset();
  updateVehicle.mockReset();
  deactivateVehicle.mockReset();
});

function renderUseVehicles() {
  return renderHook(() => useVehicles(), { wrapper: ({ children }) => withQueryClient(children) });
}

describe("useVehicles", () => {
  it("loads the vehicle list", async () => {
    listAllVehicles.mockResolvedValue({ ok: true, vehicles: [vehicle] });

    const { result } = renderUseVehicles();

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.vehicles).toEqual([vehicle]));
    expect(result.current.error).toBeNull();
  });

  it("surfaces a load failure as `error`", async () => {
    listAllVehicles.mockResolvedValue({ ok: false, status: 500 });

    const { result } = renderUseVehicles();

    await waitFor(() => expect(result.current.error).toBe("No se pudieron cargar los vehículos."));
  });

  it("createVehicle prepends the created vehicle to the cached list on success", async () => {
    listAllVehicles.mockResolvedValue({ ok: true, vehicles: [] });
    createVehicle.mockResolvedValue({ ok: true, vehicle });

    const { result } = renderUseVehicles();
    await waitFor(() => expect(result.current.vehicles).toEqual([]));

    result.current.createVehicle.mutate({
      plate: "P-123ABC",
      model: "NPR",
      capacity: 10,
      category: "truck",
      notes: null,
    });

    await waitFor(() => expect(result.current.vehicles).toEqual([vehicle]));
  });

  it("updateVehicle replaces the edited vehicle in the cached list", async () => {
    listAllVehicles.mockResolvedValue({ ok: true, vehicles: [vehicle] });
    const edited = { ...vehicle, model: "NQR" };
    updateVehicle.mockResolvedValue({ ok: true, vehicle: edited });

    const { result } = renderUseVehicles();
    await waitFor(() => expect(result.current.vehicles).toEqual([vehicle]));

    result.current.updateVehicle.mutate({ id: vehicle.id, input: { model: "NQR" } });

    await waitFor(() => expect(result.current.vehicles).toEqual([edited]));
  });

  it("deactivateVehicle marks the vehicle inactive in the cached list", async () => {
    listAllVehicles.mockResolvedValue({ ok: true, vehicles: [vehicle] });
    deactivateVehicle.mockResolvedValue({ ok: true });

    const { result } = renderUseVehicles();
    await waitFor(() => expect(result.current.vehicles).toEqual([vehicle]));

    result.current.deactivateVehicle.mutate(vehicle.id);

    await waitFor(() =>
      expect(result.current.vehicles).toEqual([{ ...vehicle, active: false }]),
    );
  });
});