import {
  businessDate,
  isRouteOverdue,
  REPORT_ROUTE_STATES,
  type ReportRouteState,
  type Route,
  type RoutesReport,
} from "@torpreca/shared";
import type { RoutesRepository } from "../routes/routes.repository";
import type { UsersRepository } from "../users/users.repository";
import type { VehiclesRepository } from "../vehicles/vehicles.repository";

export interface ReportsDeps {
  routes: RoutesRepository;
  users: UsersRepository;
  vehicles: VehiclesRepository;
}

// Supabase caps a single response at 1000 rows, so a long range is read in pages.
const FETCH_PAGE_SIZE = 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

// Every calendar day from `from` to `to`, inclusive. Done in UTC on plain
// dates, so there is no timezone or DST drift.
function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let t = Date.parse(from); t <= Date.parse(to); t += DAY_MS) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

function reportState(route: Route, today: string): ReportRouteState {
  return isRouteOverdue(route, today) ? "overdue" : route.status;
}

type Group = { routes: number; completed: number; plannedKm: number; drivenKm: number };

const emptyGroup = (): Group => ({ routes: 0, completed: 0, plannedKm: 0, drivenKm: 0 });

// Kilometers are summed over completed routes only (see report.schema.ts).
function addRoute(group: Group, route: Route) {
  group.routes += 1;
  if (route.status === "completed") {
    group.completed += 1;
    group.plannedKm += route.plannedKm ?? 0;
    group.drivenKm += route.drivenKm;
  }
}

function addTo<K>(groups: Map<K, Group>, key: K, route: Route) {
  const group = groups.get(key) ?? emptyGroup();
  addRoute(group, route);
  groups.set(key, group);
}

const round = (km: number) => Math.round(km * 100) / 100;

function rounded(group: Group): Group {
  return { ...group, plannedKm: round(group.plannedKm), drivenKm: round(group.drivenKm) };
}

// A cell that starts with = + - @ is read as a formula by Excel/Sheets; the
// leading quote keeps it text (CSV injection through a vehicle plate or name).
function csvCell(value: string | number | null): string {
  if (value === null) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function createReportsService(deps: ReportsDeps) {
  async function routesInRange(from: string, to: string): Promise<Route[]> {
    const routes: Route[] = [];
    for (let offset = 0; ; offset += FETCH_PAGE_SIZE) {
      const chunk = await deps.routes.list({ from, to, limit: FETCH_PAGE_SIZE, offset });
      routes.push(...chunk);
      if (chunk.length < FETCH_PAGE_SIZE) return routes;
    }
  }

  return {
    async routesReport(from: string, to: string): Promise<RoutesReport> {
      const routes = await routesInRange(from, to);
      const today = businessDate();

      const totals = emptyGroup();
      const states = new Map<ReportRouteState, number>(REPORT_ROUTE_STATES.map((s) => [s, 0]));
      const byDay = new Map<string, Group>(daysBetween(from, to).map((d) => [d, emptyGroup()]));
      const byDriver = new Map<string, Group>();
      const byVehicle = new Map<string | null, Group>();

      for (const route of routes) {
        addRoute(totals, route);
        const state = reportState(route, today);
        states.set(state, (states.get(state) ?? 0) + 1);
        addTo(byDay, route.date, route);
        addTo(byDriver, route.driverId, route);
        addTo(byVehicle, route.vehicleId, route);
      }

      const busiestFirst = <T extends { routes: number }>(a: T, b: T) => b.routes - a.routes;

      return {
        from,
        to,
        totals: {
          ...rounded(totals),
          completionRate: totals.routes === 0 ? 0 : totals.completed / totals.routes,
        },
        byStatus: REPORT_ROUTE_STATES.map((status) => ({ status, count: states.get(status) ?? 0 })),
        byDay: [...byDay].map(([date, group]) => ({ date, ...rounded(group) })),
        byDriver: [...byDriver]
          .map(([driverId, group]) => ({ driverId, ...rounded(group) }))
          .sort(busiestFirst),
        byVehicle: [...byVehicle]
          .map(([vehicleId, group]) => ({ vehicleId, ...rounded(group) }))
          .sort(busiestFirst),
      };
    },

    // One line per route, oldest first, with the driver's name and the plate
    // resolved (they are not in the route row). A leading BOM makes Excel read
    // the file as UTF-8, so accents survive.
    async routesCsv(from: string, to: string): Promise<string> {
      const [routes, users, vehicles] = await Promise.all([
        routesInRange(from, to),
        deps.users.list("all"),
        deps.vehicles.list(false),
      ]);
      const driverNames = new Map(users.map((u) => [u.id, u.name]));
      const plates = new Map(vehicles.map((v) => [v.id, v.plate]));
      const today = businessDate();

      const header = [
        "code",
        "date",
        "status",
        "driver",
        "vehicle",
        "planned_km",
        "driven_km",
        "start_time",
        "end_time",
      ];
      const rows = [...routes]
        .sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code))
        .map((r) =>
          [
            r.code,
            r.date,
            reportState(r, today),
            driverNames.get(r.driverId) ?? r.driverId,
            r.vehicleId ? (plates.get(r.vehicleId) ?? r.vehicleId) : null,
            r.plannedKm,
            r.drivenKm,
            r.startTime,
            r.endTime,
          ]
            .map(csvCell)
            .join(","),
        );

      return `﻿${[header.join(","), ...rows].join("\r\n")}\r\n`;
    },
  };
}

export type ReportsService = ReturnType<typeof createReportsService>;
