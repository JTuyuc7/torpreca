import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDashboardSummary, getLatestLocations, mintWsTicket } from "./dashboard-client";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

const summary = {
  routesInProgress: 2,
  routesPendingToday: 1,
  vehiclesActive: 5,
  driversActive: 4,
  driversOnline: 3,
};

describe("getDashboardSummary", () => {
  it("returns ok:true with the parsed summary on success", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(summary), { status: 200 }));

    const result = await getDashboardSummary("tok");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/dashboard/summary",
      expect.objectContaining({ headers: { authorization: "Bearer tok" } }),
    );
    expect(result).toEqual({ ok: true, summary });
  });

  it("returns ok:false with the status on failure", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));

    const result = await getDashboardSummary("tok");

    expect(result).toEqual({ ok: false, status: 403 });
  });

  it("returns ok:false, status:0 when fetch throws", async () => {
    fetchMock.mockRejectedValue(new Error("network"));

    const result = await getDashboardSummary("tok");

    expect(result).toEqual({ ok: false, status: 0 });
  });
});

describe("getLatestLocations", () => {
  it("returns ok:true with the parsed locations on success", async () => {
    const location = {
      id: "l1",
      driverId: "d1",
      routeId: null,
      lat: 14.6,
      lng: -90.5,
      speed: null,
      recordedAt: "2026-09-12T00:00:00.000Z",
      synced: true,
      createdAt: "t",
      updatedAt: "t",
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify([location]), { status: 200 }));

    const result = await getLatestLocations("tok");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/locations/latest",
      expect.objectContaining({ headers: { authorization: "Bearer tok" } }),
    );
    expect(result).toEqual({ ok: true, locations: [location] });
  });
});

describe("mintWsTicket", () => {
  it("returns ok:true with the ticket on success", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ticket: "abc", expiresAt: "2026-09-12T00:00:30.000Z" }), {
        status: 200,
      }),
    );

    const result = await mintWsTicket("tok");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ws-tickets",
      expect.objectContaining({ method: "POST", headers: { authorization: "Bearer tok" } }),
    );
    expect(result).toEqual({ ok: true, ticket: "abc" });
  });

  it("returns ok:false with the status on failure", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    const result = await mintWsTicket("tok");

    expect(result).toEqual({ ok: false, status: 401 });
  });
});