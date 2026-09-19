import type { AuthUser } from "@torpreca/shared";
import { getServerAccessToken } from "@/lib/auth/server-access-token";
import { callBackend } from "@/lib/backend/signed-fetch";

export type ResolveAuthUserResult = { ok: true; user: AuthUser } | { ok: false; status: number };

// Server-side equivalent of the old two-step "browser reads its Supabase
// session, then POSTs the token to /api/auth/session" — used right after
// POST /api/auth/login signs a session in, and on every GET /api/auth/session
// call the protected layout makes on mount. Both read the token straight
// from the httpOnly cookie (TOR-124) instead of a client-supplied header.
export async function resolveAuthUser(clientIp: string | null): Promise<ResolveAuthUserResult> {
  const token = await getServerAccessToken();
  if (!token) return { ok: false, status: 401 };

  const res = await callBackend("/api/v1/auth/session", {
    method: "POST",
    authorization: `Bearer ${token}`,
    clientIp,
  });

  if (!res.ok) return { ok: false, status: res.status };
  const user = (await res.json()) as AuthUser;
  return { ok: true, user };
}
