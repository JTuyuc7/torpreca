import type { AuthUser } from "@torpreca/shared";

// Browser-side calls to this app's own /api/auth/* BFF route handlers (which
// hold the HMAC signing secret and forward to the real backend — see
// lib/backend/signed-fetch.ts). Centralized here so login/page.tsx and
// (protected)/layout.tsx don't each carry their own raw fetch() calls.

export type VerifySessionResult = { ok: true; user: AuthUser } | { ok: false; status: number };

// `status: 0` marks a network-level failure — the request never got a real
// HTTP response, or the body couldn't be parsed as JSON despite `res.ok`
// (e.g. a proxy layer mangling Content-Encoding — see passthroughResponse()
// in lib/backend/signed-fetch.ts for a real instance of this). Without this
// try/catch, that kind of failure was an uncaught exception that left the
// login button stuck on "Ingresando..." forever with no visible error.
export async function verifySession(accessToken: string): Promise<VerifySessionResult> {
  try {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) return { ok: false, status: res.status };
    const user = (await res.json()) as AuthUser;
    return { ok: true, user };
  } catch {
    return { ok: false, status: 0 };
  }
}

export async function reportLoginFailed(email: string): Promise<void> {
  await fetch("/api/auth/login-failed", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  }).catch(() => {});
}

export async function logout(accessToken: string): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}` },
  }).catch(() => {});
}