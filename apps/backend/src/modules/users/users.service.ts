import type { CreateUserInput, User } from "@torpreca/shared";
import { AppError, NotFoundError } from "../../core/errors/app-error";
import type { UsersRepository } from "./users.repository";

// Takes the repository as a dependency instead of importing the real one:
// tests pass in an in-memory one and this runs without touching Supabase.
export function createUsersService(repo: UsersRepository) {
  return {
    async list(onlyActive?: boolean): Promise<User[]> {
      return repo.list(onlyActive);
    },

    async getById(id: string): Promise<User> {
      const user = await repo.getById(id);
      if (!user) throw new NotFoundError("User not found");
      return user;
    },

    async create(input: CreateUserInput): Promise<User> {
      const existing = await repo.getByAuthUserId(input.authUserId);
      if (existing) throw new AppError(409, "User with this auth_user_id already exists");
      return repo.create(input);
    },

    async deactivate(id: string, deactivatedBy: string): Promise<void> {
      await this.getById(id);
      await repo.deactivate(id, deactivatedBy);
    },
  };
}

export type UsersService = ReturnType<typeof createUsersService>;
