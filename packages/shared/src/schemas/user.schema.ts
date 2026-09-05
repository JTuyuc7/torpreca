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
export const UserSchema = z.object({
  id: z.uuid(),
  authUserId: z.uuid(),
  name: z.string().min(1),
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

// Body for PATCH /users/:id/review — an admin/supervisor approving or
// rejecting a pending driver registration.
export const ReviewUserSchema = z.object({
  decision: z.enum(["approve", "reject"]),
});

export type ReviewUserInput = z.infer<typeof ReviewUserSchema>;
