import { z } from "zod";

export const LocationSchema = z.object({
  id: z.uuid(),
  driverId: z.uuid(),
  routeId: z.uuid().nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speed: z.number().nonnegative().nullable(),
  recordedAt: z.iso.datetime(),
  synced: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Location = z.infer<typeof LocationSchema>;

// Shape sent by the mobile app — includes points recorded while offline.
export const CreateLocationSchema = LocationSchema.pick({
  routeId: true,
  lat: true,
  lng: true,
  speed: true,
  recordedAt: true,
});

export type CreateLocationInput = z.infer<typeof CreateLocationSchema>;