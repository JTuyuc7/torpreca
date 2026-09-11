import { beforeEach, describe, expect, it, vi } from "vitest";
import { listActiveVehicles } from "./vehicles-client";

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