import type { AuthUser } from "@torpreca/shared";

const KEY = "torpreca:auth-user";

// sessionStorage (not localStorage): scoped to this tab/browser session, so
// it naturally expires when the tab closes — separate from Supabase's own
// (persistent) session storage. Used only to avoid re-hitting
// POST /api/auth/session (which also re-logs auth.login) on every
// client-side navigation within the same browser session.
export function readCachedAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function writeCachedAuthUser(user: AuthUser): void {
  window.sessionStorage.setItem(KEY, JSON.stringify(user));
}

export function clearCachedAuthUser(): void {
  window.sessionStorage.removeItem(KEY);
}
