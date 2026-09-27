import { describe, expect, test } from "bun:test";
import { isRouteOverdue } from "./route-overdue";

const today = "2026-09-26";

describe("isRouteOverdue", () => {
  test("pending and in_progress routes of a past day are overdue", () => {
    expect(isRouteOverdue({ status: "pending", date: "2026-09-25" }, today)).toBe(true);
    expect(isRouteOverdue({ status: "in_progress", date: "2026-09-25" }, today)).toBe(true);
  });

  test("today's and future routes are not overdue", () => {
    expect(isRouteOverdue({ status: "pending", date: today }, today)).toBe(false);
    expect(isRouteOverdue({ status: "pending", date: "2026-09-27" }, today)).toBe(false);
  });

  test("finished routes are never overdue", () => {
    expect(isRouteOverdue({ status: "completed", date: "2026-09-01" }, today)).toBe(false);
    expect(isRouteOverdue({ status: "cancelled", date: "2026-09-01" }, today)).toBe(false);
  });
});
