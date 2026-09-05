import { beforeEach, describe, expect, it, vi } from "vitest";
import { logout, reportLoginFailed, verifySession } from "./auth-client";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("verifySession", () => {
  it("returns ok:true with the parsed AuthUser on success", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "u1", role: "admin", status: "active" }), { status: 200 }),
    );

    const result = await verifySession("tok");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({ method: "POST", headers: { authorization: "Bearer tok" } }),
    );
    expect(result).toEqual({ ok: true, user: { id: "u1", role: "admin", status: "active" } });
  });

  it("returns ok:false with the response status on failure", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));

    const result = await verifySession("tok");

    expect(result).toEqual({ ok: false, status: 403 });
  });

  it("returns ok:false with status 0 instead of throwing when the body can't be parsed as JSON despite a 200", async () => {
    fetchMock.mockResolvedValue(new Response("not json", { status: 200 }));

    const result = await verifySession("tok");

    expect(result).toEqual({ ok: false, status: 0 });
  });

  it("returns ok:false with status 0 instead of throwing on a network error", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const result = await verifySession("tok");

    expect(result).toEqual({ ok: false, status: 0 });
  });
});

describe("reportLoginFailed", () => {
  it("posts the email and never throws, even if the request fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(reportLoginFailed("a@b.com")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login-failed",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "a@b.com" }),
      }),
    );
  });
});

describe("logout", () => {
  it("posts the bearer token and never throws, even if the request fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(logout("tok")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({ method: "POST", headers: { authorization: "Bearer tok" } }),
    );
  });
});