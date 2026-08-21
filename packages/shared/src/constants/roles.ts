// Literal values match the Postgres enum `user_role` — do not rename without a DB migration.
export const ROLES = ["driver", "supervisor", "admin", "super_admin"] as const;

export type Role = (typeof ROLES)[number];