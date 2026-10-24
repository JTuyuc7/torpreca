import { beforeEach } from "bun:test";
import { resetRateLimits } from "../core/middleware/rate-limit";

// Without this, the 60 req/min general limiter is shared by every test file
// in the run and starts returning 429 once the suite grows past 60 requests.
beforeEach(() => {
  resetRateLimits();
});
