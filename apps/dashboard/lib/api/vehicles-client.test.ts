import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createVehicle,
  deactivateVehicle,
  listActiveVehicles,
  listAllVehicles,
  updateVehicle,
} from "./vehicles-client";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

const vehicle = {
  id: "v1",
  plate: "P-123ABC",
  model: "NPR",
  capacity: 10,
  category: "truck" as const,
  notes: null,
  active: true,
  createdAt: "2026-09-10T00:00:00.000Z",
  updatedAt: "2026-09-10T00:00:00.000Z",
};

describe("listActiveVehicles", () => {
  it("returns ok:true with the parsed vehicles on success", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([vehicle]), { status: 200 }));

    const result = await listActiveVehicles("tok");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/vehicles",
      expect.objectContaining({ headers: { authorization: "Bearer tok" } }),
    );
    expect(result).toEqual({ ok: true, vehicles: [vehicle] });
  });

  it("returns ok:false with the response status on failure", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    const result = await listActiveVehicles("tok");

    expect(result).toEqual({ ok: false, status: 500 });
  });

  it("returns ok:false with status 0 instead of throwing on a network error", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const result = await listActiveVehicles("tok");

    expect(result).toEqual({ ok: false, status: 0 });
  });
});

describe("listAllVehicles", () => {
  it("requests all=true and returns ok:true with the parsed vehicles", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([vehicle]), { status: 200 }));

    const result = await listAllVehicles("tok");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/vehicles?all=true",
      expect.objectContaining({ headers: { authorization: "Bearer tok" } }),
    );
    expect(result).toEqual({ ok: true, vehicles: [vehicle] });
  });

  it("returns ok:false with the response status on failure", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    const result = await listAllVehicles("tok");

    expect(result).toEqual({ ok: false, status: 500 });
  });
});

describe("createVehicle", () => {
  it("POSTs the input and returns the created vehicle", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(vehicle), { status: 201 }));

    const result = await createVehicle("tok", {
      plate: "P-123ABC",
      model: "NPR",
      capacity: 10,
      category: "truck",
      notes: null,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/vehicles",
      expect.objectContaining({
        method: "POST",
        headers: { authorization: "Bearer tok", "content-type": "application/json" },
        body: JSON.stringify({
          plate: "P-123ABC",
          model: "NPR",
          capacity: 10,
          category: "truck",
          notes: null,
        }),
      }),
    );
    expect(result).toEqual({ ok: true, vehicle });
  });

  it("returns ok:false with the response status on failure", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 409 }));

    const result = await createVehicle("tok", {
      plate: "P-123ABC",
      model: "NPR",
      capacity: null,
      category: "truck",
      notes: null,
    });

    expect(result).toEqual({ ok: false, status: 409 });
  });
});

describe("updateVehicle", () => {
  it("PATCHes the input and returns the updated vehicle", async () => {
    const updated = { ...vehicle, model: "NQR" };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(updated), { status: 200 }));

    const result = await updateVehicle("tok", "v1", { model: "NQR" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/vehicles/v1",
      expect.objectContaining({
        method: "PATCH",
        headers: { authorization: "Bearer tok", "content-type": "application/json" },
        body: JSON.stringify({ model: "NQR" }),
      }),
    );
    expect(result).toEqual({ ok: true, vehicle: updated });
  });

  it("returns ok:false with the response status on failure", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 409 }));

    const result = await updateVehicle("tok", "v1", { plate: "dup" });

    expect(result).toEqual({ ok: false, status: 409 });
  });
});

describe("deactivateVehicle", () => {
  it("DELETEs the vehicle and returns ok:true", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const result = await deactivateVehicle("tok", "v1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/vehicles/v1",
      expect.objectContaining({ method: "DELETE", headers: { authorization: "Bearer tok" } }),
    );
    expect(result).toEqual({ ok: true });
  });

  it("returns ok:false with the response status on failure", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

    const result = await deactivateVehicle("tok", "v1");

    expect(result).toEqual({ ok: false, status: 404 });
  });
});