import type { CreateUserInput, User, UserStatus } from "@torpreca/shared";
import { AppError, NotFoundError } from "../../core/errors/app-error";
import type { UsersRepository } from "./users.repository";

// Takes the repository as a dependency instead of importing the real one:
// tests pass in an in-memory one and this runs without touching Supabase.
export function createUsersService(repo: UsersRepository) {
  return {
    async list(status?: UserStatus | "all"): Promise<User[]> {
      return repo.list(status);
    },

    async getById(id: string): Promise<User> {
      const user = await repo.getById(id);
      if (!user) throw new NotFoundError("User not found");
      return user;
    },

    // Admin-created path (POST /users) — always lands "active" immediately,
    // unlike self-registration (which lands "pending", see mobile-auth
    // routes / core/middleware/auth.ts's lazy-create branch).
    async create(input: CreateUserInput): Promise<User> {
      const existing = await repo.getByAuthUserId(input.authUserId);
      if (existing) throw new AppError(409, "User with this auth_user_id already exists");
      return repo.create(input, "active");
    },

    async deactivate(id: string, deactivatedBy: string): Promise<void> {
      await this.getById(id);
      await repo.deactivate(id, deactivatedBy);
    },

    async review(id: string, decision: "approve" | "reject", reviewedBy: string): Promise<User> {
      const user = await this.getById(id);
      if (user.status !== "pending") {
        throw new AppError(409, `User is not pending review (status: ${user.status})`);
      }
      await repo.review(id, decision, reviewedBy);
      return this.getById(id);
    },
  };
}

export type UsersService = ReturnType<typeof createUsersService>;
