import { describe, expect, it } from "bun:test";
import { env } from "../config/env";
import { buildSignaturePayload, signPayload } from "../security/hmac";
import { requestSigning } from "./request-signing";

const ok = async () => Response.json({ ok: true });

function sign(method: string, pathWithQuery: string, timestamp: string, body: string) {
  return signPayload(
    env.REQUEST_SIGNING_SECRET,
    buildSignaturePayload(method, pathWithQuery, timestamp, body),
  );
}

describe("requestSigning", () => {
  it("skips verification for non-/api routes", async () => {
    const req = new Request("http://x/health");
    const res = await requestSigning({ req, params: {} }, ok);
    expect(res.status).toBe(200);
  });

  it("rejects a request with no signature headers", async () => {
    const req = new Request("http://x/api/v1/routes");
    await expect(requestSigning({ req, params: {} }, ok)).rejects.toThrow(
      "Missing request signature",
    );
  });

  it("rejects an expired timestamp", async () => {
    const timestamp = String(Date.now() - 10 * 60 * 1000);
    const signature = sign("GET", "/api/v1/routes", timestamp, "");
    const req = new Request("http://x/api/v1/routes", {
      headers: { "x-signature": signature, "x-timestamp": timestamp },
    });
    await expect(requestSigning({ req, params: {} }, ok)).rejects.toThrow(
      "Request signature expired",
    );
  });

  it("rejects a signature that does not match the body", async () => {
    const timestamp = String(Date.now());
    const signature = sign("POST", "/api/v1/routes", timestamp, '{"a":1}');
    const req = new Request("http://x/api/v1/routes", {
      method: "POST",
      headers: {
        "x-signature": signature,
        "x-timestamp": timestamp,
        "content-type": "application/json",
      },
      body: '{"a":2}',
    });
    await expect(requestSigning({ req, params: {} }, ok)).rejects.toThrow(
      "Invalid request signature",
    );
  });

  it("accepts a correctly signed request and preserves the body for downstream handlers", async () => {
    const timestamp = String(Date.now());
    const body = '{"a":1}';
    const signature = sign("POST", "/api/v1/routes", timestamp, body);
    const req = new Request("http://x/api/v1/routes", {
      method: "POST",
      headers: {
        "x-signature": signature,
        "x-timestamp": timestamp,
        "content-type": "application/json",
      },
      body,
    });

    const next = async (r: Request) => {
      expect(await r.text()).toBe(body);
      return Response.json({ ok: true });
    };

    const res = await requestSigning({ req, params: {} }, () => next(req));
    expect(res.status).toBe(200);
  });
});
