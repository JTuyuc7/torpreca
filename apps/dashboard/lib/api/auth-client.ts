import type { AuthUser } from "@torpreca/shared";

// Browser-side calls to this app's own /api/auth/* BFF route handlers (which
// hold the HMAC signing secret and forward to the real backend — see
// lib/backend/signed-fetch.ts). Centralized here so login/page.tsx and
// (protected)/layout.tsx don't each carry their own raw fetch() calls.

export type VerifySessionResult = { ok: true; user: AuthUser } | { ok: false; status: number };

export async function verifySession(accessToken: string): Promise<VerifySessionResult> {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return { ok: false, status: res.status };
  const user = (await res.json()) as AuthUser;
  return { ok: true, user };
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