// Literal values match the Postgres enums `route_status` / `stop_status` / `notification_type`
// — do not rename without a DB migration.
export const ROUTE_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "delayed",
  "cancelled",
] as const;

export type RouteStatus = (typeof ROUTE_STATUSES)[number];

export const STOP_STATUSES = ["pending", "next", "completed", "delayed"] as const;

export type StopStatus = (typeof STOP_STATUSES)[number];

export const NOTIFICATION_TYPES = ["info", "alert", "urgent"] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// Literal values match the Postgres enum `user_status` — do not rename without a DB migration.
export const USER_STATUSES = ["pending", "active", "rejected", "deactivated"] as const;

export type UserStatus = (typeof USER_STATUSES)[number];
