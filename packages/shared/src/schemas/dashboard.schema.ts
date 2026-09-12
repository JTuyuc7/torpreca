import { z } from "../zod";

// Aggregate counts for the dashboard home screen (TOR-12) — computed
// server-side from routes/vehicles/users/locations so the client never has
// to fetch full lists just to display a count.
export const DashboardSummarySchema = z.object({
  routesInProgress: z.number().int().nonnegative(),
  routesPendingToday: z.number().int().nonnegative(),
  vehiclesActive: z.number().int().nonnegative(),
  driversActive: z.number().int().nonnegative(),
  // Drivers with a location ping in the last 5 minutes — see
  // ONLINE_THRESHOLD_MS in dashboard.service.ts.
  driversOnline: z.number().int().nonnegative(),
});

export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;
