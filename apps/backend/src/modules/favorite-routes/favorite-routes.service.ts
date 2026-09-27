import type { CreateFavoriteRouteInput, FavoriteRoute } from "@torpreca/shared";
import type { FavoriteRoutesRepository } from "./favorite-routes.repository";

// Takes the repository as a dependency instead of importing the real one:
// tests pass in an in-memory one and this runs without touching Supabase.
export function createFavoriteRoutesService(repo: FavoriteRoutesRepository) {
  return {
    async list(): Promise<FavoriteRoute[]> {
      return repo.list();
    },

    async create(input: CreateFavoriteRouteInput, createdBy: string): Promise<FavoriteRoute> {
      return repo.create(input, createdBy);
    },

    async remove(id: string): Promise<void> {
      await repo.remove(id);
    },
  };
}

export type FavoriteRoutesService = ReturnType<typeof createFavoriteRoutesService>;
