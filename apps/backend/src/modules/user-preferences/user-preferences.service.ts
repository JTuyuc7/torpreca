import type { UpdateUserPreferencesInput, UserPreferences } from "@torpreca/shared";
import type { UserPreferencesRepository } from "./user-preferences.repository";

// A user who never touched Ajustes/Perfil has no row at all — returning this
// virtual default instead of 404 means every client can call GET
// unconditionally, no "does this user have preferences yet" branch needed.
function virtualDefault(userId: string): UserPreferences {
  const now = new Date().toISOString();
  return {
    userId,
    theme: "system",
    language: "es",
    defaultMapView: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function createUserPreferencesService(repo: UserPreferencesRepository) {
  return {
    async get(userId: string): Promise<UserPreferences> {
      const existing = await repo.getByUserId(userId);
      return existing ?? virtualDefault(userId);
    },

    async update(userId: string, input: UpdateUserPreferencesInput): Promise<UserPreferences> {
      return repo.patch(userId, input);
    },
  };
}

export type UserPreferencesService = ReturnType<typeof createUserPreferencesService>;
