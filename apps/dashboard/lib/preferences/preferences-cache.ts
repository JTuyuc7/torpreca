import type { Language, MapView, Theme } from "@torpreca/shared";

const KEY = "torpreca:preferences";

export type CachedPreferences = {
  theme: Theme;
  language: Language;
  defaultMapView: MapView | null;
};

const DEFAULTS: CachedPreferences = { theme: "system", language: "es", defaultMapView: null };

// Read before the backend round-trip resolves (PreferencesProvider mount) so
// the UI doesn't flash the hardcoded defaults for a beat on every load —
// same "cache first, reconcile after" pattern as lib/auth/session-cache.ts.
// Unlike that cache, this one is allowed to go briefly stale (a theme/language
// change made on another device won't show here until the next backend sync)
// since it's a display preference, not an auth decision.
export function readCachedPreferences(): CachedPreferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<CachedPreferences>) };
  } catch {
    return DEFAULTS;
  }
}

export function writeCachedPreferences(prefs: CachedPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Private browsing / quota exceeded — losing this cache just means the
    // next load falls back to DEFAULTS until the backend fetch resolves.
  }
}
