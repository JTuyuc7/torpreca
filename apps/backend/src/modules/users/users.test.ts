import { describe, expect, it } from "bun:test";
import type { User } from "@torpreca/shared";
import type { UsersRepository } from "./users.repository";
import { createUsersService } from "./users.service";

// In-memory fake of the repository — same pattern as vehicles.test.ts.
function createFakeRepo(seed: User[] = []): UsersRepository {
  const users = [...seed];

  return {
    async list(onlyActive = true) {
      return onlyActive ? users.filter((u) => u.active) : users;
    },
    async getById(id) {
      return users.find((u) => u.id === id) ?? null;
    },
    async getByAuthUserId(authUserId) {
      return users.find((u) => u.authUserId === authUserId) ?? null;
    },
    async create(input) {
      const created: User = {
        id: crypto.randomUUID(),
        authUserId: input.authUserId,
        name: input.name,
        role: input.role,
        active: true,
        deactivatedAt: null,
        deactivatedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      users.push(created);
      return created;
    },
    async deactivate(id, deactivatedBy) {
      const user = users.find((u) => u.id === id);
      if (user) {
        user.active = false;
        user.deactivatedAt = new Date().toISOString();
        user.deactivatedBy = deactivatedBy;
      }
    },
  };
}

describe("users.service", () => {
  it("creates a new user", async () => {
    const service = createUsersService(createFakeRepo());
    const user = await service.create({
      authUserId: crypto.randomUUID(),
      name: "Juan Pérez",
      role: "driver",
    });

    expect(user.name).toBe("Juan Pérez");
    expect(user.active).toBe(true);
  });

  it("rejects a duplicate auth_user_id", async () => {
    const authUserId = crypto.randomUUID();
    const repo = createFakeRepo([
      {
        id: "1",
        authUserId,
        name: "Juan Pérez",
        role: "driver",
        active: true,
        deactivatedAt: null,
        deactivatedBy: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ]);
    const service = createUsersService(repo);

    await expect(
      service.create({ authUserId, name: "Otro Nombre", role: "supervisor" }),
    ).rejects.toThrow("User with this auth_user_id already exists");
  });

  it("throws NotFoundError for a missing id", async () => {
    const service = createUsersService(createFakeRepo());
    await expect(service.getById("no-existe")).rejects.toThrow("User not found");
  });

  it("deactivate sets active to false and records who did it", async () => {
    const repo = createFakeRepo([
      {
        id: "1",
        authUserId: crypto.randomUUID(),
        name: "Juan Pérez",
        role: "driver",
        active: true,
        deactivatedAt: null,
        deactivatedBy: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ]);
    const service = createUsersService(repo);

    await service.deactivate("1", "admin-id");
    const [user] = await repo.list(false);
    expect(user?.active).toBe(false);
    expect(user?.deactivatedBy).toBe("admin-id");
  });
});
