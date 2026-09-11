import type { CreateRouteInput, Route, UpdateRouteInput } from "@torpreca/shared";

// Browser-side calls to this app's own /api/routes* BFF route handlers (see
// lib/backend/signed-fetch.ts) — same centralization pattern as
// lib/api/users-client.ts.

export type RoutesResult = { ok: true; routes: Route[] } | { ok: false; status: number };

export async function listRoutes(accessToken: string): Promise<RoutesResult> {
  try {
    const res = await fetch("/api/routes", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { ok: false, status: res.status };
    const routes = (await res.json()) as Route[];
    return { ok: true, routes };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type CreateRouteResult = { ok: true; route: Route } | { ok: false; status: number };

export async function createRoute(
  accessToken: string,
  input: CreateRouteInput,
): Promise<CreateRouteResult> {
  try {
    const res = await fetch("/api/routes", {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return { ok: false, status: res.status };
    const route = (await res.json()) as Route;
    return { ok: true, route };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type UpdateRouteResult = { ok: true; route: Route } | { ok: false; status: number };

export async function updateRoute(
  accessToken: string,
  id: string,
  input: UpdateRouteInput,
): Promise<UpdateRouteResult> {
  try {
    const res = await fetch(`/api/routes/${id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return { ok: false, status: res.status };
    const route = (await res.json()) as Route;
    return { ok: true, route };
  } catch {
    return { ok: false, status: 0 };
  }
}