import type { CreateVehicleInput, Vehicle } from "@torpreca/shared";
import { AppError, NotFoundError } from "../../core/errors/app-error";
import type { VehiclesRepository } from "./vehicles.repository";

// Takes the repository as a dependency instead of importing the real one:
// tests pass in an in-memory one and this runs without touching Supabase.
export function createVehiclesService(repo: VehiclesRepository) {
  return {
    async list(onlyActive?: boolean): Promise<Vehicle[]> {
      return repo.list(onlyActive);
    },

    async getById(id: string): Promise<Vehicle> {
      const vehicle = await repo.getById(id);
      if (!vehicle) throw new NotFoundError("Vehicle not found");
      return vehicle;
    },

    async create(input: CreateVehicleInput): Promise<Vehicle> {
      const existing = await repo.getByPlate(input.plate);
      if (existing) throw new AppError(409, "A vehicle with that plate already exists");
      return repo.create(input);
    },

    async deactivate(id: string): Promise<void> {
      await this.getById(id);
      await repo.deactivate(id);
    },
  };
}

export type VehiclesService = ReturnType<typeof createVehiclesService>;