import { businessDate, type RoutesReport } from "@torpreca/shared";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useRoutesReport = vi.fn();
vi.mock("@/lib/hooks/use-routes-report", () => ({
  useRoutesReport: (range: unknown) => useRoutesReport(range),
}));

const useUsers = vi.fn();
vi.mock("@/lib/hooks/use-users", () => ({ useUsers: () => useUsers() }));

const useVehicles = vi.fn();
vi.mock("@/lib/hooks/use-vehicles", () => ({ useVehicles: () => useVehicles() }));

const downloadRoutesCsv = vi.fn();
vi.mock("@/lib/api/reports-client", () => ({
  downloadRoutesCsv: (range: unknown) => downloadRoutesCsv(range),
}));

// Recharts needs real layout (ResizeObserver, sizes) that jsdom does not have:
// the charts get their own checks in the browser, here only the page logic.
vi.mock("./report-charts", () => ({ ReportCharts: () => <div data-testid="charts" /> }));

import ReportesPage from "./page";

const DRIVER_ID = "11111111-1111-4111-8111-111111111111";
const VEHICLE_ID = "22222222-2222-4222-8222-222222222222";

const group = { routes: 4, completed: 3, plannedKm: 40, drivenKm: 42.5 };

const report: RoutesReport = {
  from: "2026-01-01",
  to: "2026-01-30",
  totals: { ...group, completionRate: 0.75 },
  byStatus: [],
  byDay: [],
  byDriver: [{ driverId: DRIVER_ID, ...group }],
  byVehicle: [
    { vehicleId: VEHICLE_ID, ...group, routes: 3, completed: 3 },
    { vehicleId: null, routes: 1, completed: 0, plannedKm: 0, drivenKm: 0 },
  ],
};

function showReport(value: RoutesReport | undefined, error: string | null = null) {
  useRoutesReport.mockReturnValue({
    report: value,
    isLoading: false,
    isRefetching: false,
    error,
    refetch: vi.fn(),
  });
}

function lastRange() {
  return useRoutesReport.mock.calls.at(-1)?.[0] as { from: string; to: string };
}

function daysAgo(days: number): string {
  return new Date(Date.parse(businessDate()) - days * 86_400_000).toISOString().slice(0, 10);
}

beforeEach(() => {
  useRoutesReport.mockReset();
  downloadRoutesCsv.mockReset();
  useUsers.mockReturnValue({ users: [{ id: DRIVER_ID, name: "Carlos Pérez", role: "driver" }] });
  useVehicles.mockReturnValue({ vehicles: [{ id: VEHICLE_ID, plate: "P-123ABC" }] });
  showReport(report);
});

describe("ReportesPage", () => {
  it("starts on the last 30 days", () => {
    render(<ReportesPage />);

    expect(lastRange()).toEqual({ from: daysAgo(29), to: businessDate() });
  });

  it("shows the totals and the per-driver and per-vehicle tables with names", () => {
    render(<ReportesPage />);

    const completed = screen.getByText("75 %").parentElement as HTMLElement;
    expect(completed).toHaveTextContent("Completadas");
    expect(completed).toHaveTextContent("3");
    expect(screen.getByText("Km recorridos", { selector: "span" }).nextElementSibling).toHaveTextContent(
      "42.5",
    );
    expect(screen.getByTestId("charts")).toBeInTheDocument();

    const drivers = within(screen.getByText("Por conductor").closest("section") as HTMLElement);
    expect(drivers.getByText("Carlos Pérez")).toBeInTheDocument();

    const vehicles = within(screen.getByText("Por vehículo").closest("section") as HTMLElement);
    expect(vehicles.getByText("P-123ABC")).toBeInTheDocument();
    expect(vehicles.getByText("Sin vehículo")).toBeInTheDocument();
  });

  it("says so when the period has no routes, and shows no charts", () => {
    showReport({ ...report, totals: { ...report.totals, routes: 0, completed: 0 } });
    render(<ReportesPage />);

    expect(screen.getByText("No hay rutas en este periodo.")).toBeInTheDocument();
    expect(screen.queryByTestId("charts")).not.toBeInTheDocument();
  });

  it("shows the error with a retry", () => {
    const refetch = vi.fn();
    useRoutesReport.mockReturnValue({
      report: undefined,
      isLoading: false,
      isRefetching: false,
      error: "No se pudo cargar el reporte.",
      refetch,
    });
    render(<ReportesPage />);

    expect(screen.getByText("No se pudo cargar el reporte.")).toBeInTheDocument();
  });

  it("only asks for another period when 'Generar' is pressed", () => {
    render(<ReportesPage />);
    const before = lastRange();

    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-02-01" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-02-10" } });
    expect(lastRange()).toEqual(before);

    fireEvent.click(screen.getByRole("button", { name: "Generar" }));
    expect(lastRange()).toEqual({ from: "2026-02-01", to: "2026-02-10" });
  });

  it("refuses an inverted or over-long period", () => {
    render(<ReportesPage />);

    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2000-01-01" } });
    expect(screen.getByRole("alert")).toHaveTextContent("La fecha inicial no puede ser posterior");
    expect(screen.getByRole("button", { name: "Generar" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "1990-01-01" } });
    expect(screen.getByRole("alert")).toHaveTextContent("no puede superar 366 días");
    expect(screen.getByRole("button", { name: "Generar" })).toBeDisabled();
  });

  it("a preset applies right away", () => {
    render(<ReportesPage />);

    fireEvent.click(screen.getByRole("button", { name: "Últimos 7 días" }));

    expect(lastRange()).toEqual({ from: daysAgo(6), to: businessDate() });
  });

  it("downloads the CSV of the applied period, and reports a failure", async () => {
    downloadRoutesCsv.mockResolvedValueOnce({ ok: false, status: 500 });
    render(<ReportesPage />);

    fireEvent.click(screen.getByRole("button", { name: "Descargar CSV" }));

    expect(downloadRoutesCsv).toHaveBeenCalledWith(lastRange());
    expect(await screen.findByText("No se pudo descargar el CSV.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Descargar CSV" })).toBeEnabled());
  });

  it("prints through the browser (save as PDF)", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<ReportesPage />);

    fireEvent.click(screen.getByRole("button", { name: "Imprimir / PDF" }));

    expect(print).toHaveBeenCalledTimes(1);
    print.mockRestore();
  });
});
