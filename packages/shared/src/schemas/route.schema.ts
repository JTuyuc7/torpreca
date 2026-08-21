import { z } from "zod";
import { ROUTE_STATUSES } from "../constants/statuses";

export const RouteSchema = z.object({
  id: z.uuid(),
  code: z.string().min(1),
  driverId: z.uuid(),
  vehicleId: z.uuid().nullable(),
  createdBy: z.uuid(),
  date: z.iso.date(),
  status: z.enum(ROUTE_STATUSES),
  plannedKm: z.number().nonnegative().nullable(),
  drivenKm: z.number().nonnegative(),
  startTime: z.iso.datetime().nullable(),
  endTime: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Route = z.infer<typeof RouteSchema>;

export const CreateRouteSchema = RouteSchema.pick({
  code: true,
  driverId: true,
  vehicleId: true,
  date: true,
  plannedKm: true,
});

export type CreateRouteInput = z.infer<typeof CreateRouteSchema>;

export const FinishRouteSchema = z.object({
  drivenKm: z.number().nonnegative(),
});

export type FinishRouteInput = z.infer<typeof FinishRouteSchema>;