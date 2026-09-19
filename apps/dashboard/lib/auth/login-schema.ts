import { z } from "@torpreca/shared";

// Local to the dashboard, not @torpreca/shared: login goes straight to
// Supabase Auth (supabase.auth.signInWithPassword) and never reaches the
// backend, so there's no API contract to share. Only checks shape (valid
// email, non-empty password) — not a strength policy like RegisterSchema's
// password.min(8), which would reject real accounts whose password predates
// any length rule.
export const LoginSchema = z.object({
  email: z.email("Ingresa un correo válido."),
  password: z.string().min(1, "Ingresa tu contraseña."),
});

export type LoginFormValues = z.infer<typeof LoginSchema>;