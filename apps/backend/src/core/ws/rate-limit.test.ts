import { describe, expect, it } from "bun:test";
import { createRateLimitBucket } from "./rate-limit";

describe("createRateLimitBucket", () => {
  it("allows up to maxMessages within the window", () => {
    const bucket = createRateLimitBucket(3, 10_000);
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(true);
  });

  it("blocks once maxMessages is exceeded within the window", () => {
    const bucket = createRateLimitBucket(2, 10_000);
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(false);
  });

  it("resets after the window elapses", async () => {
    const bucket = createRateLimitBucket(1, 20);
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(bucket.tryConsume()).toBe(true);
  });
});
