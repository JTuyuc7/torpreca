import type { DashboardSummary, Location } from "@torpreca/shared";

// Browser-side calls to this app's own BFF route handlers — same
// centralization pattern as lib/api/vehicles-client.ts. TOR-124: no access
// token is passed in anymore — the session lives in an httpOnly cookie
// same-origin fetch() sends automatically, and each route handler resolves
// it server-side.

export type SummaryResult = { ok: true; summary: DashboardSummary } | { ok: false; status: number };

export async function getDashboardSummary(): Promise<SummaryResult> {
  try {
    const res = await fetch("/api/dashboard/summary");
    if (!res.ok) return { ok: false, status: res.status };
    const summary = (await res.json()) as DashboardSummary;
    return { ok: true, summary };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type LocationsResult = { ok: true; locations: Location[] } | { ok: false; status: number };

// Initial snapshot for the live map — the WebSocket connection (see
// lib/hooks/use-live-locations.ts) takes over with incremental updates
// once it's open.
export async function getLatestLocations(): Promise<LocationsResult> {
  try {
    const res = await fetch("/api/locations/latest");
    if (!res.ok) return { ok: false, status: res.status };
    const locations = (await res.json()) as Location[];
    return { ok: true, locations };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type WsTicketResult = { ok: true; ticket: string } | { ok: false; status: number };

// Single-use, short-lived (30s) ticket minted through the signed BFF route —
// the browser attaches it as a query param on the direct WS connection to
// the backend, since the WS handshake can't carry a cookie-derived bearer
// header the way an ordinary fetch() does.
export async function mintWsTicket(): Promise<WsTicketResult> {
  try {
    const res = await fetch("/api/ws-tickets", { method: "POST" });
    if (!res.ok) return { ok: false, status: res.status };
    const data = (await res.json()) as { ticket: string };
    return { ok: true, ticket: data.ticket };
  } catch {
    return { ok: false, status: 0 };
  }
}
