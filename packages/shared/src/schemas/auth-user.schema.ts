import { ROLES } from "../constants/roles";
import { USER_STATUSES } from "../constants/statuses";
import { z } from "../zod";

// Minimal identity carried in the request context for every authenticated call.
// Does not include `name` (encrypted PII) — call usuarios.repository explicitly
// when a handler actually needs it.
export const AuthUserSchema = z.object({
  id: z.uuid(),
  role: z.enum(ROLES),
  status: z.enum(USER_STATUSES),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;
