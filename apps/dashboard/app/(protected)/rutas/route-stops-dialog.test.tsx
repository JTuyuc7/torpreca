import type { Route } from "@torpreca/shared";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withQueryClient } from "@/lib/test-utils/query-client";

// AddressSearch wraps Mapbox's SearchBox web component (Shadow DOM, not
// implemented by jsdom) — same stand-in as app/(protected)/page.test.tsx.
vi.mock("@/components/ui/address-search", () => ({
  AddressSearch: ({
    onSelect,
  }: {
    onSelect: (coordinates: { lng: number; lat: number }, name: string) => void;
  }) => (
    <button type="button" onClick={() => onSelect({ lng: -90.51, lat: 14.63 }, "Zona 1, Guatemala")}>
      mock-address-search
    </button>
  ),
}));

import { RouteStopsDialog } from "./route-stops-dialog";

const fetchMock = vi.fn();

const route: Route = {
  id: "r1",
  code: "R-20260924-01",
  driverId: "driver-1",
  vehicleId: null,
  createdBy: "admin-1",
  date: "2026-09-24",
  status: "pending",
  plannedKm: 10,
  drivenKm: 0,
  startTime: null,
  endTime: null,
  createdAt: "2026-09-24T00:00:00.000Z",
  updatedAt: "2026-09-24T00:00:00.000Z",
};

function makeStop(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    routeId: "r1",
    order: 1,
    customerName: "Tienda La Esquina",
    address: "6a Avenida, Zona 1",
    lat: 14.63,
    lng: -90.51,
    instructions: null,
    status: "pending",
    estimatedTime: null,
    completedTime: null,
    createdAt: "2026-09-24T00:00:00.000Z",
    updatedAt: "2026-09-24T00:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

async function openDialog(stops: unknown[], routeOverride = route) {
  fetchMock.mockImplementation((url: string) => {
    if (url === "/api/routes/r1/stops") return Promise.resolve(jsonResponse(stops));
    throw new Error(`unexpected fetch: ${url}`);
  });
  render(withQueryClient(<RouteStopsDialog route={routeOverride} />));
  fireEvent.click(screen.getByRole("button", { name: "Paradas" }));
}

describe("RouteStopsDialog", () => {
  it("does not fetch until it is opened", () => {
    render(withQueryClient(<RouteStopsDialog route={route} />));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the empty state for a route without stops", async () => {
    await openDialog([]);
    expect(await screen.findByText("Esta ruta todavía no tiene paradas.")).toBeInTheDocument();
  });

  it("lists the stops in order", async () => {
    await openDialog([
      makeStop(),
      makeStop({ id: "s2", order: 2, customerName: "Panadería Sol", status: "delayed" }),
    ]);

    expect(await screen.findByText("Tienda La Esquina")).toBeInTheDocument();
    expect(screen.getByText("Panadería Sol")).toBeInTheDocument();
    expect(screen.getByText("Retrasada")).toBeInTheDocument();
  });

  it("requires a customer and an address before creating a stop", async () => {
    await openDialog([]);
    await screen.findByText("Esta ruta todavía no tiene paradas.");

    fireEvent.click(screen.getByRole("button", { name: "Agregar parada" }));

    expect(screen.getByText("Ingresa el nombre del cliente.")).toBeInTheDocument();
    expect(screen.getByText("Busca y selecciona una dirección.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1); // only the initial list
  });

  it("creates a stop with the selected address and coordinates and appends it to the list", async () => {
    await openDialog([]);
    await screen.findByText("Esta ruta todavía no tiene paradas.");

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/routes/r1/stops" && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse(makeStop({ customerName: "Nuevo Cliente", address: "Zona 1, Guatemala" }), 201),
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "  Nuevo Cliente " } });
    fireEvent.click(screen.getByRole("button", { name: "mock-address-search" }));
    fireEvent.change(screen.getByLabelText("Instrucciones (opcional)"), {
      target: { value: "Tocar el timbre" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Agregar parada" }));

    expect(await screen.findByText("Nuevo Cliente")).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls.find(([, i]) => i?.method === "POST") as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      customerName: "Nuevo Cliente",
      address: "Zona 1, Guatemala",
      lat: 14.63,
      lng: -90.51,
      instructions: "Tocar el timbre",
    });
  });

  it("edits a stop: prefills the form and saves through PATCH /api/stops/:id", async () => {
    await openDialog([makeStop()]);
    fireEvent.click(await screen.findByRole("button", { name: "Editar: Tienda La Esquina" }));

    expect(screen.getByLabelText("Cliente")).toHaveValue("Tienda La Esquina");

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/stops/s1" && init?.method === "PATCH") {
        return Promise.resolve(jsonResponse(makeStop({ customerName: "Tienda Renombrada" })));
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "Tienda Renombrada" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Tienda Renombrada")).toBeInTheDocument();
  });

  it("deletes a stop after an inline confirmation", async () => {
    await openDialog([makeStop()]);
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar: Tienda La Esquina" }));

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/stops/s1" && init?.method === "DELETE") {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    // Nothing is deleted by the first click — only the confirm button does it.
    expect(fetchMock.mock.calls.filter(([, i]) => i?.method === "DELETE")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "¿Eliminar?" }));

    await waitFor(() => expect(screen.queryByText("Tienda La Esquina")).not.toBeInTheDocument());
  });

  it("reorders with the arrow buttons, sending the full new order", async () => {
    await openDialog([
      makeStop(),
      makeStop({ id: "s2", order: 2, customerName: "Panadería Sol" }),
    ]);
    await screen.findByText("Tienda La Esquina");

    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === "/api/routes/r1/stops/order" && init?.method === "PATCH") {
        return Promise.resolve(
          jsonResponse([
            makeStop({ id: "s2", order: 1, customerName: "Panadería Sol" }),
            makeStop({ id: "s1", order: 2 }),
          ]),
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    fireEvent.click(screen.getByRole("button", { name: "Subir: Panadería Sol" }));

    await waitFor(() => {
      const [, init] = fetchMock.mock.calls.find(([, i]) => i?.method === "PATCH") as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toEqual({ stopIds: ["s2", "s1"] });
    });
  });

  it("is read-only once the route is no longer pending", async () => {
    await openDialog([makeStop()], { ...route, status: "in_progress" });

    expect(await screen.findByText("Tienda La Esquina")).toBeInTheDocument();
    expect(screen.getByText(/ya no está pendiente/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agregar parada" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Editar:/ })).not.toBeInTheDocument();
  });

  it("shows an error banner when loading fails", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    render(withQueryClient(<RouteStopsDialog route={route} />));
    fireEvent.click(screen.getByRole("button", { name: "Paradas" }));

    expect(await screen.findByText("No se pudieron cargar las paradas.")).toBeInTheDocument();
  });
});
