import { VEHICLE_CATEGORIES } from "../constants/statuses";
import { z } from "../zod";

export const VehicleSchema = z.object({
  id: z.uuid(),
  plate: z.string().min(1),
  model: z.string().min(1),
  capacity: z.number().int().positive().nullable(),
  category: z.enum(VEHICLE_CATEGORIES),
  notes: z.string().nullable(),
  active: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Vehicle = z.infer<typeof VehicleSchema>;

export const CreateVehicleSchema = VehicleSchema.pick({
  plate: true,
  model: true,
  capacity: true,
  category: true,
  notes: true,
});

export type CreateVehicleInput = z.infer<typeof CreateVehicleSchema>;

// Every field optional, `active` included so the same endpoint also covers
// reactivating a vehicle (DELETE /vehicles/:id only ever sets it to false —
// there was no way back before this).
export const UpdateVehicleSchema = CreateVehicleSchema.partial().extend({
  active: z.boolean().optional(),
});

export type UpdateVehicleInput = z.infer<typeof UpdateVehicleSchema>;
