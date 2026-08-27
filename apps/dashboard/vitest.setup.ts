import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// No `test.globals: true` in vitest.config.mts, so @testing-library/react's
// own auto-cleanup (which hooks into a global `afterEach`) never registers —
// do it explicitly or every test after the first renders on top of the last.
afterEach(() => {
  cleanup();
});