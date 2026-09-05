// Literal values match the Postgres enum `audit_action` — do not rename without a DB migration.
export const AUDIT_EVENTS = [
  "auth.login",
  "auth.login_failed",
  "auth.logout",
  "auth.registered",
  "user.created",
  "user.deactivated",
  "user.approved",
  "user.rejected",
  "route.created",
  "route.started",
  "route.finished",
  "stop.completed",
  "stop.delayed",
  "sync.completed",
  "access.denied",
] as const;

export type AuditEvent = (typeof AUDIT_EVENTS)[number];
