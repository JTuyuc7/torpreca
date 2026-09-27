import { beforeEach, describe, expect, it, vi } from "vitest";
import { login, logout, verifySession } from "./auth-client";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("login", () => {
  it("posts credentials and returns ok:true with the parsed AuthUser on success", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "u1", role: "admin", status: "active" }), { status: 200 }),
    );

    const result = await login("a@b.com", "secret");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "a@b.com", password: "secret" }),
      }),
    );
    expect(result).toEqual({ ok: true, user: { id: "u1", role: "admin", status: "active" } });
  });

  it("returns ok:false with the response status on invalid credentials", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    const result = await login("a@b.com", "wrong");

    expect(result).toEqual({ ok: false, status: 401 });
  });

  it("returns ok:false with status 0 instead of throwing on a network error", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const result = await login("a@b.com", "secret");

    expect(result).toEqual({ ok: false, status: 0 });
  });
});

describe("verifySession", () => {
  it("returns ok:true with the parsed AuthUser on success", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: "u1", role: "admin", status: "active" }), { status: 200 }),
    );

    const result = await verifySession();

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/session");
    expect(result).toEqual({ ok: true, user: { id: "u1", role: "admin", status: "active" } });
  });

  it("returns ok:false with the response status on failure", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));

    const result = await verifySession();

    expect(result).toEqual({ ok: false, status: 403 });
  });

  it("returns ok:false with status 0 instead of throwing when the body can't be parsed as JSON despite a 200", async () => {
    fetchMock.mockResolvedValue(new Response("not json", { status: 200 }));

    const result = await verifySession();

    expect(result).toEqual({ ok: false, status: 0 });
  });

  it("returns ok:false with status 0 instead of throwing on a network error", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const result = await verifySession();

    expect(result).toEqual({ ok: false, status: 0 });
  });
});

describe("logout", () => {
  it("posts to /api/auth/logout and never throws, even if the request fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(logout()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", expect.objectContaining({ method: "POST" }));
  });
});
