import { describe, expect, it } from "bun:test";
import { drivenKmFromPings, haversineKm } from "./driven-distance";

describe("haversineKm", () => {
  it("is 0 for the same point", () => {
    expect(haversineKm({ lat: 14.63, lng: -90.51 }, { lat: 14.63, lng: -90.51 })).toBe(0);
  });

  it("measures ~111 km per degree of latitude", () => {
    const km = haversineKm({ lat: 14, lng: -90.5 }, { lat: 15, lng: -90.5 });
    expect(km).toBeGreaterThan(110.5);
    expect(km).toBeLessThan(111.9);
  });
});

describe("drivenKmFromPings", () => {
  it("is 0 with fewer than two pings", () => {
    expect(drivenKmFromPings([])).toBe(0);
    expect(drivenKmFromPings([{ lat: 14.63, lng: -90.51 }])).toBe(0);
  });

  it("sums the segments between consecutive pings", () => {
    // 0.01° of latitude ≈ 1.11 km, twice.
    const km = drivenKmFromPings([
      { lat: 14.63, lng: -90.51 },
      { lat: 14.64, lng: -90.51 },
      { lat: 14.65, lng: -90.51 },
    ]);
    expect(km).toBeCloseTo(2.22, 1);
  });

  it("ignores GPS jitter while parked", () => {
    // ~1 m of drift around the same spot.
    const km = drivenKmFromPings([
      { lat: 14.63, lng: -90.51 },
      { lat: 14.630005, lng: -90.51 },
      { lat: 14.63, lng: -90.510005 },
      { lat: 14.630008, lng: -90.51 },
    ]);
    expect(km).toBe(0);
  });

  it("still accumulates slow real movement past the jitter threshold", () => {
    // Steps of ~4 m each: individually below the threshold, but the anchor
    // stays put until the drift adds up to a real segment.
    const points = Array.from({ length: 20 }, (_, i) => ({
      lat: 14.63 + i * 0.000036,
      lng: -90.51,
    }));
    expect(drivenKmFromPings(points)).toBeGreaterThan(0.05);
  });
});
