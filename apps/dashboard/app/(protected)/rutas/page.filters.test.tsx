import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withQueryClient } from "@/lib/test-utils/query-client";

// Mapbox SearchBox (jsdom has no Shadow DOM) — the page embeds the modals.
vi.mock("@/components/ui/address-search", () => ({ AddressSearch: () => null }));

// The filters live in the URL: stand in for the app router and drive the
// params by hand.
const replace = vi.fn();
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/rutas",
  useSearchParams: () => searchParams,
}));

import RutasPage from "./page";

const fetchMock = vi.fn();

const DRIVER_ID = "11111111-1111-4111-8111-111111111111";
const VEHICLE_ID = "22222222-2222-4222-8222-222222222222";

const driver = {
  id: DRIVER_ID,
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
  id: VEHICLE_ID,
  plate: "P-123ABC",
  model: "NPR",
  capacity: 10,
  active: true,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

function route(n: number) {
  return {
    id: `r${n}`,
    code: `R-${String(n).padStart(5, "0")}`,
    driverId: DRIVER_ID,
    vehicleId: null,
    createdBy: "admin-1",
    date: "2999-01-01",
    status: "pending",
    plannedKm: 10,
    drivenKm: 0,
    startTime: null,
    endTime: null,
    createdAt: "2026-09-10T00:00:00.000Z",
    updatedAt: "2026-09-10T00:00:00.000Z",
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

let searchResult: { items: unknown[]; total: number } = { items: [], total: 0 };

function searchCalls(): URLSearchParams[] {
  return fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.startsWith("/api/routes/search"))
    .map((url) => new URL(url, "http://x").searchParams);
}

beforeEach(() => {
  replace.mockReset();
  searchParams = new URLSearchParams();
  searchResult = { items: [route(1)], total: 1 };
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => {
    if (url.startsWith("/api/routes/search")) return Promise.resolve(jsonResponse(searchResult));
    if (url.startsWith("/api/routes")) return Promise.resolve(jsonResponse(searchResult.items));
    if (url.startsWith("/api/users")) return Promise.resolve(jsonResponse([driver]));
    if (url.startsWith("/api/vehicles")) return Promise.resolve(jsonResponse([vehicle]));
    throw new Error(`unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});

function renderPage() {
  return render(withQueryClient(<RutasPage />));
}

describe("RutasPage — filters and pagination", () => {
  it("asks the server for the first page, 10 at a time, with no filters", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText("R-00001")).toBeInTheDocument());
    expect(searchCalls()[0]?.toString()).toBe("limit=10&offset=0");
  });

  it("applies the filters found in the URL", async () => {
    searchParams = new URLSearchParams(
      `status=overdue&driver=${DRIVER_ID}&vehicle=${VEHICLE_ID}&from=2026-01-01&to=2026-01-31&q=R-001&page=3`,
    );

    renderPage();

    await waitFor(() => expect(searchCalls().length).toBeGreaterThan(0));
    const params = searchCalls()[0] as URLSearchParams;
    expect(Object.fromEntries(params)).toEqual({
      status: "overdue",
      driverId: DRIVER_ID,
      vehicleId: VEHICLE_ID,
      from: "2026-01-01",
      to: "2026-01-31",
      q: "R-001",
      limit: "10",
      offset: "20",
    });
  });

  it("changing a filter does nothing until 'Buscar' is pressed, then writes the URL on page 1", async () => {
    searchParams = new URLSearchParams("page=2");
    searchResult = { items: [route(11)], total: 15 };

    renderPage();
    await waitFor(() => expect(screen.getByText("R-00011")).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Carlos Pérez" })).toBeInTheDocument(),
    );
    const callsBefore = searchCalls().length;

    fireEvent.change(screen.getByLabelText("Conductor"), { target: { value: DRIVER_ID } });
    fireEvent.change(screen.getByLabelText("Buscar por código"), { target: { value: " R-0 " } });

    expect(replace).not.toHaveBeenCalled();
    expect(searchCalls().length).toBe(callsBefore);

    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(`/rutas?q=R-0&driver=${DRIVER_ID}`, { scroll: false });
  });

  it("submits the search with Enter in the code box", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("R-00001")).toBeInTheDocument());

    const input = screen.getByLabelText("Buscar por código");
    fireEvent.change(input, { target: { value: "R-0" } });
    fireEvent.submit(input);

    expect(replace).toHaveBeenCalledWith("/rutas?q=R-0", { scroll: false });
  });

  it("pages forward and back, keeping the other filters", async () => {
    searchParams = new URLSearchParams("status=pending");
    searchResult = { items: [route(1)], total: 25 };

    renderPage();
    await waitFor(() => expect(screen.getByText("Página 1 de 3 · 25 rutas")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Página anterior" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));

    expect(replace).toHaveBeenCalledWith("/rutas?status=pending&page=2", { scroll: false });
  });

  it("disables 'next' on the last page", async () => {
    searchParams = new URLSearchParams("page=3");
    searchResult = { items: [route(21)], total: 21 };

    renderPage();

    await waitFor(() => expect(screen.getByText("Página 3 de 3 · 21 rutas")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Página siguiente" })).toBeDisabled();
  });

  it("with filters and no results, says nothing matches and offers to clear them", async () => {
    searchParams = new URLSearchParams("status=completed");
    searchResult = { items: [], total: 0 };

    renderPage();

    expect(await screen.findByText("Ninguna ruta coincide con los filtros.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(replace).toHaveBeenCalledWith("/rutas", { scroll: false });
  });
});
