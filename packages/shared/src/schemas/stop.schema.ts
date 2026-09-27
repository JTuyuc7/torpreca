import { STOP_STATUSES } from "../constants/statuses";
import { z } from "../zod";

// customerName/address travel as plaintext over the API — the backend encrypts/
// decrypts them (pgp_sym_encrypt/pgp_sym_decrypt) when reading/writing the DB,
// same pattern as users.name.
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

// The editable part of a stop (TOR-137). Used as-is for `PATCH /stops/:id`
// (full replace — instructions is nullable, so a partial patch couldn't tell
// "leave alone" from "clear it") and, with an optional `order`, as the body
// of `POST /routes/:routeId/stops` (routeId comes from the URL). When `order`
// is omitted the backend appends the stop after the route's last one.
export const UpdateStopSchema = StopSchema.pick({
  customerName: true,
  address: true,
  lat: true,
  lng: true,
  instructions: true,
});

export type UpdateStopInput = z.infer<typeof UpdateStopSchema>;

export const CreateStopBodySchema = UpdateStopSchema.extend({
  order: StopSchema.shape.order.optional(),
});

export type CreateStopBodyInput = z.infer<typeof CreateStopBodySchema>;

// Full new order of a route's stops: every stop id of the route, exactly
// once, in the desired order.
export const ReorderStopsSchema = z.object({
  stopIds: z.array(z.uuid()).min(1),
});

export type ReorderStopsInput = z.infer<typeof ReorderStopsSchema>;
