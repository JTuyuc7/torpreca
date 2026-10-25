import type { RoutesReport } from "@torpreca/shared";
import { render, screen } from "@testing-library/react";
import { cloneElement, isValidElement } from "react";
import { describe, expect, it, vi } from "vitest";

// jsdom has no layout, so ResponsiveContainer would measure 0x0 and draw
// nothing: give the chart inside a fixed size instead.
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      isValidElement(children)
        ? cloneElement(children as React.ReactElement<{ width: number; height: number }>, {
            width: 600,
            height: 240,
          })
        : null,
  };
});

import { ReportCharts } from "./report-charts";

const DRIVER_ID = "11111111-1111-4111-8111-111111111111";
const group = { routes: 2, completed: 1, plannedKm: 10, drivenKm: 11 };

const report: RoutesReport = {
  from: "2026-01-01",
  to: "2026-01-02",
  totals: { ...group, completionRate: 0.5 },
  byStatus: [
    { status: "completed", count: 1 },
    { status: "overdue", count: 1 },
    { status: "pending", count: 0 },
  ],
  byDay: [
    { date: "2026-01-01", ...group },
    { date: "2026-01-02", routes: 0, completed: 0, plannedKm: 0, drivenKm: 0 },
  ],
  byDriver: [{ driverId: DRIVER_ID, ...group }],
  byVehicle: [],
};

describe("ReportCharts", () => {
  it("draws the four charts, each with a text alternative, and a legend for the two km series", () => {
    const { container } = render(<ReportCharts report={report} driverName={() => "Carlos Pérez"} />);

    for (const name of [
      "Rutas por día",
      "Km planeados vs recorridos por día",
      "Rutas por estado",
      "Rutas por conductor",
    ]) {
      expect(screen.getByRole("img", { name })).toBeInTheDocument();
    }
    expect(container.querySelectorAll("svg.recharts-surface")).toHaveLength(4);

    const legend = screen.getByText("Planeados").closest("ul") as HTMLElement;
    expect(legend).toHaveTextContent("Recorridos");
  });

  it("names the drivers, and says when only the top ones are drawn", () => {
    const many: RoutesReport = {
      ...report,
      byDriver: Array.from({ length: 9 }, (_, i) => ({
        driverId: `00000000-0000-4000-8000-00000000000${i}`,
        ...group,
      })),
    };
    render(<ReportCharts report={many} driverName={(id) => `D-${id.slice(-1)}`} />);

    expect(screen.getByText(/Se muestran los 8 conductores/)).toBeInTheDocument();
  });
});
