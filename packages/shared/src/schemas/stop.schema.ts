import { STOP_STATUSES } from "../constants/statuses";
import { z } from "../zod";

export const StopSchema = z.object({
  id: z.uuid(),
  routeId: z.uuid(),
  order: z.number().int().positive(),
  customerName: z.string().min(1),
  address: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  instructions: z.string().nullable(),
  status: z.enum(STOP_STATUSES),
  estimatedTime: z.iso.datetime().nullable(),
  completedTime: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Stop = z.infer<typeof StopSchema>;

export const CreateStopSchema = StopSchema.pick({
  routeId: true,
  order: true,
  customerName: true,
  address: true,
  lat: true,
  lng: true,
  instructions: true,
});

export type CreateStopInput = z.infer<typeof CreateStopSchema>;
