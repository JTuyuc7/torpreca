import { ROLES } from "../constants/roles";
import { USER_STATUSES } from "../constants/statuses";
import { z } from "../zod";

// `name` travels as plaintext over the API — the backend encrypts/decrypts it
// (pgp_sym_encrypt/pgp_sym_decrypt) when reading/writing the DB.
//
// `status` is the single source of truth for whether a user can authenticate
// (see core/middleware/auth.ts) — it replaced a boolean `active` column (see
// the migration that added it) to avoid the ambiguity of inferring "never
// approved" vs "deactivated after being active" from active/deactivatedAt.
// `email` is denormalized from Supabase Auth (`auth.users.email`) at
// creation time — see the migration that added it — purely so the dashboard
// can tell apart two people sharing a display name without a live
// admin.getUserById() lookup per row on every list request.
export const UserSchema = z.object({
  id: z.uuid(),
  authUserId: z.uuid(),
  name: z.string().min(1),
  email: z.email(),
  role: z.enum(ROLES),
  status: z.enum(USER_STATUSES),
  deactivatedAt: z.iso.datetime().nullable(),
  deactivatedBy: z.uuid().nullable(),
  reviewedAt: z.iso.datetime().nullable(),
  reviewedBy: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = UserSchema.pick({
  authUserId: true,
  name: true,
  email: true,
  role: true,
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

// Body for POST /mobile/auth/register — self-registration by a driver.
// Deliberately no `role`/`status` field: role is always fixed to "driver"
// and status always starts "pending" server-side, never taken from the
// client (see the self-signup design doc — prevents privilege escalation).
export const RegisterSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  name: z.string().min(1),
  signupCode: z.string().min(1),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

// Roles assignable when approving a pending registration — super_admin is
// excluded (CLAUDE.md: only assignable from the DB).
export const PROMOTABLE_ROLES = ["driver", "supervisor", "admin"] as const;

// Body for PATCH /users/:id/review — an admin/supervisor approving or
// rejecting a pending driver registration. `role` only applies on "approve"
// (lets an admin promote a self-registered driver to supervisor/admin at
// review time instead of requiring a separate manual step) and defaults to
// the role already on the row (always "driver" for self-registration) when
// omitted.
export const ReviewUserSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  role: z.enum(PROMOTABLE_ROLES).optional(),
});

export type ReviewUserInput = z.infer<typeof ReviewUserSchema>;

// Body for PATCH /users/:id/role (TOR-126) — changes the role of a user
// that's already past the pending-review step, from "Gestión de usuarios".
// Same PROMOTABLE_ROLES as above (super_admin excluded — CLAUDE.md: only
// assignable from the DB).
export const UpdateUserRoleSchema = z.object({
  role: z.enum(PROMOTABLE_ROLES),
});

export type UpdateUserRoleInput = z.infer<typeof UpdateUserRoleSchema>;

// Roles the self-service invite flow (TOR-125) can create — "driver" is
// excluded (drivers only ever arrive via mobile self-registration) and
// super_admin is excluded (CLAUDE.md: only assignable from the DB).
export const INVITABLE_ROLES = ["supervisor", "admin"] as const;

// Body for POST /users/invite (TOR-125) — a super_admin inviting a new
// admin/supervisor without leaving the dashboard or touching Supabase Auth
// directly (unlike CreateUserSchema, which links an *existing* Supabase Auth
// user by authUserId — that manual-linking flow still works, this one
// replaces it as the default path for a brand-new person).
export const InviteUserSchema = UserSchema.pick({ name: true, email: true }).extend({
  role: z.enum(INVITABLE_ROLES),
});

export type InviteUserInput = z.infer<typeof InviteUserSchema>;
