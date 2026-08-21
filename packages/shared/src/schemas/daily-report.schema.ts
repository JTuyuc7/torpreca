import { z } from "zod";

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
