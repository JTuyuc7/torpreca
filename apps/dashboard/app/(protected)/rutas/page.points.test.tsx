import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withQueryClient } from "@/lib/test-utils/query-client";

// The real calculator needs a Mapbox canvas — stand in with a button that
// applies a fixed result, the way "Usar este valor" does.
vi.mock("./route-km-calculator-dialog", () => ({
  RouteKmCalculatorDialog: ({
    onApply,
  }: {
    onApply: (
      km: number,
      points: { origin: { lng: number; lat: number }; destination: { lng: number; lat: number } },
    ) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onApply(5, {
          origin: { lng: -90.51, lat: 14.64 },
          destination: { lng: -90.53, lat: 14.62 },
        })
      }
    >
      mock-calculator
    </button>
  ),
}));

import RutasPage from "./page";

const fetchMock = vi.fn();

const driver = {
  id: "11111111-1111-4111-8111-111111111111",
  authUserId: "auth-driver-1",
  name: "Carlos Pérez",
  email: "carlos@torpreca.gt",
  role: "driver",
  status: "active",
  deactivatedBy: null,
  deactivatedAt: null,
  reviewedAt: null,
  reviewedBy: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      return Promise.resolve(jsonResponse({ id: "r1", ...JSON.parse(init.body as string) }, 201));
    }
    if (url.startsWith("/api/users")) return Promise.resolve(jsonResponse([driver]));
    if (url.startsWith("/api/vehicles")) return Promise.resolve(jsonResponse([]));
    return Promise.resolve(jsonResponse([]));
  });
  vi.stubGlobal("fetch", fetchMock);
});

describe("RutasPage — A/B points", () => {
  it("creating a route after using the calculator sends the A/B points too", async () => {
    render(withQueryClient(<RutasPage />));
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Carlos Pérez" })).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText("Conductor"), { target: { value: driver.id } });
    fireEvent.click(screen.getByText("mock-calculator"));

    const submit = screen.getByRole("button", { name: "Crear ruta" });
    await waitFor(() => expect(submit).not.toBeDisabled());
    fireEvent.click(submit);

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true),
    );
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    const body = JSON.parse((postCall?.[1] as RequestInit).body as string);
    expect(body).toMatchObject({
      plannedKm: 5,
      originLat: 14.64,
      originLng: -90.51,
      destinationLat: 14.62,
      destinationLng: -90.53,
    });
  });
});
