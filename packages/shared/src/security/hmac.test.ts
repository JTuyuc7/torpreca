import { describe, expect, it } from "bun:test";
import { buildSignaturePayload, signPayload, verifySignature } from "./hmac";

describe("buildSignaturePayload", () => {
  it("joins method, path, timestamp and body with newlines", () => {
    const payload = buildSignaturePayload(
      "post",
      "/api/v1/routes?date=2026-08-23",
      "123",
      '{"a":1}',
    );
    expect(payload).toBe('POST\n/api/v1/routes?date=2026-08-23\n123\n{"a":1}');
  });
});

describe("verifySignature", () => {
  const secret = "test-secret";
  const payload = buildSignaturePayload("GET", "/api/v1/routes", "1000", "");

  it("accepts a signature produced with the same secret and payload", () => {
    const signature = signPayload(secret, payload);
    expect(verifySignature(secret, payload, signature)).toBe(true);
  });

  it("rejects a signature produced with a different secret", () => {
    const signature = signPayload("other-secret", payload);
    expect(verifySignature(secret, payload, signature)).toBe(false);
  });

  it("rejects a signature for a different payload", () => {
    const signature = signPayload(secret, payload);
    const tampered = buildSignaturePayload("GET", "/api/v1/routes", "1000", '{"x":1}');
    expect(verifySignature(secret, tampered, signature)).toBe(false);
  });

  it("rejects non-hex signatures instead of throwing", () => {
    expect(verifySignature(secret, payload, "not-hex!!")).toBe(false);
  });

  it("rejects odd-length hex signatures instead of throwing", () => {
    expect(verifySignature(secret, payload, "abc")).toBe(false);
  });
});
