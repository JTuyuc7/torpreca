import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withQueryClient } from "@/lib/test-utils/query-client";

vi.mock("@/lib/supabase/access-token", () => ({ getAccessToken: vi.fn(async () => "tok") }));

const listActiveVehicles = vi.fn();
vi.mock("@/lib/api/vehicles-client", () => ({
  listActiveVehicles: (...args: unknown[]) => listActiveVehicles(...args),
}));

import { useVehicles } from "./use-vehicles";

const vehicle = {
  id: "v1",
  plate: "P-123ABC",
  model: "NPR",
  capacity: 10,
  active: true,
  createdAt: "2026-09-10T00:00:00.000Z",
  updatedAt: "2026-09-10T00:00:00.000Z",
};

beforeEach(() => {
  listActiveVehicles.mockReset();
});

function renderUseVehicles() {
  return renderHook(() => useVehicles(), { wrapper: ({ children }) => withQueryClient(children) });
}

describe("useVehicles", () => {
  it("loads the vehicle list", async () => {
    listActiveVehicles.mockResolvedValue({ ok: true, vehicles: [vehicle] });

    const { result } = renderUseVehicles();

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.vehicles).toEqual([vehicle]));
    expect(result.current.error).toBeNull();
  });

  it("surfaces a load failure as `error`", async () => {
    listActiveVehicles.mockResolvedValue({ ok: false, status: 500 });

    const { result } = renderUseVehicles();

    await waitFor(() => expect(result.current.error).toBe("No se pudieron cargar los vehículos."));
  });
});