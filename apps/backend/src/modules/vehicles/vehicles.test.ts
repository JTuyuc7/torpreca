import { describe, expect, it } from "bun:test";
import type { Vehicle } from "@torpreca/shared";
import type { VehiclesRepository } from "./vehicles.repository";
import { createVehiclesService } from "./vehicles.service";

// In-memory fake of the repository — this way the service is tested without
// real Supabase. Future modules copy this exact pattern (interface + fake).
function createFakeRepo(seed: Vehicle[] = []): VehiclesRepository {
  const vehicles = [...seed];

  return {
    async list(onlyActive = true) {
      return onlyActive ? vehicles.filter((v) => v.active) : vehicles;
    },
    async getById(id) {
      return vehicles.find((v) => v.id === id) ?? null;
    },
    async getByPlate(plate) {
      return vehicles.find((v) => v.plate === plate) ?? null;
    },
    async create(input) {
      const created: Vehicle = {
        id: crypto.randomUUID(),
        plate: input.plate,
        model: input.model,
        capacity: input.capacity,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      vehicles.push(created);
      return created;
    },
    async deactivate(id) {
      const vehicle = vehicles.find((v) => v.id === id);
      if (vehicle) vehicle.active = false;
    },
  };
}

describe("vehicles.service", () => {
  it("creates a new vehicle", async () => {
    const service = createVehiclesService(createFakeRepo());
    const vehicle = await service.create({ plate: "P123ABC", model: "Hilux", capacity: 2 });

    expect(vehicle.plate).toBe("P123ABC");
    expect(vehicle.active).toBe(true);
  });

  it("rejects a duplicate plate", async () => {
    const repo = createFakeRepo([
      {
        id: "1",
        plate: "P123ABC",
        model: "Hilux",
        capacity: 2,
        active: true,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ]);
    const service = createVehiclesService(repo);

    await expect(
      service.create({ plate: "P123ABC", model: "Otro", capacity: null }),
    ).rejects.toThrow("A vehicle with that plate already exists");
  });

  it("throws NotFoundError for a missing id", async () => {
    const service = createVehiclesService(createFakeRepo());
    await expect(service.getById("no-existe")).rejects.toThrow("Vehicle not found");
  });

  it("deactivate sets active to false", async () => {
    const repo = createFakeRepo([
      {
        id: "1",
        plate: "P123ABC",
        model: "Hilux",
        capacity: 2,
        active: true,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ]);
    const service = createVehiclesService(repo);

    await service.deactivate("1");
    const [vehicle] = await repo.list(false);
    expect(vehicle?.active).toBe(false);
  });
});