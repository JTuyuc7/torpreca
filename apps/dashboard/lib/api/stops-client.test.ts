import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStop, deleteStop, listStops, reorderStops, updateStop } from "./stops-client";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

const stop = {
  id: "s1",
  routeId: "r1",
  order: 1,
  customerName: "Cliente",
  address: "Zona 1",
  lat: 14.6,
  lng: -90.5,
  instructions: null,
  status: "pending",
  estimatedTime: null,
  completedTime: null,
  createdAt: "2026-09-24T00:00:00.000Z",
  updatedAt: "2026-09-24T00:00:00.000Z",
};

const body = { customerName: "Cliente", address: "Zona 1", lat: 14.6, lng: -90.5, instructions: null };

describe("listStops", () => {
  it("returns the stops of the route", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([stop]), { status: 200 }));

    expect(await listStops("r1")).toEqual({ ok: true, stops: [stop] });
    expect(fetchMock).toHaveBeenCalledWith("/api/routes/r1/stops");
  });

  it("returns ok:false with the status on failure and status 0 on a network error", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
    expect(await listStops("r1")).toEqual({ ok: false, status: 403 });

    fetchMock.mockRejectedValueOnce(new Error("down"));
    expect(await listStops("r1")).toEqual({ ok: false, status: 0 });
  });
});

describe("createStop", () => {
  it("POSTs the body to the route's stops and returns the created stop", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(stop), { status: 201 }));

    expect(await createStop("r1", body)).toEqual({ ok: true, stop });
    expect(fetchMock).toHaveBeenCalledWith("/api/routes/r1/stops", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  });

  it("surfaces a 409 (route no longer pending)", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 409 }));
    expect(await createStop("r1", body)).toEqual({ ok: false, status: 409 });
  });
});

describe("updateStop", () => {
  it("PATCHes /api/stops/:id and returns the updated stop", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(stop), { status: 200 }));

    expect(await updateStop("s1", body)).toEqual({ ok: true, stop });
    expect(fetchMock).toHaveBeenCalledWith("/api/stops/s1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  });
});

describe("deleteStop", () => {
  it("DELETEs /api/stops/:id and treats 204 as success", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    expect(await deleteStop("s1")).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/stops/s1", { method: "DELETE" });
  });

  it("returns ok:false with the status on failure", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
    expect(await deleteStop("s1")).toEqual({ ok: false, status: 404 });
  });
});

describe("reorderStops", () => {
  it("PATCHes the new order and returns the stops", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([stop]), { status: 200 }));

    expect(await reorderStops("r1", ["s1"])).toEqual({ ok: true, stops: [stop] });
    expect(fetchMock).toHaveBeenCalledWith("/api/routes/r1/stops/order", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stopIds: ["s1"] }),
    });
  });
});
