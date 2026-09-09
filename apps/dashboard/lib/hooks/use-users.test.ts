import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withQueryClient } from "@/lib/test-utils/query-client";

vi.mock("@/lib/supabase/access-token", () => ({ getAccessToken: vi.fn(async () => "tok") }));

const listAllUsers = vi.fn();
const createUser = vi.fn();
const deactivateUser = vi.fn();
const reviewUser = vi.fn();
vi.mock("@/lib/api/users-client", () => ({
  listAllUsers: (...args: unknown[]) => listAllUsers(...args),
  createUser: (...args: unknown[]) => createUser(...args),
  deactivateUser: (...args: unknown[]) => deactivateUser(...args),
  reviewUser: (...args: unknown[]) => reviewUser(...args),
}));

import { useUsers } from "./use-users";

const activeUser = {
  id: "user-1",
  authUserId: "auth-1",
  name: "Admin Torpreca",
  email: "admin@torpreca.gt",
  role: "admin",
  status: "active",
  deactivatedAt: null,
  deactivatedBy: null,
  reviewedAt: null,
  reviewedBy: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

beforeEach(() => {
  listAllUsers.mockReset();
  createUser.mockReset();
  deactivateUser.mockReset();
  reviewUser.mockReset();
});

function renderUseUsers() {
  return renderHook(() => useUsers(), { wrapper: ({ children }) => withQueryClient(children) });
}

describe("useUsers", () => {
  it("loads the user list", async () => {
    listAllUsers.mockResolvedValue({ ok: true, users: [activeUser] });

    const { result } = renderUseUsers();

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.users).toEqual([activeUser]));
    expect(result.current.error).toBeNull();
  });

  it("surfaces a load failure as `error`", async () => {
    listAllUsers.mockResolvedValue({ ok: false, status: 500 });

    const { result } = renderUseUsers();

    await waitFor(() => expect(result.current.error).toBe("No se pudieron cargar los usuarios."));
  });

  it("createUser prepends the created user to the cached list on success", async () => {
    listAllUsers.mockResolvedValue({ ok: true, users: [] });
    const newUser = { ...activeUser, id: "user-2", name: "Nuevo Supervisor" };
    createUser.mockResolvedValue({ ok: true, user: newUser });

    const { result } = renderUseUsers();
    await waitFor(() => expect(result.current.users).toEqual([]));

    result.current.createUser.mutate({
      authUserId: "auth-2",
      name: "Nuevo Supervisor",
      email: "supervisor@torpreca.gt",
      role: "supervisor",
    });

    await waitFor(() => expect(result.current.users).toEqual([newUser]));
  });

  it("deactivateUser marks the user as deactivated in the cached list", async () => {
    listAllUsers.mockResolvedValue({ ok: true, users: [activeUser] });
    deactivateUser.mockResolvedValue({ ok: true });

    const { result } = renderUseUsers();
    await waitFor(() => expect(result.current.users).toEqual([activeUser]));

    result.current.deactivateUser.mutate(activeUser.id);

    await waitFor(() =>
      expect(result.current.users).toEqual([{ ...activeUser, status: "deactivated" }]),
    );
  });

  it("reviewUser replaces the reviewed user in the cached list", async () => {
    const pendingUser = { ...activeUser, id: "user-3", status: "pending" as const };
    listAllUsers.mockResolvedValue({ ok: true, users: [pendingUser] });
    const approvedUser = { ...pendingUser, status: "active" as const, role: "supervisor" as const };
    reviewUser.mockResolvedValue({ ok: true, user: approvedUser });

    const { result } = renderUseUsers();
    await waitFor(() => expect(result.current.users).toEqual([pendingUser]));

    result.current.reviewUser.mutate({ id: pendingUser.id, decision: "approve", role: "supervisor" });

    await waitFor(() => expect(result.current.users).toEqual([approvedUser]));
    expect(reviewUser).toHaveBeenCalledWith("tok", pendingUser.id, "approve", "supervisor");
  });
});