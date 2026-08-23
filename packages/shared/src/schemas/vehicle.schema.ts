import { z } from "../zod";

export const VehicleSchema = z.object({
  id: z.uuid(),
  plate: z.string().min(1),
  model: z.string().min(1),
  capacity: z.number().int().positive().nullable(),
  active: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Vehicle = z.infer<typeof VehicleSchema>;

export const CreateVehicleSchema = VehicleSchema.pick({
  plate: true,
  model: true,
  capacity: true,
});

export type CreateVehicleInput = z.infer<typeof CreateVehicleSchema>;
