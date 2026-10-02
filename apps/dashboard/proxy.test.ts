import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

import { proxy } from "./proxy";

function request(path: string) {
  return new NextRequest(`http://localhost:3000${path}`);
}

// NextResponse.next() sets this header; a redirect sets `location` instead.
function redirectedTo(response: Response) {
  const location = response.headers.get("location");
  return location ? new URL(location).pathname : null;
}

describe("proxy", () => {
  beforeEach(() => {
    getUser.mockReset();
  });

  describe("signed out", () => {
    beforeEach(() => getUser.mockResolvedValue({ data: { user: null } }));

    it("redirects a protected page to /login", async () => {
      expect(redirectedTo(await proxy(request("/users")))).toBe("/login");
    });

    it("redirects /auth/set-password to /login (it needs the session /auth/confirm creates)", async () => {
      expect(redirectedTo(await proxy(request("/auth/set-password")))).toBe("/login");
    });

    it("lets /login through", async () => {
      expect(redirectedTo(await proxy(request("/login")))).toBeNull();
    });

    // TOR-121: the invite/signup email link lands here with no session yet —
    // bouncing it to /login meant verifyOtp never ran.
    it.each(["/auth/confirm", "/auth/confirm/continue", "/auth/confirmed"])("lets %s through without a session", async (path) => {
      expect(redirectedTo(await proxy(request(`${path}?token_hash=abc&type=invite`)))).toBeNull();
    });
  });

  describe("signed in", () => {
    beforeEach(() => getUser.mockResolvedValue({ data: { user: { id: "u1" } } }));

    it("redirects /login to the panel", async () => {
      expect(redirectedTo(await proxy(request("/login")))).toBe("/");
    });

    it("lets a protected page through", async () => {
      expect(redirectedTo(await proxy(request("/users")))).toBeNull();
    });

    it.each(["/auth/confirm", "/auth/confirm/continue", "/auth/confirmed"])("does not bounce %s to the panel", async (path) => {
      expect(redirectedTo(await proxy(request(path)))).toBeNull();
    });
  });
});
