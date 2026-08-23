import { ROLES } from "../constants/roles";
import { z } from "../zod";

// `name` travels as plaintext over the API — the backend encrypts/decrypts it
// (pgp_sym_encrypt/pgp_sym_decrypt) when reading/writing the DB.
export const UserSchema = z.object({
  id: z.uuid(),
  authUserId: z.uuid(),
  name: z.string().min(1),
  role: z.enum(ROLES),
  active: z.boolean(),
  deactivatedAt: z.iso.datetime().nullable(),
  deactivatedBy: z.uuid().nullable(),
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
