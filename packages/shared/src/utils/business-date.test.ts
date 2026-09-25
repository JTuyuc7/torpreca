import { describe, expect, test } from "bun:test";
import { businessDate } from "./business-date";

describe("businessDate", () => {
  test("uses the Guatemala calendar day, not UTC, in the evening", () => {
    // 2026-09-25T02:30Z is still 2026-09-24 20:30 in Guatemala (UTC-6).
    expect(businessDate(new Date("2026-09-25T02:30:00Z"))).toBe("2026-09-24");
  });

  test("matches UTC during the day", () => {
    expect(businessDate(new Date("2026-09-24T15:00:00Z"))).toBe("2026-09-24");
  });

  test("rolls over at local midnight (06:00Z)", () => {
    expect(businessDate(new Date("2026-09-24T05:59:59Z"))).toBe("2026-09-23");
    expect(businessDate(new Date("2026-09-24T06:00:00Z"))).toBe("2026-09-24");
  });
});
