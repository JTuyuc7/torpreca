import type { CreateUserInput, Role, User } from "@torpreca/shared";

// Browser-side calls to this app's own /api/users* BFF route handlers (see
// lib/backend/signed-fetch.ts) — same centralization pattern as
// lib/api/auth-client.ts.

export type UsersResult = { ok: true; users: User[] } | { ok: false; status: number };

export type PendingUsersResult = UsersResult;

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

// Lists every user regardless of status — powers the "Gestión de usuarios"
// screen (unlike listPendingUsers, which the driver approval queue uses).
export async function listAllUsers(accessToken: string): Promise<UsersResult> {
  try {
    const res = await fetch("/api/users?status=all", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { ok: false, status: res.status };
    const users = (await res.json()) as User[];
    return { ok: true, users };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type CreateUserResult = { ok: true; user: User } | { ok: false; status: number };

// Links an existing Supabase Auth user (created outside the dashboard — see
// the scope note on TOR-42) to a new `users` profile row.
export async function createUser(
  accessToken: string,
  input: CreateUserInput,
): Promise<CreateUserResult> {
  try {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return { ok: false, status: res.status };
    const user = (await res.json()) as User;
    return { ok: true, user };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type DeactivateUserResult = { ok: true } | { ok: false; status: number };

export async function deactivateUser(
  accessToken: string,
  id: string,
): Promise<DeactivateUserResult> {
  try {
    const res = await fetch(`/api/users/${id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type ReviewUserResult = { ok: true; user: User } | { ok: false; status: number };

export async function reviewUser(
  accessToken: string,
  id: string,
  decision: "approve" | "reject",
  role?: Role,
): Promise<ReviewUserResult> {
  try {
    const res = await fetch(`/api/users/${id}/review`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(role ? { decision, role } : { decision }),
    });
    if (!res.ok) return { ok: false, status: res.status };
    const user = (await res.json()) as User;
    return { ok: true, user };
  } catch {
    return { ok: false, status: 0 };
  }
}