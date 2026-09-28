import { z } from "@torpreca/shared";

// Local to the dashboard, like LoginSchema — mirrors RegisterSchema's
// password.min(8) (packages/shared/src/schemas/user.schema.ts) so an invited
// admin/supervisor and a self-registered driver land on the same strength
// rule, even though this flow never reaches that schema directly.
export const SetPasswordSchema = z
  .object({
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
    confirmPassword: z.string().min(1, "Confirma tu contraseña."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Las contraseñas no coinciden.",
  });

export type SetPasswordFormValues = z.infer<typeof SetPasswordSchema>;
