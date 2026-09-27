import { describe, expect, it } from "vitest";
import { decodeReturnTo, encodeReturnTo } from "./return-to";

describe("return-to", () => {
  it("round-trips a path with a query string", () => {
    const encoded = encodeReturnTo("/users/42?tab=history");
    expect(decodeReturnTo(encoded)).toBe("/users/42?tab=history");
  });

  it("doesn't look like the plain path", () => {
    const encoded = encodeReturnTo("/users/42");
    expect(encoded).not.toContain("/users/42");
  });

  it("returns null for a missing value", () => {
    expect(decodeReturnTo(null)).toBeNull();
  });

  it("returns null for garbage that isn't valid base64", () => {
    expect(decodeReturnTo("not-base64!!")).toBeNull();
  });

  it("rejects a decoded value pointing off-origin (open-redirect guard)", () => {
    expect(decodeReturnTo(btoa(encodeURIComponent("http://evil.example/phish")))).toBeNull();
    expect(decodeReturnTo(btoa(encodeURIComponent("//evil.example")))).toBeNull();
  });
});
