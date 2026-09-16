import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// react-map-gl/mapbox needs a real WebGL canvas — stand in with plain divs so
// this page can render in jsdom. Same idea as app/(protected)/page.test.tsx,
// minus forwardRef — this page never takes a ref on the map.
vi.mock("react-map-gl/mapbox", () => ({
  Map: ({ children }: { children?: ReactNode }) => <div data-testid="map">{children}</div>,
  Marker: ({
    children,
    longitude,
    latitude,
  }: {
    children?: ReactNode;
    longitude: number;
    latitude: number;
  }) => (
    <div data-testid="marker" data-lng={longitude} data-lat={latitude}>
      {children}
    </div>
  ),
}));

const useParams = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => useParams(),
}));

const useUsers = vi.fn();
vi.mock("@/lib/hooks/use-users", () => ({ useUsers: () => useUsers() }));

const useRoutes = vi.fn();
vi.mock("@/lib/hooks/use-routes", () => ({ useRoutes: () => useRoutes() }));

const useLiveLocations = vi.fn();
vi.mock("@/lib/hooks/use-live-locations", () => ({ useLiveLocations: () => useLiveLocations() }));

import DriverDetailPage from "./page";

const driver = {
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

const admin = { ...driver, id: "a1", role: "admin" as const, name: "Ana Admin" };

const route1 = {
  id: "r1",
  code: "R-1",
  driverId: "d1",
  vehicleId: null,
  createdBy: "a1",
  date: "2026-09-10",
  status: "completed" as const,
  plannedKm: 10,
  drivenKm: 9.5,
  startTime: "t",
  endTime: "t",
  createdAt: "t",
  updatedAt: "t",
};

beforeEach(() => {
  useParams.mockReset();
  useUsers.mockReset();
  useRoutes.mockReset();
  useLiveLocations.mockReset();
  useParams.mockReturnValue({ id: "d1" });
  useUsers.mockReturnValue({ users: [driver], isLoading: false, error: null });
  useRoutes.mockReturnValue({ routes: [route1], isLoading: false, error: null });
  useLiveLocations.mockReturnValue({ locations: [], status: "connected" });
});

describe("DriverDetailPage", () => {
  it("shows the driver's name/email and route history", () => {
    render(<DriverDetailPage />);

    expect(screen.getByText("Carlos Pérez")).toBeInTheDocument();
    expect(screen.getByText("carlos@example.com")).toBeInTheDocument();
    expect(screen.getByText("R-1")).toBeInTheDocument();
    expect(screen.getByText("Completada")).toBeInTheDocument();
  });

  it("shows an empty state instead of a map when there's no live location", () => {
    render(<DriverDetailPage />);

    expect(screen.getByText("Sin ubicación reciente.")).toBeInTheDocument();
    expect(screen.queryByTestId("map")).not.toBeInTheDocument();
  });

  it("renders the map with a marker when a live location exists", () => {
    useLiveLocations.mockReturnValue({
      locations: [{ driverId: "d1", lat: 14.6, lng: -90.5 }],
      status: "connected",
    });

    render(<DriverDetailPage />);

    expect(screen.getByTestId("map")).toBeInTheDocument();
    expect(screen.getByTestId("marker")).toBeInTheDocument();
  });

  it("shows an empty state when the driver has no routes yet", () => {
    useRoutes.mockReturnValue({ routes: [], isLoading: false, error: null });

    render(<DriverDetailPage />);

    expect(screen.getByText("Este conductor todavía no tiene rutas asignadas.")).toBeInTheDocument();
  });

  it("shows a not-found state for an id that doesn't match any user", () => {
    useParams.mockReturnValue({ id: "missing" });

    render(<DriverDetailPage />);

    expect(screen.getByText("Conductor no encontrado.")).toBeInTheDocument();
  });

  it("shows a driver-only message when the id belongs to a non-driver user", () => {
    useParams.mockReturnValue({ id: "a1" });
    useUsers.mockReturnValue({ users: [driver, admin], isLoading: false, error: null });

    render(<DriverDetailPage />);

    expect(screen.getByText("Esta pantalla es solo para conductores.")).toBeInTheDocument();
  });
});
