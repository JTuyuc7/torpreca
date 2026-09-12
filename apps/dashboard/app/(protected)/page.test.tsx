import { fireEvent, render, screen } from "@testing-library/react";
import { forwardRef, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// react-map-gl/mapbox needs a real WebGL canvas — stand in with plain divs so
// this page can render in jsdom. Only the props this page actually reads
// (children, longitude/latitude, and the imperative flyTo ref) matter here.
const flyTo = vi.fn();
vi.mock("react-map-gl/mapbox", () => ({
  Map: forwardRef(function MockMap(
    { children }: { children?: ReactNode },
    ref: React.Ref<{ flyTo: typeof flyTo }>,
  ) {
    if (typeof ref === "function") ref({ flyTo });
    else if (ref) ref.current = { flyTo };
    return <div data-testid="map">{children}</div>;
  }),
  Marker: ({ children, longitude, latitude }: { children?: ReactNode; longitude: number; latitude: number }) => (
    <div data-testid="marker" data-lng={longitude} data-lat={latitude}>
      {children}
    </div>
  ),
}));

const useDashboardSummary = vi.fn();
vi.mock("@/lib/hooks/use-dashboard-summary", () => ({
  useDashboardSummary: () => useDashboardSummary(),
}));

const useLiveLocations = vi.fn();
vi.mock("@/lib/hooks/use-live-locations", () => ({
  useLiveLocations: () => useLiveLocations(),
}));

const useRoutes = vi.fn();
vi.mock("@/lib/hooks/use-routes", () => ({
  useRoutes: () => useRoutes(),
}));

const useUsers = vi.fn();
vi.mock("@/lib/hooks/use-users", () => ({
  useUsers: () => useUsers(),
}));

import HomePage from "./page";

const summary = {
  routesInProgress: 2,
  routesPendingToday: 1,
  vehiclesActive: 5,
  driversActive: 4,
  driversOnline: 3,
};

const location1 = {
  id: "l1",
  driverId: "d1",
  routeId: null,
  lat: 14.6,
  lng: -90.5,
  speed: null,
  recordedAt: "2026-09-12T00:00:00.000Z",
  synced: true,
  createdAt: "t",
  updatedAt: "t",
};

const activeRoute = {
  id: "r1",
  code: "R-20260912-1",
  driverId: "d1",
  vehicleId: null,
  createdBy: "admin-1",
  date: "2026-09-12",
  status: "in_progress" as const,
  plannedKm: null,
  drivenKm: 0,
  startTime: "2026-09-12T00:00:00.000Z",
  endTime: null,
  createdAt: "t",
  updatedAt: "t",
};

const driverUser = {
  id: "d1",
  authUserId: "auth-1",
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

beforeEach(() => {
  flyTo.mockReset();
  useDashboardSummary.mockReset();
  useLiveLocations.mockReset();
  useRoutes.mockReset();
  useUsers.mockReset();
  useDashboardSummary.mockReturnValue({ summary, isLoading: false, error: null });
  useLiveLocations.mockReturnValue({ locations: [], status: "connecting" });
  useRoutes.mockReturnValue({ routes: [] });
  useUsers.mockReturnValue({ users: [] });
});

describe("HomePage", () => {
  it("shows the page title and the metric cards from the summary", () => {
    render(<HomePage />);

    expect(screen.getByText("Panel principal")).toBeInTheDocument();
    expect(document.title).toBe("Panel principal · Torpreca");
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Rutas en progreso")).toBeInTheDocument();
    expect(screen.getByText("Conductores en línea")).toBeInTheDocument();
  });

  it("shows a loading skeleton instead of metric cards while the summary loads", () => {
    useDashboardSummary.mockReturnValue({ summary: undefined, isLoading: true, error: null });

    render(<HomePage />);

    expect(screen.queryByText("Rutas en progreso")).not.toBeInTheDocument();
  });

  it("renders one marker per live location", () => {
    useLiveLocations.mockReturnValue({ locations: [location1], status: "connected" });

    render(<HomePage />);

    const markers = screen.getAllByTestId("marker");
    expect(markers).toHaveLength(1);
    expect(markers[0]).toHaveAttribute("data-lng", "-90.5");
    expect(markers[0]).toHaveAttribute("data-lat", "14.6");
    expect(screen.getByText("En vivo")).toBeInTheDocument();
  });

  it("shows an error banner when the summary fails to load", () => {
    useDashboardSummary.mockReturnValue({
      summary: undefined,
      isLoading: false,
      error: "No se pudieron cargar las métricas.",
    });

    render(<HomePage />);

    expect(screen.getByText("No se pudieron cargar las métricas.")).toBeInTheDocument();
  });

  it("shows the empty state when there are no routes in progress", () => {
    render(<HomePage />);

    expect(screen.getByText("No hay rutas en curso ahora mismo.")).toBeInTheDocument();
  });

  it("lists in-progress routes with the driver's name, and flies to it on click", () => {
    useRoutes.mockReturnValue({ routes: [activeRoute] });
    useUsers.mockReturnValue({ users: [driverUser] });
    useLiveLocations.mockReturnValue({ locations: [location1], status: "connected" });

    render(<HomePage />);

    const item = screen.getByRole("button", { name: /R-20260912-1/ });
    expect(item).toHaveTextContent("Carlos Pérez");
    expect(item).not.toBeDisabled();

    fireEvent.click(item);
    expect(flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [location1.lng, location1.lat] }),
    );
  });

  it("disables a route with no recent location instead of flying nowhere", () => {
    useRoutes.mockReturnValue({ routes: [activeRoute] });
    useUsers.mockReturnValue({ users: [driverUser] });
    useLiveLocations.mockReturnValue({ locations: [], status: "connected" });

    render(<HomePage />);

    const item = screen.getByRole("button", { name: /R-20260912-1/ });
    expect(item).toBeDisabled();

    fireEvent.click(item);
    expect(flyTo).not.toHaveBeenCalled();
  });
});