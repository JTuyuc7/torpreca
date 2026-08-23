import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createFakeSupabase } from "../../test-support/fake-supabase";

const fake = createFakeSupabase({ insertDefaults: { stops: { status: "pending" } } });
mock.module("../../core/db/supabase", () => ({ supabaseAdmin: fake.client }));

const BASE_ROW = {
  id: "s1",
  route_id: "r1",
  order_index: 1,
  customer_name: "Cliente",
  address: "Calle 1",
  lat: 14.6,
  lng: -90.5,
  instructions: null,
  status: "pending",
  estimated_time: null,
  completed_time: null,
  created_at: "t",
  updated_at: "t",
};

beforeEach(() => {
  fake.reset({ stops: [] });
});

describe("stopsRepository", () => {
  it("listByRoute maps rows ordered by order_index", async () => {
    const { stopsRepository } = await import("./stops.repository");
    fake.reset({
      stops: [
        { ...BASE_ROW, id: "s2", order_index: 2 },
        { ...BASE_ROW, id: "s1", order_index: 1 },
      ],
    });

    const stops = await stopsRepository.listByRoute("r1");
    expect(stops.map((s) => s.id)).toEqual(["s1", "s2"]);
  });

  it("create() applies the pending default", async () => {
    const { stopsRepository } = await import("./stops.repository");

    const stop = await stopsRepository.create({
      routeId: "r1",
      order: 1,
      customerName: "Cliente",
      address: "Calle 1",
      lat: 14.6,
      lng: -90.5,
      instructions: null,
    });

    expect(stop).toMatchObject({ routeId: "r1", customerName: "Cliente", status: "pending" });
  });

  it("complete() only succeeds when not already completed", async () => {
    const { stopsRepository } = await import("./stops.repository");
    fake.reset({ stops: [BASE_ROW] });

    const completed = await stopsRepository.complete("s1");
    expect(completed?.status).toBe("completed");

    const alreadyCompleted = await stopsRepository.complete("s1");
    expect(alreadyCompleted).toBeNull();
  });

  it("delay() only succeeds when not already completed", async () => {
    const { stopsRepository } = await import("./stops.repository");
    fake.reset({ stops: [{ ...BASE_ROW, status: "completed" }] });

    expect(await stopsRepository.delay("s1")).toBeNull();
  });
});
