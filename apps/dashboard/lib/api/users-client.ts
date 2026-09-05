import type { User } from "@torpreca/shared";

// Browser-side calls to this app's own /api/users* BFF route handlers (see
// lib/backend/signed-fetch.ts) — same centralization pattern as
// lib/api/auth-client.ts.

export type PendingUsersResult = { ok: true; users: User[] } | { ok: false; status: number };

export async function listPendingUsers(accessToken: string): Promise<PendingUsersResult> {
  try {
    const res = await fetch("/api/users?status=pending", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { ok: false, status: res.status };
    const users = (await res.json()) as User[];
    return { ok: true, users };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type ReviewUserResult = { ok: true; user: User } | { ok: false; status: number };

export async function reviewUser(
  accessToken: string,
  id: string,
  decision: "approve" | "reject",
): Promise<ReviewUserResult> {
  try {
    const res = await fetch(`/api/users/${id}/review`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    if (!res.ok) return { ok: false, status: res.status };
    const user = (await res.json()) as User;
    return { ok: true, user };
  } catch {
    return { ok: false, status: 0 };
  }
}