import { z } from "../zod";

// Longest range a report covers: a year is enough for the "monthly review" use
// and keeps the per-day series (one point per day) a sane size.
export const REPORT_MAX_DAYS = 366;

const DAY_MS = 24 * 60 * 60 * 1000;

// `from`/`to` are inclusive calendar days (business-date strings).
export const ReportRangeQuerySchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
  })
  .refine((range) => range.from <= range.to, {
    message: "`from` must not be after `to`",
    path: ["to"],
  })
  .refine(
    (range) => (Date.parse(range.to) - Date.parse(range.from)) / DAY_MS + 1 <= REPORT_MAX_DAYS,
    { message: `The range can cover at most ${REPORT_MAX_DAYS} days`, path: ["to"] },
  );

export type ReportRangeQuery = z.infer<typeof ReportRangeQuerySchema>;

// What a route counts as in the report. It is the stored status, except that a
// `pending`/`in_progress` route of a past day is `overdue` (see isRouteOverdue):
// every route lands in exactly one bucket, so the buckets add up to the total.
export const REPORT_ROUTE_STATES = [
  "pending",
  "in_progress",
  "completed",
  "delayed",
  "cancelled",
  "overdue",
] as const;

export type ReportRouteState = (typeof REPORT_ROUTE_STATES)[number];

// Kilometers are only compared on `completed` routes: a pending route has no
// driven km yet and would make every group look like it under-drove.
const ReportGroupFields = {
  routes: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  plannedKm: z.number().nonnegative(),
  drivenKm: z.number().nonnegative(),
};

export const RoutesReportSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  totals: z.object({
    ...ReportGroupFields,
    // completed / routes, 0 when the range has no routes.
    completionRate: z.number().min(0).max(1),
  }),
  byStatus: z.array(
    z.object({ status: z.enum(REPORT_ROUTE_STATES), count: z.number().int().nonnegative() }),
  ),
  // One entry per calendar day of the range (days without routes included), oldest first.
  byDay: z.array(z.object({ date: z.iso.date(), ...ReportGroupFields })),
  // Busiest first. Names are not here (they are encrypted): the client resolves them.
  byDriver: z.array(z.object({ driverId: z.uuid(), ...ReportGroupFields })),
  byVehicle: z.array(z.object({ vehicleId: z.uuid().nullable(), ...ReportGroupFields })),
});

export type RoutesReport = z.infer<typeof RoutesReportSchema>;
