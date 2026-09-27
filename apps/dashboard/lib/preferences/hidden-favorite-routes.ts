const KEY = "torpreca:hidden-favorite-routes";

// Per-viewer "don't show me this one" for the favorites list in the
// "Calcular en mapa" modal — distinct from actually deleting a favorite
// (DELETE /favorite-routes/:id), which removes it for the whole team.
// Hiding is local-only, same reasoning as lib/preferences/sidebar.ts: what
// you'd rather not see in your own list isn't shared team data.
export function readHiddenFavoriteRouteIds(): string[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function writeHiddenFavoriteRouteIds(ids: string[]): void {
  window.localStorage.setItem(KEY, JSON.stringify(ids));
}

export function hideFavoriteRoute(id: string): string[] {
  const ids = readHiddenFavoriteRouteIds();
  if (ids.includes(id)) return ids;
  const next = [...ids, id];
  writeHiddenFavoriteRouteIds(next);
  return next;
}

export function unhideFavoriteRoute(id: string): string[] {
  const next = readHiddenFavoriteRouteIds().filter((existing) => existing !== id);
  writeHiddenFavoriteRouteIds(next);
  return next;
}
