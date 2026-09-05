import { describe, expect, it } from "bun:test";
import type { User, UserStatus } from "@torpreca/shared";
import type { UsersRepository } from "./users.repository";
import { createUsersService } from "./users.service";

// In-memory fake of the repository — same pattern as vehicles.test.ts.
function createFakeRepo(seed: User[] = []): UsersRepository {
  const users = [...seed];

  return {
    async list(status: UserStatus | "all" = "active") {
      return status === "all" ? users : users.filter((u) => u.status === status);
    },
    async getById(id) {
      return users.find((u) => u.id === id) ?? null;
    },
    async getByAuthUserId(authUserId) {
      return users.find((u) => u.authUserId === authUserId) ?? null;
    },
    async create(input, status = "active") {
      const created: User = {
        id: crypto.randomUUID(),
        authUserId: input.authUserId,
        name: input.name,
        role: input.role,
        status,
        deactivatedAt: null,
        deactivatedBy: null,
        reviewedAt: null,
        reviewedBy: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      users.push(created);
      return created;
    },
    async deactivate(id, deactivatedBy) {
      const user = users.find((u) => u.id === id);
      if (user) {
        user.status = "deactivated";
        user.deactivatedAt = new Date().toISOString();
        user.deactivatedBy = deactivatedBy;
      }
    },
    async review(id, decision, reviewedBy) {
      const user = users.find((u) => u.id === id);
      if (user) {
        user.status = decision === "approve" ? "active" : "rejected";
        user.reviewedAt = new Date().toISOString();
        user.reviewedBy = reviewedBy;
      }
    },
  };
}

describe("users.service", () => {
  it("creates a new user, active by default", async () => {
    const service = createUsersService(createFakeRepo());
    const user = await service.create({
      authUserId: crypto.randomUUID(),
      name: "Juan Pérez",
      role: "driver",
    });

    expect(user.name).toBe("Juan Pérez");
    expect(user.status).toBe("active");
  });

  it("rejects a duplicate auth_user_id", async () => {
    const authUserId = crypto.randomUUID();
    const repo = createFakeRepo([
      {
        id: "1",
        authUserId,
        name: "Juan Pérez",
        role: "driver",
        status: "active",
        deactivatedAt: null,
        deactivatedBy: null,
        reviewedAt: null,
        reviewedBy: null,
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

  it("deactivate sets status=deactivated and records who did it", async () => {
    const repo = createFakeRepo([
      {
        id: "1",
        authUserId: crypto.randomUUID(),
        name: "Juan Pérez",
        role: "driver",
        status: "active",
        deactivatedAt: null,
        deactivatedBy: null,
        reviewedAt: null,
        reviewedBy: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ]);
    const service = createUsersService(repo);

    await service.deactivate("1", "admin-id");
    const [user] = await repo.list("all");
    expect(user?.status).toBe("deactivated");
    expect(user?.deactivatedBy).toBe("admin-id");
  });

  describe("review", () => {
    function pendingRepo() {
      return createFakeRepo([
        {
          id: "1",
          authUserId: crypto.randomUUID(),
          name: "Driver Nuevo",
          role: "driver",
          status: "pending",
          deactivatedAt: null,
          deactivatedBy: null,
          reviewedAt: null,
          reviewedBy: null,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ]);
    }

    it("approve sets status=active and records reviewedBy", async () => {
      const service = createUsersService(pendingRepo());
      const user = await service.review("1", "approve", "admin-id");
      expect(user.status).toBe("active");
      expect(user.reviewedBy).toBe("admin-id");
    });

    it("reject sets status=rejected", async () => {
      const service = createUsersService(pendingRepo());
      const user = await service.review("1", "reject", "admin-id");
      expect(user.status).toBe("rejected");
    });

    it("rejects reviewing a user that isn't pending", async () => {
      const repo = createFakeRepo([
        {
          id: "1",
          authUserId: crypto.randomUUID(),
          name: "Ya activo",
          role: "driver",
          status: "active",
          deactivatedAt: null,
          deactivatedBy: null,
          reviewedAt: null,
          reviewedBy: null,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ]);
      const service = createUsersService(repo);

      await expect(service.review("1", "approve", "admin-id")).rejects.toThrow(
        "User is not pending review",
      );
    });
  });
});
