import type { CreateStopBodyInput, Stop, UpdateStopInput } from "@torpreca/shared";

// Browser-side calls to this app's own /api/routes/:id/stops* and
// /api/stops/:id BFF route handlers — same centralization pattern as
// lib/api/routes-client.ts (TOR-137).

export type StopsResult = { ok: true; stops: Stop[] } | { ok: false; status: number };

export async function listStops(routeId: string): Promise<StopsResult> {
  try {
    const res = await fetch(`/api/routes/${routeId}/stops`);
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, stops: (await res.json()) as Stop[] };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type StopResult = { ok: true; stop: Stop } | { ok: false; status: number };

export async function createStop(routeId: string, input: CreateStopBodyInput): Promise<StopResult> {
  try {
    const res = await fetch(`/api/routes/${routeId}/stops`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, stop: (await res.json()) as Stop };
  } catch {
    return { ok: false, status: 0 };
  }
}

export async function updateStop(id: string, input: UpdateStopInput): Promise<StopResult> {
  try {
    const res = await fetch(`/api/stops/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, stop: (await res.json()) as Stop };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type DeleteStopResult = { ok: true } | { ok: false; status: number };

export async function deleteStop(id: string): Promise<DeleteStopResult> {
  try {
    const res = await fetch(`/api/stops/${id}`, { method: "DELETE" });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true };
  } catch {
    return { ok: false, status: 0 };
  }
}

export async function reorderStops(routeId: string, stopIds: string[]): Promise<StopsResult> {
  try {
    const res = await fetch(`/api/routes/${routeId}/stops/order`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stopIds }),
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, stops: (await res.json()) as Stop[] };
  } catch {
    return { ok: false, status: 0 };
  }
}
