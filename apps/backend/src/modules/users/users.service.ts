import {
  assignableRolesOnApproval,
  type CreateUserInput,
  canDeactivateUser,
  type InviteUserInput,
  type Role,
  type User,
  type UserStatus,
} from "@torpreca/shared";
import { AppError, ForbiddenError, NotFoundError } from "../../core/errors/app-error";
import { closeConnectionsForUser } from "../../core/ws/connection-registry";
import type { UsersRepository } from "./users.repository";

// Who is performing the action — the authenticated user's id and role.
type Actor = { id: string; role: Role };

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

    // TOR-125: self-service creation — the repository handles both the
    // Supabase Auth invite and the profile row; no duplicate pre-check here
    // since inviteUserByEmail() is itself the source of truth for whether
    // that email already has an account.
    async invite(input: InviteUserInput): Promise<User> {
      return repo.invite(input);
    },

    // The actor's role is checked against the target's here (not just in the
    // route's requireRole) so an admin can't deactivate an admin/super_admin
    // and nobody can deactivate themselves — see canDeactivateUser.
    async deactivate(id: string, actor: Actor): Promise<void> {
      const target = await this.getById(id);
      if (!canDeactivateUser(actor, target)) {
        throw new ForbiddenError("You cannot deactivate this user");
      }
      await repo.deactivate(id, actor.id);
      closeConnectionsForUser(id);
    },

    // TOR-126: changes the role of a user past the pending-review step (the
    // "Todos los usuarios" table, not the approval queue — see review() below
    // for that one). `role` is already narrowed to PROMOTABLE_ROLES by
    // UpdateUserRoleSchema, so super_admin can't reach here from the UI.
    async updateRole(id: string, role: Role): Promise<User> {
      await this.getById(id);
      await repo.updateRole(id, role);
      return this.getById(id);
    },

    async review(
      id: string,
      decision: "approve" | "reject",
      reviewer: Actor,
      role?: Role,
    ): Promise<User> {
      const user = await this.getById(id);
      if (user.status !== "pending") {
        throw new AppError(409, `User is not pending review (status: ${user.status})`);
      }
      if (
        decision === "approve" &&
        role &&
        !(assignableRolesOnApproval(reviewer.role) as readonly Role[]).includes(role)
      ) {
        throw new ForbiddenError(`You cannot approve a user as ${role}`);
      }
      await repo.review(id, decision, reviewer.id, role);
      return this.getById(id);
    },
  };
}

export type UsersService = ReturnType<typeof createUsersService>;
