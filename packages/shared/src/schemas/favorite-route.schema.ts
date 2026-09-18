import { z } from "../zod";

export const FavoriteRouteSchema = z.object({
  id: z.uuid(),
  label: z.string().min(1),
  originLat: z.number(),
  originLng: z.number(),
  destinationLat: z.number(),
  destinationLng: z.number(),
  plannedKm: z.number().nonnegative(),
  createdBy: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type FavoriteRoute = z.infer<typeof FavoriteRouteSchema>;

export const CreateFavoriteRouteSchema = FavoriteRouteSchema.pick({
  label: true,
  originLat: true,
  originLng: true,
  destinationLat: true,
  destinationLng: true,
  plannedKm: true,
});

export type CreateFavoriteRouteInput = z.infer<typeof CreateFavoriteRouteSchema>;
