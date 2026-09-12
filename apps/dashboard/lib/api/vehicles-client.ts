import type { CreateVehicleInput, UpdateVehicleInput, Vehicle } from "@torpreca/shared";

// Browser-side calls to this app's own /api/vehicles* BFF route handlers (see
// lib/backend/signed-fetch.ts) — same centralization pattern as
// lib/api/users-client.ts.

export type VehiclesResult = { ok: true; vehicles: Vehicle[] } | { ok: false; status: number };

// Powers the assignment dropdown in "Gestión de rutas" (TOR-30) — active
// vehicles only.
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

// Powers "Gestión de vehículos" (TOR-44) — includes deactivated ones so they
// can be reactivated.
export async function listAllVehicles(accessToken: string): Promise<VehiclesResult> {
  try {
    const res = await fetch("/api/vehicles?all=true", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { ok: false, status: res.status };
    const vehicles = (await res.json()) as Vehicle[];
    return { ok: true, vehicles };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type CreateVehicleResult = { ok: true; vehicle: Vehicle } | { ok: false; status: number };

export async function createVehicle(
  accessToken: string,
  input: CreateVehicleInput,
): Promise<CreateVehicleResult> {
  try {
    const res = await fetch("/api/vehicles", {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return { ok: false, status: res.status };
    const vehicle = (await res.json()) as Vehicle;
    return { ok: true, vehicle };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type UpdateVehicleResult = { ok: true; vehicle: Vehicle } | { ok: false; status: number };

export async function updateVehicle(
  accessToken: string,
  id: string,
  input: UpdateVehicleInput,
): Promise<UpdateVehicleResult> {
  try {
    const res = await fetch(`/api/vehicles/${id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return { ok: false, status: res.status };
    const vehicle = (await res.json()) as Vehicle;
    return { ok: true, vehicle };
  } catch {
    return { ok: false, status: 0 };
  }
}

export type DeactivateVehicleResult = { ok: true } | { ok: false; status: number };

export async function deactivateVehicle(
  accessToken: string,
  id: string,
): Promise<DeactivateVehicleResult> {
  try {
    const res = await fetch(`/api/vehicles/${id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true };
  } catch {
    return { ok: false, status: 0 };
  }
}