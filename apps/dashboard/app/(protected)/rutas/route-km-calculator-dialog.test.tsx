import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { forwardRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// react-map-gl/mapbox needs a real WebGL canvas — stand in with a plain div
// whose click always reports the next queued lng/lat, same idea as the mock
// in app/(protected)/page.test.tsx. forwardRef so `ref={mapRef}` (used for
// flyTo after a geocoded search) doesn't warn.
let nextClicks: { lng: number; lat: number }[] = [];
const flyTo = vi.fn();
vi.mock("react-map-gl/mapbox", () => ({
  Map: forwardRef(function MockMap(
    {
      children,
      onClick,
    }: {
      children?: React.ReactNode;
      onClick?: (e: { lngLat: { lng: number; lat: number } }) => void;
    },
    ref: React.Ref<{ flyTo: typeof flyTo }>,
  ) {
    if (typeof ref === "function") ref({ flyTo });
    else if (ref) ref.current = { flyTo };
    return (
      <div
        data-testid="calc-map"
        onClick={() => {
          const lngLat = nextClicks.shift();
          if (lngLat) onClick?.({ lngLat });
        }}
      >
        {children}
      </div>
    );
  }),
  Marker: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="marker">{children}</div>
  ),
}));

const favoriteRoute = {
  id: "f1",
  label: "Bodega Central → Zona 4",
  originLat: 14.6349,
  originLng: -90.5069,
  destinationLat: 14.6115,
  destinationLng: -90.5322,
  plannedKm: 12.5,
  createdBy: "user-1",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const createFavoriteRouteMutate = vi.fn();
const deleteFavoriteRouteMutate = vi.fn();
let favoriteRoutesList: typeof favoriteRoute[] = [];

let createFavoriteRouteState: { isPending: boolean; isError: boolean; error?: { message: string } } = {
  isPending: false,
  isError: false,
};

vi.mock("@/lib/hooks/use-favorite-routes", () => ({
  useFavoriteRoutes: () => ({
    favoriteRoutes: favoriteRoutesList,
    error: null,
    createFavoriteRoute: { mutate: createFavoriteRouteMutate, ...createFavoriteRouteState },
    deleteFavoriteRoute: { mutate: deleteFavoriteRouteMutate, isPending: false },
  }),
}));

import { readHiddenFavoriteRouteIds } from "@/lib/preferences/hidden-favorite-routes";
import { RouteKmCalculatorDialog } from "./route-km-calculator-dialog";

const fetchMock = vi.fn();

beforeEach(() => {
  nextClicks = [];
  favoriteRoutesList = [];
  createFavoriteRouteState = { isPending: false, isError: false };
  createFavoriteRouteMutate.mockReset();
  deleteFavoriteRouteMutate.mockReset();
  fetchMock.mockReset();
  flyTo.mockReset();
  window.localStorage.clear();
  vi.stubGlobal("fetch", fetchMock);
});

function openDialog(onApply = vi.fn()) {
  render(<RouteKmCalculatorDialog onApply={onApply} />);
  fireEvent.click(screen.getByRole("button", { name: "Calcular en mapa" }));
  return onApply;
}

describe("RouteKmCalculatorDialog", () => {
  it("clicking two map points calls the Directions API and shows the distance", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "Ok", routes: [{ distance: 12345 }] }), { status: 200 }),
    );
    openDialog();

    nextClicks = [
      { lng: -90.5069, lat: 14.6349 },
      { lng: -90.5322, lat: 14.6115 },
    ];
    const map = screen.getByTestId("calc-map");
    fireEvent.click(map);
    fireEvent.click(map);

    await waitFor(() => expect(screen.getByText("Distancia: 12.35 km")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("api.mapbox.com/directions"));
  });

  it("shows an error message when the Directions API can't find a route", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "NoRoute", message: "no route" }), { status: 200 }),
    );
    openDialog();

    nextClicks = [
      { lng: -90.5069, lat: 14.6349 },
      { lng: -90.5322, lat: 14.6115 },
    ];
    const map = screen.getByTestId("calc-map");
    fireEvent.click(map);
    fireEvent.click(map);

    await waitFor(() =>
      expect(
        screen.getByText("No se pudo calcular la distancia. Verifica los puntos e intenta de nuevo."),
      ).toBeInTheDocument(),
    );
  });

  it("'Usar este valor' applies the calculated km and closes the dialog", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "Ok", routes: [{ distance: 10000 }] }), { status: 200 }),
    );
    const onApply = openDialog();

    nextClicks = [
      { lng: -90.5069, lat: 14.6349 },
      { lng: -90.5322, lat: 14.6115 },
    ];
    const map = screen.getByTestId("calc-map");
    fireEvent.click(map);
    fireEvent.click(map);

    const useButton = await screen.findByRole("button", { name: "Usar este valor" });
    await waitFor(() => expect(useButton).not.toBeDisabled());
    fireEvent.click(useButton);

    expect(onApply).toHaveBeenCalledWith(10);
  });

  it("selecting a favorite fills the distance and address inputs without calling the Directions API", async () => {
    favoriteRoutesList = [favoriteRoute];
    fetchMock.mockImplementation((url: string) => {
      const point = url.includes("-90.5069") ? "Bodega Central" : "Zona 4";
      return Promise.resolve(
        new Response(JSON.stringify({ features: [{ place_name: point }] }), { status: 200 }),
      );
    });
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: "Bodega Central → Zona 4 · 12.5 km" }));

    expect(screen.getByText("Distancia: 12.5 km")).toBeInTheDocument();
    expect(fetchMock.mock.calls.every(([url]) => (url as string).includes("api.mapbox.com/geocoding"))).toBe(
      true,
    );
    await waitFor(() =>
      expect(screen.getByLabelText(/Dirección de origen/)).toHaveValue("Bodega Central"),
    );
    expect(screen.getByLabelText(/Dirección de destino/)).toHaveValue("Zona 4");
  });

  it("deleting a favorite calls deleteFavoriteRoute.mutate with its id", async () => {
    favoriteRoutesList = [favoriteRoute];
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: "Borrar favorita Bodega Central → Zona 4" }));

    expect(deleteFavoriteRouteMutate).toHaveBeenCalledWith("f1");
  });

  it("hiding a favorite removes it from the list, and 'Mostrar ocultas' brings it back", async () => {
    favoriteRoutesList = [favoriteRoute];
    openDialog();

    fireEvent.click(screen.getByRole("button", { name: "Ocultar favorita Bodega Central → Zona 4" }));
    expect(
      screen.queryByRole("button", { name: "Bodega Central → Zona 4 · 12.5 km" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mostrar ocultas (1)" }));
    expect(
      screen.getByRole("button", { name: "Bodega Central → Zona 4 · 12.5 km" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mostrar favorita Bodega Central → Zona 4" }));
    expect(screen.queryByRole("button", { name: "Mostrar ocultas (1)" })).not.toBeInTheDocument();
  });

  it("hiding a favorite persists to localStorage so a fresh mount also hides it", async () => {
    favoriteRoutesList = [favoriteRoute];
    openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Ocultar favorita Bodega Central → Zona 4" }));

    expect(readHiddenFavoriteRouteIds()).toEqual(["f1"]);
  });

  it("blocks saving a duplicate of an existing favorite's origin/destination", async () => {
    favoriteRoutesList = [favoriteRoute];
    openDialog();

    // Pick the exact same origin/destination the existing favorite already
    // has — skips the Directions API (distance comes straight from the
    // favorite), same as selecting the favorite itself would, but here
    // arriving via map clicks like a user unknowingly re-marking it.
    nextClicks = [
      { lng: favoriteRoute.originLng, lat: favoriteRoute.originLat },
      { lng: favoriteRoute.destinationLng, lat: favoriteRoute.destinationLat },
    ];
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "Ok", routes: [{ distance: 12500 }] }), { status: 200 }),
    );
    const map = screen.getByTestId("calc-map");
    fireEvent.click(map);
    fireEvent.click(map);

    await waitFor(() =>
      expect(
        screen.getByText("Ya existe la favorita “Bodega Central → Zona 4” con este mismo origen y destino."),
      ).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByPlaceholderText("Nombre para guardar como favorita (opcional)"), {
      target: { value: "Otro nombre" },
    });
    expect(screen.getByRole("button", { name: "Guardar como favorita y usar" })).toBeDisabled();
    expect(createFavoriteRouteMutate).not.toHaveBeenCalled();
  });

  it("'Guardar como favorita y usar' stays disabled until a name is entered", async () => {
    favoriteRoutesList = [];
    openDialog();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "Ok", routes: [{ distance: 5000 }] }), { status: 200 }),
    );
    nextClicks = [
      { lng: -90.5069, lat: 14.6349 },
      { lng: -90.5322, lat: 14.6115 },
    ];
    const map = screen.getByTestId("calc-map");
    fireEvent.click(map);
    fireEvent.click(map);

    const saveButton = await screen.findByRole("button", { name: "Guardar como favorita y usar" });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Nombre para guardar como favorita (opcional)"), {
      target: { value: "Nueva favorita" },
    });
    await waitFor(() => expect(saveButton).not.toBeDisabled());

    fireEvent.click(saveButton);
    expect(createFavoriteRouteMutate).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Nueva favorita", plannedKm: 5 }),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("searching an origin address geocodes it, places the marker and flies the map there", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ features: [{ center: [-90.5069, 14.6349] }] }), { status: 200 }),
    );
    openDialog();

    fireEvent.change(screen.getByLabelText(/Dirección de origen/), {
      target: { value: "Bodega Central" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar dirección de origen" }));

    await waitFor(() => expect(flyTo).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("api.mapbox.com/geocoding"));
    expect(screen.getByText("Ahora busca una dirección o haz clic para marcar el destino (B).")).toBeInTheDocument();
  });

  it("shows an error when an address can't be geocoded", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ features: [] }), { status: 200 }));
    openDialog();

    fireEvent.change(screen.getByLabelText(/Dirección de origen/), {
      target: { value: "asdkjasdkj" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar dirección de origen" }));

    await waitFor(() =>
      expect(screen.getByText("No se encontró esa dirección de origen.")).toBeInTheDocument(),
    );
  });

  it("shows an error message when saving a favorite fails", async () => {
    createFavoriteRouteState = {
      isPending: false,
      isError: true,
      error: { message: "No se pudo guardar la ruta favorita." },
    };
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "Ok", routes: [{ distance: 5000 }] }), { status: 200 }),
    );
    openDialog();

    nextClicks = [
      { lng: -90.5069, lat: 14.6349 },
      { lng: -90.5322, lat: 14.6115 },
    ];
    const map = screen.getByTestId("calc-map");
    fireEvent.click(map);
    fireEvent.click(map);

    await waitFor(() =>
      expect(screen.getByText("No se pudo guardar la ruta favorita.")).toBeInTheDocument(),
    );
  });
});
