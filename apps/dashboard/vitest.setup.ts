import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom doesn't implement the Pointer Events capture APIs or scrollIntoView
// — Radix's DropdownMenu (unlike Dialog) calls these when a trigger opens,
// so without stubs the whole interaction silently no-ops in tests instead of
// throwing, which is more confusing to debug.
const pointerCaptureMethods = ["hasPointerCapture", "setPointerCapture", "releasePointerCapture"] as const;
for (const method of pointerCaptureMethods) {
  if (!(method in Element.prototype)) {
    Object.defineProperty(Element.prototype, method, { value: () => false, writable: true });
  }
}
if (!("scrollIntoView" in Element.prototype)) {
  Object.defineProperty(Element.prototype, "scrollIntoView", { value: () => {}, writable: true });
}

// No `test.globals: true` in vitest.config.mts, so @testing-library/react's
// own auto-cleanup (which hooks into a global `afterEach`) never registers —
// do it explicitly or every test after the first renders on top of the last.
afterEach(() => {
  cleanup();
});