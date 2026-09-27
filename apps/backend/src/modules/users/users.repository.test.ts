import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { Row, RpcHandler } from "../../test-support/fake-supabase";
import { createFakeSupabase } from "../../test-support/fake-supabase";

// Mirrors the real Postgres functions this repository calls: `get_users_readable`
// reads (decrypts `name`), `create_user_encrypted` writes (encrypts `name`). The
// fake doesn't encrypt anything — it only has to prove the repository calls the
// right RPC with the right args (including the secret key) and maps the result.
const getUsersReadable: RpcHandler = (tables, args) => {
  expect(args.p_secret_key).toBeTruthy();
  return tables.users ?? [];
};

const createUserEncrypted: RpcHandler = (tables, args) => {
  expect(args.p_secret_key).toBeTruthy();
  const now = new Date().toISOString();
  const row: Row = {
    id: crypto.randomUUID(),
    auth_user_id: args.p_auth_user_id,
    role: args.p_role,
    status: args.p_status ?? "active",
    deactivated_at: null,
    deactivated_by: null,
    reviewed_at: null,
    reviewed_by: null,
    created_at: now,
    updated_at: now,
  };
  tables.users = [...(tables.users ?? []), row];
  return [row];
};

const fake = createFakeSupabase({
  rpcHandlers: { get_users_readable: getUsersReadable, create_user_encrypted: createUserEncrypted },
});
mock.module("../../core/db/supabase", () => ({ supabaseAdmin: fake.client }));

beforeEach(() => {
  fake.reset({ users: [] });
});

describe("usersRepository", () => {
  it("create() calls create_user_encrypted and returns the plaintext name back", async () => {
    const { usersRepository } = await import("./users.repository");

    const user = await usersRepository.create({
      authUserId: "auth-1",
      name: "Juan Pérez",
      email: "juan@torpreca.gt",
      role: "driver",
    });

    expect(user).toMatchObject({
      authUserId: "auth-1",
      name: "Juan Pérez",
      email: "juan@torpreca.gt",
      role: "driver",
      status: "active",
    });
  });

  it("create() with an explicit status passes it through as p_status (self-registration path)", async () => {
    const { usersRepository } = await import("./users.repository");

    const user = await usersRepository.create(
      { authUserId: "auth-2", name: "Driver Nuevo", email: "driver2@torpreca.gt", role: "driver" },
      "pending",
    );

    expect(user.status).toBe("pending");
  });

  it("invite() calls inviteUserByEmail then create_user_encrypted with that auth user id", async () => {
    const { usersRepository } = await import("./users.repository");

    const user = await usersRepository.invite({
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
    expect(fake.authAdmin.invitedUsers).toHaveLength(1);
    expect(fake.authAdmin.invitedUsers[0]).toMatchObject({ email: "supervisora@torpreca.gt" });
    expect(user.authUserId).toBe(fake.authAdmin.invitedUsers[0]!.id);
  });

  it("invite() maps an already-registered email to a 409 AppError", async () => {
    const { usersRepository } = await import("./users.repository");
    fake.authAdmin.inviteUserError = { message: "User already registered" };

    await expect(
      usersRepository.invite({
        name: "Duplicado",
        email: "existente@torpreca.gt",
        role: "admin",
      }),
    ).rejects.toThrow("A user with this email is already registered.");
  });

  it("list() reads through get_users_readable, defaulting to status=active", async () => {
    const { usersRepository } = await import("./users.repository");
    fake.reset({
      users: [
        {
          id: "1",
          auth_user_id: "a1",
          name: "Activo",
          role: "driver",
          status: "active",
          deactivated_at: null,
          deactivated_by: null,
          reviewed_at: null,
          reviewed_by: null,
          created_at: "t",
          updated_at: "t",
        },
        {
          id: "2",
          auth_user_id: "a2",
          name: "Pendiente",
          role: "driver",
          status: "pending",
          deactivated_at: null,
          deactivated_by: null,
          reviewed_at: null,
          reviewed_by: null,
          created_at: "t",
          updated_at: "t",
        },
      ],
    });

    expect((await usersRepository.list()).map((u) => u.id)).toEqual(["1"]);
    expect((await usersRepository.list("pending")).map((u) => u.id)).toEqual(["2"]);
    expect((await usersRepository.list("all")).map((u) => u.id)).toEqual(["1", "2"]);
  });

  it("getByAuthUserId returns null when not found", async () => {
    const { usersRepository } = await import("./users.repository");
    expect(await usersRepository.getByAuthUserId("missing")).toBeNull();
  });

  it("deactivate sets status=deactivated + deactivatedAt/deactivatedBy via a plain update", async () => {
    const { usersRepository } = await import("./users.repository");
    fake.reset({
      users: [
        {
          id: "1",
          auth_user_id: "a1",
          name: "Juan",
          role: "driver",
          status: "active",
          deactivated_at: null,
          deactivated_by: null,
          reviewed_at: null,
          reviewed_by: null,
          created_at: "t",
          updated_at: "t",
        },
      ],
    });

    await usersRepository.deactivate("1", "admin-1");
    expect(fake.tables.users?.[0]).toMatchObject({
      status: "deactivated",
      deactivated_by: "admin-1",
    });
  });

  it("updateRole() changes only the role via a plain update", async () => {
    const { usersRepository } = await import("./users.repository");
    fake.reset({
      users: [
        {
          id: "1",
          auth_user_id: "a1",
          name: "Juan",
          role: "driver",
          status: "active",
          deactivated_at: null,
          deactivated_by: null,
          reviewed_at: null,
          reviewed_by: null,
          created_at: "t",
          updated_at: "t",
        },
      ],
    });

    await usersRepository.updateRole("1", "supervisor");
    expect(fake.tables.users?.[0]).toMatchObject({ role: "supervisor", status: "active" });
  });

  it("review('approve') sets status=active + reviewedAt/reviewedBy", async () => {
    const { usersRepository } = await import("./users.repository");
    fake.reset({
      users: [
        {
          id: "1",
          auth_user_id: "a1",
          name: "Driver",
          role: "driver",
          status: "pending",
          deactivated_at: null,
          deactivated_by: null,
          reviewed_at: null,
          reviewed_by: null,
          created_at: "t",
          updated_at: "t",
        },
      ],
    });

    await usersRepository.review("1", "approve", "admin-1");
    expect(fake.tables.users?.[0]).toMatchObject({ status: "active", reviewed_by: "admin-1" });
  });

  it("review('approve') with a role promotes the user to it", async () => {
    const { usersRepository } = await import("./users.repository");
    fake.reset({
      users: [
        {
          id: "1",
          auth_user_id: "a1",
          name: "Driver",
          role: "driver",
          status: "pending",
          deactivated_at: null,
          deactivated_by: null,
          reviewed_at: null,
          reviewed_by: null,
          created_at: "t",
          updated_at: "t",
        },
      ],
    });

    await usersRepository.review("1", "approve", "admin-1", "supervisor");
    expect(fake.tables.users?.[0]).toMatchObject({ status: "active", role: "supervisor" });
  });

  it("review('reject') sets status=rejected", async () => {
    const { usersRepository } = await import("./users.repository");
    fake.reset({
      users: [
        {
          id: "1",
          auth_user_id: "a1",
          name: "Driver",
          role: "driver",
          status: "pending",
          deactivated_at: null,
          deactivated_by: null,
          reviewed_at: null,
          reviewed_by: null,
          created_at: "t",
          updated_at: "t",
        },
      ],
    });

    await usersRepository.review("1", "reject", "admin-1");
    expect(fake.tables.users?.[0]).toMatchObject({ status: "rejected" });
  });
});
