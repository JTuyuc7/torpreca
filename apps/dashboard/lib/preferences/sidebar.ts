const KEY = "torpreca:sidebar-collapsed";

// localStorage (not sessionStorage): a UI preference like this should
// survive across tabs and reloads, unlike the auth-user role cache in
// lib/auth/session-cache.ts, which is deliberately tab-scoped.
export function readStoredSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "true";
}

export function writeStoredSidebarCollapsed(collapsed: boolean): void {
  window.localStorage.setItem(KEY, String(collapsed));
}