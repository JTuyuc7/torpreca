import { describe, expect, it } from "bun:test";
import type { AuthUser, Role, User, UserStatus } from "@torpreca/shared";
import { registerConnection } from "../../core/ws/connection-registry";
import { createRateLimitBucket } from "../../core/ws/rate-limit";
import type { TrackingWs } from "../../core/ws/tracking-handlers";
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
        email: input.email,
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
    async invite(input) {
      const created: User = {
        id: crypto.randomUUID(),
        authUserId: crypto.randomUUID(),
        name: input.name,
        email: input.email,
        role: input.role,
        status: "active",
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
    async updateRole(id, role) {
      const user = users.find((u) => u.id === id);
      if (user) user.role = role;
    },
    async review(id, decision, reviewedBy, role?: Role) {
      const user = users.find((u) => u.id === id);
      if (user) {
        user.status = decision === "approve" ? "active" : "rejected";
        user.reviewedAt = new Date().toISOString();
        user.reviewedBy = reviewedBy;
        if (decision === "approve" && role) user.role = role;
      }
    },
  };
}

const ADMIN = { id: "admin-id", role: "admin" } as const;

function userRow(id: string, role: Role, status: UserStatus = "active"): User {
  return {
    id,
    authUserId: crypto.randomUUID(),
    name: `User ${id}`,
    email: `${id}@torpreca.gt`,
    role,
    status,
    deactivatedAt: null,
    deactivatedBy: null,
    reviewedAt: null,
    reviewedBy: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

describe("users.service permissions", () => {
  it("admin cannot deactivate a super_admin", async () => {
    const service = createUsersService(createFakeRepo([userRow("sa", "super_admin")]));
    await expect(service.deactivate("sa", ADMIN)).rejects.toThrow("cannot deactivate");
  });

  it("admin cannot deactivate another admin", async () => {
    const service = createUsersService(createFakeRepo([userRow("a2", "admin")]));
    await expect(service.deactivate("a2", ADMIN)).rejects.toThrow("cannot deactivate");
  });

  it("admin can deactivate a supervisor", async () => {
    const repo = createFakeRepo([userRow("s1", "supervisor")]);
    await createUsersService(repo).deactivate("s1", ADMIN);
    expect((await repo.list("all"))[0]?.status).toBe("deactivated");
  });

  it("super_admin can deactivate an admin", async () => {
    const repo = createFakeRepo([userRow("a1", "admin")]);
    await createUsersService(repo).deactivate("a1", { id: "sa", role: "super_admin" });
    expect((await repo.list("all"))[0]?.status).toBe("deactivated");
  });

  it("nobody can deactivate themselves", async () => {
    const service = createUsersService(createFakeRepo([userRow("sa", "super_admin")]));
    await expect(service.deactivate("sa", { id: "sa", role: "super_admin" })).rejects.toThrow(
      "cannot deactivate",
    );
  });

  it("supervisor cannot approve a user as supervisor or admin", async () => {
    const service = createUsersService(createFakeRepo([userRow("p", "driver", "pending")]));
    const supervisor = { id: "sup", role: "supervisor" } as const;
    await expect(service.review("p", "approve", supervisor, "admin")).rejects.toThrow(
      "cannot approve",
    );
    await expect(service.review("p", "approve", supervisor, "supervisor")).rejects.toThrow(
      "cannot approve",
    );
  });

  it("supervisor can approve a user as driver", async () => {
    const service = createUsersService(createFakeRepo([userRow("p", "driver", "pending")]));
    const user = await service.review("p", "approve", { id: "sup", role: "supervisor" }, "driver");
    expect(user.status).toBe("active");
  });

  it("admin cannot approve a user as admin", async () => {
    const service = createUsersService(createFakeRepo([userRow("p", "driver", "pending")]));
    await expect(service.review("p", "approve", ADMIN, "admin")).rejects.toThrow("cannot approve");
  });

  it("super_admin can approve a user as admin", async () => {
    const service = createUsersService(createFakeRepo([userRow("p", "driver", "pending")]));
    const user = await service.review("p", "approve", { id: "sa", role: "super_admin" }, "admin");
    expect(user.role).toBe("admin");
  });
});

describe("users.service", () => {
  it("invite delegates to the repository and lands active", async () => {
    const service = createUsersService(createFakeRepo());
    const user = await service.invite({
      name: "Nueva Supervisora",
      email: "supervisora@torpreca.gt",
      role: "supervisor",
    });

    expect(user).toMatchObject({
      name: "Nueva Supervisora",
      email: "supervisora@torpreca.gt",
      role: "supervisor",
      status: "active",
    });
  });

  it("creates a new user, active by default", async () => {
    const service = createUsersService(createFakeRepo());
    const user = await service.create({
      authUserId: crypto.randomUUID(),
      name: "Juan Pérez",
      email: "juan@torpreca.gt",
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
        email: "juan@torpreca.gt",
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
      service.create({
        authUserId,
        name: "Otro Nombre",
        email: "otro@torpreca.gt",
        role: "supervisor",
      }),
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
        email: "juan@torpreca.gt",
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

    await service.deactivate("1", ADMIN);
    const [user] = await repo.list("all");
    expect(user?.status).toBe("deactivated");
    expect(user?.deactivatedBy).toBe("admin-id");
  });

  it("deactivate closes that user's open WebSocket connections", async () => {
    const authUser: AuthUser = { id: "1", role: "driver", status: "active" };
    const repo = createFakeRepo([
      {
        id: "1",
        authUserId: crypto.randomUUID(),
        name: "Juan Pérez",
        email: "juan@torpreca.gt",
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
    const closed: unknown[] = [];
    const ws: TrackingWs = {
      data: { user: authUser, pingBucket: createRateLimitBucket(10, 10_000) },
      send: () => {},
      subscribe: () => {},
      unsubscribe: () => {},
      close: (code, reason) => closed.push([code, reason]),
    };
    registerConnection(ws);

    await service.deactivate("1", ADMIN);

    expect(closed).toEqual([[4001, "Account deactivated"]]);
  });

  it("updateRole changes an already-active user's role", async () => {
    const repo = createFakeRepo([
      {
        id: "1",
        authUserId: crypto.randomUUID(),
        name: "Juan Pérez",
        email: "juan@torpreca.gt",
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

    const user = await service.updateRole("1", "supervisor");
    expect(user.role).toBe("supervisor");
  });

  it("updateRole throws NotFoundError for a missing id", async () => {
    const service = createUsersService(createFakeRepo());
    await expect(service.updateRole("no-existe", "supervisor")).rejects.toThrow("User not found");
  });

  describe("review", () => {
    function pendingRepo() {
      return createFakeRepo([
        {
          id: "1",
          authUserId: crypto.randomUUID(),
          name: "Driver Nuevo",
          email: "driver-nuevo@torpreca.gt",
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
      const user = await service.review("1", "approve", ADMIN);
      expect(user.status).toBe("active");
      expect(user.reviewedBy).toBe("admin-id");
    });

    it("approve with a role promotes the user to it", async () => {
      const service = createUsersService(pendingRepo());
      const user = await service.review("1", "approve", ADMIN, "supervisor");
      expect(user.role).toBe("supervisor");
    });

    it("reject sets status=rejected", async () => {
      const service = createUsersService(pendingRepo());
      const user = await service.review("1", "reject", ADMIN);
      expect(user.status).toBe("rejected");
    });

    it("rejects reviewing a user that isn't pending", async () => {
      const repo = createFakeRepo([
        {
          id: "1",
          authUserId: crypto.randomUUID(),
          name: "Ya activo",
          email: "ya-activo@torpreca.gt",
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

      await expect(service.review("1", "approve", ADMIN)).rejects.toThrow(
        "User is not pending review",
      );
    });
  });
});
