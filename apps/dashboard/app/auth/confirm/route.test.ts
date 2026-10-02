import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyOtp = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => ({ auth: { verifyOtp } }),
}));

vi.stubEnv("APP_URL", "https://dash.example.com");

const { GET, POST } = await import("./route");

function postRequest(fields: Record<string, string>) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.set(key, value);
  return new Request("https://dash.example.com/auth/confirm", { method: "POST", body });
}

describe("GET /auth/confirm", () => {
  beforeEach(() => verifyOtp.mockReset());

  // Email scanners GET every link; the single-use token must survive that.
  it("never verifies the token — it only forwards to the continue page", async () => {
    const res = await GET(
      new Request("https://dash.example.com/auth/confirm?token_hash=abc&type=invite"),
    );

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "https://dash.example.com/auth/confirm/continue?token_hash=abc&type=invite",
    );
  });

  it("sends a link with no token to the failed notice", async () => {
    const res = await GET(new Request("https://dash.example.com/auth/confirm"));

    expect(res.headers.get("location")).toBe(
      "https://dash.example.com/login?reason=confirm-failed",
    );
  });
});

describe("POST /auth/confirm", () => {
  beforeEach(() => verifyOtp.mockReset());

  it("verifies the token and sends an invitee to set their password", async () => {
    verifyOtp.mockResolvedValue({ error: null });

    const res = await POST(postRequest({ token_hash: "abc", type: "invite" }));

    expect(verifyOtp).toHaveBeenCalledWith({ type: "invite", token_hash: "abc" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://dash.example.com/auth/set-password");
  });

  it("sends a confirmed driver to the confirmation notice", async () => {
    verifyOtp.mockResolvedValue({ error: null });

    const res = await POST(postRequest({ token_hash: "abc", type: "signup" }));

    expect(res.headers.get("location")).toBe("https://dash.example.com/auth/confirmed");
  });

  it("redirects to the failed notice when Supabase rejects the token", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "expired" } });

    const res = await POST(postRequest({ token_hash: "abc", type: "invite" }));

    expect(res.headers.get("location")).toBe(
      "https://dash.example.com/login?reason=confirm-failed",
    );
  });

  it("does not call Supabase when the form is missing fields", async () => {
    const res = await POST(postRequest({ type: "invite" }));

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe(
      "https://dash.example.com/login?reason=confirm-failed",
    );
  });
});
