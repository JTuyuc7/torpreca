import { ROLES } from "../constants/roles";
import { z } from "../zod";

// Minimal identity carried in the request context for every authenticated call.
// Does not include `name` (encrypted PII) — call usuarios.repository explicitly
// when a handler actually needs it.
export const AuthUserSchema = z.object({
  id: z.uuid(),
  role: z.enum(ROLES),
  active: z.boolean(),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;
