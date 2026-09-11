import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRoute, listRoutes, updateRoute } from "./routes-client";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

const route = {
  id: "r1",
  code: "R-20260910-01",
  driverId: "driver-1",
  vehicleId: null,
  createdBy: "admin-1",
  date: "2026-09-10",
  status: "pending",
  plannedKm: 10,
  drivenKm: 0,
  startTime: null,
  endTime: null,
  createdAt: "2026-09-10T00:00:00.000Z",
  updatedAt: "2026-09-10T00:00:00.000Z",
};

describe("listRoutes", () => {
  it("returns ok:true with the parsed routes on success", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([route]), { status: 200 }));

    const result = await listRoutes("tok");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/routes",
      expect.objectContaining({ headers: { authorization: "Bearer tok" } }),
    );
    expect(result).toEqual({ ok: true, routes: [route] });
  });

  it("returns ok:false with the response status on failure", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    const result = await listRoutes("tok");

    expect(result).toEqual({ ok: false, status: 500 });
  });

  it("returns ok:false with status 0 instead of throwing on a network error", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const result = await listRoutes("tok");

    expect(result).toEqual({ ok: false, status: 0 });
  });
});

describe("createRoute", () => {
  it("POSTs the input and returns the created route", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(route), { status: 201 }));

    const result = await createRoute("tok", {
      code: "R-20260910-01",
      driverId: "driver-1",
      vehicleId: null,
      date: "2026-09-10",
      plannedKm: 10,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/routes",
      expect.objectContaining({
        method: "POST",
        headers: { authorization: "Bearer tok", "content-type": "application/json" },
        body: JSON.stringify({
          code: "R-20260910-01",
          driverId: "driver-1",
          vehicleId: null,
          date: "2026-09-10",
          plannedKm: 10,
        }),
      }),
    );
    expect(result).toEqual({ ok: true, route });
  });

  it("returns ok:false with the response status on failure", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 400 }));

    const result = await createRoute("tok", {
      code: "R-1",
      driverId: "driver-1",
      vehicleId: null,
      date: "2026-09-10",
      plannedKm: null,
    });

    expect(result).toEqual({ ok: false, status: 400 });
  });
});

describe("updateRoute", () => {
  it("PATCHes the input and returns the updated route", async () => {
    const updated = { ...route, plannedKm: 25 };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(updated), { status: 200 }));

    const result = await updateRoute("tok", "r1", { plannedKm: 25 });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/routes/r1",
      expect.objectContaining({
        method: "PATCH",
        headers: { authorization: "Bearer tok", "content-type": "application/json" },
        body: JSON.stringify({ plannedKm: 25 }),
      }),
    );
    expect(result).toEqual({ ok: true, route: updated });
  });

  it("returns ok:false with the response status on failure", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 409 }));

    const result = await updateRoute("tok", "r1", { plannedKm: 25 });

    expect(result).toEqual({ ok: false, status: 409 });
  });
});