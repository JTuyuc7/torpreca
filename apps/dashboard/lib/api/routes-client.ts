import type { CreateRouteInput, Route, UpdateRouteInput } from "@torpreca/shared";

// Browser-side calls to this app's own /api/routes* BFF route handlers (see
// lib/backend/signed-fetch.ts) — same centralization pattern as
// lib/api/users-client.ts. TOR-124: no access token is passed in anymore —
// the session lives in an httpOnly cookie same-origin fetch() sends
// automatically, and each route handler resolves it server-side.

export type RoutesResult = { ok: true; routes: Route[] } | { ok: false; status: number };

export async function listRoutes(): Promise<RoutesResult> {
  try {
    const res = await fetch("/api/routes");
    if (!res.ok) return { ok: false, status: res.status };
    const routes = (await res.json()) as Route[];
    return { ok: true, routes };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type CreateRouteResult = { ok: true; route: Route } | { ok: false; status: number };

export async function createRoute(input: CreateRouteInput): Promise<CreateRouteResult> {
  try {
    const res = await fetch("/api/routes", {
      method: "POST",
      headers: { "content-type": "application/json" },
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

export async function updateRoute(id: string, input: UpdateRouteInput): Promise<UpdateRouteResult> {
  try {
    const res = await fetch(`/api/routes/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return { ok: false, status: res.status };
    const route = (await res.json()) as Route;
    return { ok: true, route };
  } catch {
    return { ok: false, status: 0 };
  }
}
