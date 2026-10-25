import { businessDate } from "@torpreca/shared";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withQueryClient } from "@/lib/test-utils/query-client";

// The duplicate dialog embeds AddressSearch, which wraps Mapbox's SearchBox web
// component (Shadow DOM, not implemented by jsdom) — same stand-in as
// route-stops-dialog.test.tsx.
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

// The real calculator needs a Mapbox canvas — stand in with a button that
// applies a fixed result, the way "Usar este valor" does.
vi.mock("./route-km-calculator-dialog", () => ({
  RouteKmCalculatorDialog: ({ onApply }: { onApply: (km: number, points: null) => void }) => (
    <button type="button" onClick={() => onApply(12.5, null)}>
      mock-calculator
    </button>
  ),
}));

// The filters live in the URL (like the logs screen): stand in for the app router.
const replace = vi.fn();
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/rutas",
  useSearchParams: () => searchParams,
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
  deactivatedAt: null,
  deactivatedBy: null,
  reviewedAt: null,
  reviewedBy: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const vehicle = {
  id: "v1",
  plate: "P-123ABC",
  model: "NPR",
  capacity: 10,
  active: true,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const pendingRoute = {
  id: "r1",
  code: "R-20260910-01",
  driverId: "11111111-1111-4111-8111-111111111111",
  vehicleId: null,
  createdBy: "admin-1",
  // Today: a pending route of a past day is "sin completar" (read-only).
  date: businessDate(),
  status: "pending",
  plannedKm: 10,
  drivenKm: 0,
  startTime: null,
  endTime: null,
  createdAt: "2026-09-10T00:00:00.000Z",
  updatedAt: "2026-09-10T00:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

// What the "server" currently has: the table's filtered search reads it, so a
// test can change it after a POST.
let serverRoutes: unknown[] = [];

function mockFetchRoutes(routes: unknown[]) {
  serverRoutes = routes;
  fetchMock.mockImplementation((url: string) => {
    if (url.startsWith("/api/routes/search")) {
      return Promise.resolve(jsonResponse({ items: serverRoutes, total: serverRoutes.length }));
    }
    if (url.startsWith("/api/routes/")) return Promise.resolve(jsonResponse(serverRoutes[0]));
    if (url.startsWith("/api/routes")) return Promise.resolve(jsonResponse(serverRoutes));
    if (url.startsWith("/api/users")) return Promise.resolve(jsonResponse([driver]));
    if (url.startsWith("/api/vehicles")) return Promise.resolve(jsonResponse([vehicle]));
    throw new Error(`unexpected fetch: ${url}`);
  });
}

beforeEach(() => {
  replace.mockReset();
  searchParams = new URLSearchParams();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

// The filters bar repeats words the modal and the table also use ("Conductor",
// "Pendiente", "Sin completar"...): scope the queries to the part under test.
const modal = () => within(screen.getByRole("dialog"));
const table = () => within(screen.getByRole("table"));

function renderPage() {
  return render(withQueryClient(<RutasPage />));
}

describe("RutasPage", () => {
  it("shows the empty state when there are no routes", async () => {
    mockFetchRoutes([]);

    renderPage();

    await waitFor(() => expect(screen.getByText("No hay rutas registradas.")).toBeInTheDocument());
  });

  it("lists routes with the driver's name and a status badge", async () => {
    mockFetchRoutes([pendingRoute]);

    renderPage();

    await waitFor(() => expect(screen.getByRole("cell", { name: "Carlos Pérez" })).toBeInTheDocument());
    expect(screen.getByText("R-20260910-01")).toBeInTheDocument();
    expect(table().getByText("Pendiente")).toBeInTheDocument();
  });

  // The modal's driver <select> can get its options after the routes load
  // (useUsers() may resolve later) — wait for the option before selecting it,
  // or the <select> silently ignores a value with no matching <option> yet.
  async function openCreateDialog() {
    await waitFor(() => expect(screen.getByRole("button", { name: "Nueva ruta" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Nueva ruta" }));
    await waitFor(() => expect(modal().getByRole("option", { name: "Carlos Pérez" })).toBeInTheDocument());
    fireEvent.change(modal().getByLabelText("Conductor"), {
      target: { value: "11111111-1111-4111-8111-111111111111" },
    });
  }

  it("keeps 'Crear ruta' disabled until driver, km and stops (or 'Sin paradas') are set", async () => {
    mockFetchRoutes([]);

    renderPage();
    await openCreateDialog();
    const submit = modal().getByRole("button", { name: "Crear ruta" });

    // Driver chosen, but no km and no stops yet.
    expect(submit).toBeDisabled();
    fireEvent.click(modal().getByText("mock-calculator"));
    expect(submit).toBeDisabled();
    fireEvent.click(modal().getByLabelText("Sin paradas"));
    await waitFor(() => expect(submit).not.toBeDisabled());

    // The code isn't shown while the route doesn't exist yet.
    expect(modal().queryByLabelText("Código (autogenerado)")).not.toBeInTheDocument();
  });

  it("rejects a past date", async () => {
    mockFetchRoutes([]);

    renderPage();
    await openCreateDialog();
    fireEvent.click(modal().getByText("mock-calculator"));
    fireEvent.click(modal().getByLabelText("Sin paradas"));
    const submit = modal().getByRole("button", { name: "Crear ruta" });
    await waitFor(() => expect(submit).not.toBeDisabled());

    fireEvent.change(modal().getByLabelText("Fecha"), { target: { value: "2020-01-01" } });

    expect(await modal().findByText("No puedes elegir una fecha pasada.")).toBeInTheDocument();
    expect(submit).toBeDisabled();
  });

  it("creating a route without stops sends no code (the server generates it) and prepends it to the list", async () => {
    mockFetchRoutes([]);

    renderPage();
    await waitFor(() => expect(screen.getByText("No hay rutas registradas.")).toBeInTheDocument());
    await openCreateDialog();

    fireEvent.click(modal().getByText("mock-calculator"));
    fireEvent.click(modal().getByLabelText("Sin paradas"));

    fetchMock.mockImplementationOnce(() => {
      serverRoutes = [pendingRoute];
      return Promise.resolve(jsonResponse(pendingRoute, 201));
    });
    fireEvent.click(modal().getByRole("button", { name: "Crear ruta" }));

    await waitFor(() => expect(screen.getByRole("cell", { name: "Carlos Pérez" })).toBeInTheDocument());
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(postCall).toBeDefined();
    const body = JSON.parse((postCall?.[1] as RequestInit).body as string);
    expect(body).toMatchObject({
      driverId: "11111111-1111-4111-8111-111111111111",
      vehicleId: null,
      plannedKm: 12.5,
      stops: [],
    });
    expect(body).not.toHaveProperty("code");
  });

  it("creating a route sends the stops added in the modal, in order", async () => {
    mockFetchRoutes([]);

    renderPage();
    await waitFor(() => expect(screen.getByText("No hay rutas registradas.")).toBeInTheDocument());
    await openCreateDialog();

    fireEvent.click(modal().getByText("mock-calculator"));
    for (const customer of ["Tienda A", "Tienda B"]) {
      fireEvent.change(modal().getAllByLabelText("Cliente")[0] as HTMLElement, {
        target: { value: customer },
      });
      fireEvent.click(modal().getByText("mock-address-search"));
      fireEvent.click(modal().getByRole("button", { name: "Agregar a la lista" }));
    }

    fetchMock.mockImplementationOnce(() => {
      serverRoutes = [pendingRoute];
      return Promise.resolve(jsonResponse(pendingRoute, 201));
    });
    fireEvent.click(modal().getByRole("button", { name: "Crear ruta" }));

    await waitFor(() => expect(screen.getByRole("cell", { name: "Carlos Pérez" })).toBeInTheDocument());
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    const body = JSON.parse((postCall?.[1] as RequestInit).body as string);
    expect(body.stops.map((st: { customerName: string }) => st.customerName)).toEqual([
      "Tienda A",
      "Tienda B",
    ]);
  });

  it("only shows 'Editar' for pending routes", async () => {
    mockFetchRoutes([{ ...pendingRoute, id: "r2", status: "completed" }]);

    renderPage();

    await waitFor(() => expect(screen.getByRole("cell", { name: "Carlos Pérez" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });

  it("editing a pending route submits the changes via PATCH", async () => {
    mockFetchRoutes([pendingRoute]);

    renderPage();
    await waitFor(() => expect(screen.getByRole("cell", { name: "Carlos Pérez" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    const plannedKmInputs = screen.getAllByDisplayValue("10");
    const editInput = plannedKmInputs[plannedKmInputs.length - 1];
    fireEvent.change(editInput, { target: { value: "40" } });

    const saveButton = screen.getByRole("button", { name: "Guardar" });
    await waitFor(() => expect(saveButton).not.toBeDisabled());

    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(jsonResponse({ ...pendingRoute, plannedKm: 40 })),
    );
    fireEvent.click(saveButton);

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
      expect(patchCall).toBeDefined();
    });
    const patchCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(patchCall?.[0]).toBe("/api/routes/r1");
    const body = JSON.parse((patchCall?.[1] as RequestInit).body as string);
    expect(body.plannedKm).toBe(40);
  });

  describe("routes that weren't completed (sin completar)", () => {
    const overduePending = { ...pendingRoute, id: "r3", code: "R-20200101-01", date: "2020-01-01" };
    const overdueRunning = {
      ...overduePending,
      id: "r4",
      code: "R-20200101-02",
      status: "in_progress",
      startTime: "2020-01-01T10:00:00.000Z",
    };

    it("marks them 'Sin completar', hides 'Editar' and offers 'Duplicar'", async () => {
      mockFetchRoutes([overduePending]);

      renderPage();

      await waitFor(() => expect(table().getByText("Sin completar")).toBeInTheDocument());
      expect(table().queryByText("Pendiente")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Duplicar" })).toBeInTheDocument();
      expect(screen.getByText(/solo de lectura/)).toBeInTheDocument();
      // Nothing was started, so there is nothing to close.
      expect(screen.queryByRole("button", { name: "Cerrar" })).not.toBeInTheDocument();
    });

    it("keeps today's pending route editable and not overdue", async () => {
      mockFetchRoutes([pendingRoute]);

      renderPage();

      await waitFor(() => expect(table().getByText("Pendiente")).toBeInTheDocument());
      expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
      expect(table().queryByText("Sin completar")).not.toBeInTheDocument();
    });

    it("closing an overdue in-progress route asks for confirmation, then PATCHes /close", async () => {
      mockFetchRoutes([overdueRunning]);

      renderPage();
      const closeButton = await screen.findByRole("button", { name: "Cerrar" });

      fireEvent.click(closeButton);
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);

      // The table is refetched after the close, so the server now has it cancelled.
      const closed = { ...overdueRunning, status: "cancelled", drivenKm: 3.2 };
      fetchMock.mockImplementationOnce(() => {
        serverRoutes = [closed];
        return Promise.resolve(jsonResponse(closed));
      });
      fireEvent.click(screen.getByRole("button", { name: "¿Cerrar ruta?" }));

      await waitFor(() => {
        const call = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
        expect(call?.[0]).toBe("/api/routes/r4/close");
      });
      // Once closed it's no longer running: the close button goes away.
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: /Cerrar/ })).not.toBeInTheDocument(),
      );
    });

    it("duplicating pre-loads the source stops and POSTs the new route with them", async () => {
      const sourceStops = [
        {
          id: "s1",
          routeId: "r3",
          order: 1,
          customerName: "Tienda La Esquina",
          address: "6a Avenida 12-34, Zona 1",
          lat: 14.63,
          lng: -90.51,
          instructions: null,
          status: "completed",
          estimatedTime: null,
          completedTime: "2020-01-01T12:00:00.000Z",
          createdAt: "2020-01-01T00:00:00.000Z",
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
        {
          id: "s2",
          routeId: "r3",
          order: 2,
          customerName: "Panadería Sol",
          address: "Calzada Roosevelt 5-67",
          lat: 14.62,
          lng: -90.55,
          instructions: "Puerta azul",
          status: "delayed",
          estimatedTime: null,
          completedTime: null,
          createdAt: "2020-01-01T00:00:00.000Z",
          updatedAt: "2020-01-01T00:00:00.000Z",
        },
      ];
      fetchMock.mockImplementation((url: string, init?: RequestInit) => {
        if (url === "/api/routes/r3/stops") return Promise.resolve(jsonResponse(sourceStops));
        if (url === "/api/routes/r3/duplicate" && init?.method === "POST") {
          return Promise.resolve(
            jsonResponse({ ...pendingRoute, id: "r5", code: "R-new", plannedKm: 10 }, 201),
          );
        }
        if (url.startsWith("/api/routes/search")) {
          return Promise.resolve(jsonResponse({ items: [overduePending], total: 1 }));
        }
        if (url.startsWith("/api/routes")) return Promise.resolve(jsonResponse([overduePending]));
        if (url.startsWith("/api/users")) return Promise.resolve(jsonResponse([driver]));
        if (url.startsWith("/api/vehicles")) return Promise.resolve(jsonResponse([vehicle]));
        throw new Error(`unexpected fetch: ${url}`);
      });

      renderPage();
      fireEvent.click(await screen.findByRole("button", { name: "Duplicar" }));

      // Both stops are loaded into the editable list; drop the first one.
      expect(await screen.findByText("Panadería Sol")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Eliminar: Tienda La Esquina" }));
      expect(screen.queryByText("Tienda La Esquina")).not.toBeInTheDocument();

      // ...and add a brand-new one through the same form the stops dialog uses.
      fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "Nuevo Cliente" } });
      fireEvent.click(screen.getByRole("button", { name: "mock-address-search" }));
      fireEvent.click(screen.getByRole("button", { name: "Agregar a la lista" }));
      expect(await screen.findByText("Nuevo Cliente")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Crear ruta duplicada" }));

      await waitFor(() => {
        const call = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
        expect(call?.[0]).toBe("/api/routes/r3/duplicate");
      });
      const call = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      const body = JSON.parse((call?.[1] as RequestInit).body as string);
      expect(body).toMatchObject({
        date: businessDate(),
        driverId: driver.id,
        vehicleId: null,
        plannedKm: 10,
        stops: [
          {
            customerName: "Panadería Sol",
            address: "Calzada Roosevelt 5-67",
            lat: 14.62,
            lng: -90.55,
            instructions: "Puerta azul",
          },
          {
            customerName: "Nuevo Cliente",
            address: "Zona 1, Guatemala",
            lat: 14.63,
            lng: -90.51,
            instructions: null,
          },
        ],
      });
      // The stops go over as plain data — no state, no ids: the copy starts over.
      expect(body.stops[0]).not.toHaveProperty("status");
      expect(body.stops[0]).not.toHaveProperty("id");
      expect(body).not.toHaveProperty("code");
    });
  });
});
