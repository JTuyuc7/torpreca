import { z } from "../zod";

// Body for POST /auth/login-failed. Deliberately minimal — the reason is
// fixed server-side (only "invalid_credentials" is possible for a
// password-based login), so the client can't inject arbitrary metadata.
export const LoginFailedSchema = z.object({
  email: z.email(),
});

export type LoginFailedInput = z.infer<typeof LoginFailedSchema>;
