import type { CreateFavoriteRouteInput, FavoriteRoute } from "@torpreca/shared";

// Browser-side calls to this app's own /api/favorite-routes* BFF route
// handlers (see lib/backend/signed-fetch.ts) — same centralization pattern
// as lib/api/vehicles-client.ts.

export type FavoriteRoutesResult =
  | { ok: true; favoriteRoutes: FavoriteRoute[] }
  | { ok: false; status: number };

export async function listFavoriteRoutes(accessToken: string): Promise<FavoriteRoutesResult> {
  try {
    const res = await fetch("/api/favorite-routes", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { ok: false, status: res.status };
    const favoriteRoutes = (await res.json()) as FavoriteRoute[];
    return { ok: true, favoriteRoutes };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type CreateFavoriteRouteResult =
  | { ok: true; favoriteRoute: FavoriteRoute }
  | { ok: false; status: number };

export async function createFavoriteRoute(
  accessToken: string,
  input: CreateFavoriteRouteInput,
): Promise<CreateFavoriteRouteResult> {
  try {
    const res = await fetch("/api/favorite-routes", {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return { ok: false, status: res.status };
    const favoriteRoute = (await res.json()) as FavoriteRoute;
    return { ok: true, favoriteRoute };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type DeleteFavoriteRouteResult = { ok: true } | { ok: false; status: number };

export async function deleteFavoriteRoute(
  accessToken: string,
  id: string,
): Promise<DeleteFavoriteRouteResult> {
  try {
    const res = await fetch(`/api/favorite-routes/${id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true };
  } catch {
    return { ok: false, status: 0 };
  }
}
