import type {
  CreateRouteWithStopsInput,
  DuplicateRouteInput,
  Route,
  RoutesPage,
  RouteStatusFilter,
  UpdateRouteInput,
} from "@torpreca/shared";

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

// Filters of the Rutas table (see ListRoutesQuerySchema in @torpreca/shared).
export type RoutesSearchFilter = {
  q?: string;
  status?: RouteStatusFilter;
  driverId?: string;
  vehicleId?: string;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
};

export type RoutesSearchResult = { ok: true; page: RoutesPage } | { ok: false; status: number };

export async function searchRoutes(filter: RoutesSearchFilter): Promise<RoutesSearchResult> {
  try {
    const params = new URLSearchParams();
    for (const key of ["q", "status", "driverId", "vehicleId", "from", "to"] as const) {
      const value = filter[key];
      if (value) params.set(key, value);
    }
    params.set("limit", String(filter.limit));
    params.set("offset", String(filter.offset));

    const res = await fetch(`/api/routes/search?${params.toString()}`);
    if (!res.ok) return { ok: false, status: res.status };
    const page = (await res.json()) as RoutesPage;
    return { ok: true, page };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type CreateRouteResult = { ok: true; route: Route } | { ok: false; status: number };

export async function createRoute(input: CreateRouteWithStopsInput): Promise<CreateRouteResult> {
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

export type DuplicateRouteResult = { ok: true; route: Route } | { ok: false; status: number };

// POST /api/routes/:id/duplicate — the new route (with its stops) is built
// from the body, `id` is only the route it was modelled on.
export async function duplicateRoute(
  id: string,
  input: DuplicateRouteInput,
): Promise<DuplicateRouteResult> {
  try {
    const res = await fetch(`/api/routes/${id}/duplicate`, {
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

export type CloseRouteResult = { ok: true; route: Route } | { ok: false; status: number };

export async function closeRoute(id: string): Promise<CloseRouteResult> {
  try {
    const res = await fetch(`/api/routes/${id}/close`, { method: "PATCH" });
    if (!res.ok) return { ok: false, status: res.status };
    const route = (await res.json()) as Route;
    return { ok: true, route };
  } catch {
    return { ok: false, status: 0 };
  }
}
