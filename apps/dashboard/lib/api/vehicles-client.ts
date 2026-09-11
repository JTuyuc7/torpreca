import type { Vehicle } from "@torpreca/shared";

// Browser-side calls to this app's own /api/vehicles BFF route handler (see
// lib/backend/signed-fetch.ts). Read-only for now — full vehicle CRUD is
// TOR-44; this just powers the assignment dropdown in "Gestión de rutas".

export type VehiclesResult = { ok: true; vehicles: Vehicle[] } | { ok: false; status: number };

export async function listActiveVehicles(accessToken: string): Promise<VehiclesResult> {
  try {
    const res = await fetch("/api/vehicles", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { ok: false, status: res.status };
    const vehicles = (await res.json()) as Vehicle[];
    return { ok: true, vehicles };
  } catch {
    return { ok: false, status: 0 };
  }
}