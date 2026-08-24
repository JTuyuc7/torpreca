export interface RateLimitBucket {
  tryConsume(): boolean;
}

// Same token-bucket shape as core/middleware/rate-limit.ts, but instantiated
// once per WS connection (stored on ws.data) instead of keyed in a shared Map
// — each connection is already its own isolation unit.
export function createRateLimitBucket(maxMessages: number, windowMs: number): RateLimitBucket {
  let count = 0;
  let resetAt = Date.now() + windowMs;

  return {
    tryConsume() {
      const now = Date.now();
      if (now >= resetAt) {
        count = 0;
        resetAt = now + windowMs;
      }
      if (count >= maxMessages) return false;
      count += 1;
      return true;
    },
  };
}
