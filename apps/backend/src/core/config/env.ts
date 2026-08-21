import { z } from "zod";

const EnvSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SECRET_KEY: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  ALLOWED_ORIGINS: z
    .string()
    .min(1)
    .transform((v) => v.split(",").map((origin) => origin.trim())),
});

// Fails at boot if a variable is missing or malformed — better there than mid-request.
export const env = EnvSchema.parse(process.env);