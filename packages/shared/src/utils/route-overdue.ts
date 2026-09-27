import type { RouteStatus } from "../constants/statuses";
import { businessDate } from "./business-date";

/**
 * A route that was never finished and whose day is over: still `pending`
 * (never started) or `in_progress` (started, never closed) on a date before
 * today. Derived, not stored — there's no "overdue" value in the `route_status`
 * enum and no job that would have to flip it at midnight.
 */
export function isRouteOverdue(
  route: { status: RouteStatus; date: string },
  today: string = businessDate(),
): boolean {
  return (route.status === "pending" || route.status === "in_progress") && route.date < today;
}
