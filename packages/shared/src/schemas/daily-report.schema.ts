import { z } from "../zod";

export const DailyReportSchema = z.object({
  id: z.uuid(),
  driverId: z.uuid(),
  date: z.iso.date(),
  drivenKm: z.number().nonnegative(),
  completedStops: z.number().int().nonnegative(),
  routesServed: z.number().int().nonnegative(),
  timeOnRoute: z.string().nullable(), // Postgres INTERVAL, "HH:MM:SS" format
  generatedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type DailyReport = z.infer<typeof DailyReportSchema>;

// Query of `GET /mobile/daily-reports/history` (driver app "Historial"):
// newest first, `limit` per page (default 5), `before` continues from the
// last date of the previous page, `from`/`to` (inclusive) filter by date.
export const ListDailyReportsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(31).default(5),
  before: z.iso.date().optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export type ListDailyReportsQuery = z.infer<typeof ListDailyReportsQuerySchema>;
