import { describe, expect, it } from "vitest";
import { passthroughResponse } from "./signed-fetch";

describe("passthroughResponse", () => {
  it("preserves status and content-type but drops Content-Encoding/Content-Length", async () => {
    // Simulates what a compressing proxy in front of the backend leaves on
    // the Response object even after fetch() has already transparently
    // decompressed `res.body` — forwarding these verbatim (the bug this
    // guards against) tells the browser the already-plain body is still
    // brotli-compressed, breaking res.json() on the client.
    const upstream = new Response(JSON.stringify({ id: "u1" }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        "content-encoding": "br",
        "content-length": "999",
      },
    });

    const result = passthroughResponse(upstream);

    expect(result.status).toBe(200);
    expect(result.headers.get("content-type")).toBe("application/json");
    expect(result.headers.get("content-encoding")).toBeNull();
    expect(await result.json()).toEqual({ id: "u1" });
  });

  it("preserves a non-2xx status with no body", () => {
    const upstream = new Response(null, { status: 403 });

    const result = passthroughResponse(upstream);

    expect(result.status).toBe(403);
  });
});