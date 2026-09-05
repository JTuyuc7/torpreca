import { beforeEach, describe, expect, it, vi } from "vitest";
import { listPendingUsers, reviewUser } from "./users-client";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

const user = {
  id: "u2",
  authUserId: "a2",
  name: "Nuevo Driver",
  role: "driver",
  status: "pending",
  deactivatedAt: null,
  deactivatedBy: null,
  reviewedAt: null,
  reviewedBy: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

describe("listPendingUsers", () => {
  it("returns ok:true with the parsed users on success", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([user]), { status: 200 }));

    const result = await listPendingUsers("tok");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/users?status=pending",
      expect.objectContaining({ headers: { authorization: "Bearer tok" } }),
    );
    expect(result).toEqual({ ok: true, users: [user] });
  });

  it("returns ok:false with the response status on failure", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    const result = await listPendingUsers("tok");

    expect(result).toEqual({ ok: false, status: 500 });
  });

  it("returns ok:false with status 0 instead of throwing on a network error", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const result = await listPendingUsers("tok");

    expect(result).toEqual({ ok: false, status: 0 });
  });
});

describe("reviewUser", () => {
  it("PATCHes the decision and returns the reviewed user", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ...user, status: "active" }), { status: 200 }),
    );

    const result = await reviewUser("tok", "u2", "approve");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/users/u2/review",
      expect.objectContaining({
        method: "PATCH",
        headers: { authorization: "Bearer tok", "content-type": "application/json" },
        body: JSON.stringify({ decision: "approve" }),
      }),
    );
    expect(result).toEqual({ ok: true, user: { ...user, status: "active" } });
  });

  it("returns ok:false with the response status on failure", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 409 }));

    const result = await reviewUser("tok", "u2", "reject");

    expect(result).toEqual({ ok: false, status: 409 });
  });
});