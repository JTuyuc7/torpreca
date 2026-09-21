import type { UpdateUserPreferencesInput, UserPreferences } from "@torpreca/shared";

// Same BFF-proxy pattern as lib/api/favorite-routes-client.ts — no access
// token passed from here, the httpOnly session cookie rides along on the
// same-origin fetch() and each route handler resolves it server-side.

export type GetPreferencesResult =
  | { ok: true; preferences: UserPreferences }
  | { ok: false; status: number };

export async function getPreferences(): Promise<GetPreferencesResult> {
  try {
    const res = await fetch("/api/preferences");
    if (!res.ok) return { ok: false, status: res.status };
    const preferences = (await res.json()) as UserPreferences;
    return { ok: true, preferences };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type UpdatePreferencesResult =
  | { ok: true; preferences: UserPreferences }
  | { ok: false, status: number };

export async function updatePreferences(
  patch: UpdateUserPreferencesInput,
): Promise<UpdatePreferencesResult> {
  try {
    const res = await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return { ok: false, status: res.status };
    const preferences = (await res.json()) as UserPreferences;
    return { ok: true, preferences };
  } catch {
    return { ok: false, status: 0 };
  }
}
