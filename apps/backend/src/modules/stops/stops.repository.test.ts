import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { Row, RpcHandler } from "../../test-support/fake-supabase";
import { createFakeSupabase } from "../../test-support/fake-supabase";

// Mirrors the real Postgres functions this repository calls — see
// users.repository.test.ts for why the fake doesn't actually encrypt/decrypt,
// it only has to prove the repository calls the right RPC with the right args.
const getStopsReadable: RpcHandler = (tables, args) => {
  expect(args.p_secret_key).toBeTruthy();
  return tables.stops ?? [];
};

const createStopEncrypted: RpcHandler = (tables, args) => {
  expect(args.p_secret_key).toBeTruthy();
  const now = new Date().toISOString();
  const row: Row = {
    id: crypto.randomUUID(),
    route_id: args.p_route_id,
    order_index: args.p_order_index,
    customer_name: args.p_customer_name,
    address: args.p_address,
    lat: args.p_lat,
    lng: args.p_lng,
    instructions: args.p_instructions,
    status: "pending",
    estimated_time: null,
    completed_time: null,
    created_at: now,
    updated_at: now,
  };
  tables.stops = [...(tables.stops ?? []), row];
  // The real RETURNING clause excludes customer_name/address (the repository
  // fills those back in from the input it just encrypted) — drop them here too.
  const { customer_name, address, ...returned } = row;
  return [returned];
};

function updateGuarded(tables: Record<string, Row[]>, args: Record<string, unknown>, patch: Row) {
  const row = (tables.stops ?? []).find((r) => r.id === args.p_id && r.status !== "completed");
  if (!row) return [];
  Object.assign(row, patch, { updated_at: new Date().toISOString() });
  return [row];
}

const completeStopEncrypted: RpcHandler = (tables, args) => {
  expect(args.p_secret_key).toBeTruthy();
  return updateGuarded(tables, args, {
    status: "completed",
    completed_time: new Date().toISOString(),
  });
};

const delayStopEncrypted: RpcHandler = (tables, args) => {
  expect(args.p_secret_key).toBeTruthy();
  return updateGuarded(tables, args, { status: "delayed" });
};

const fake = createFakeSupabase({
  rpcHandlers: {
    get_stops_readable: getStopsReadable,
    create_stop_encrypted: createStopEncrypted,
    complete_stop_encrypted: completeStopEncrypted,
    delay_stop_encrypted: delayStopEncrypted,
  },
});
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

  it("create() applies the pending default and returns the plaintext fields back", async () => {
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

    expect(stop).toMatchObject({
      routeId: "r1",
      customerName: "Cliente",
      address: "Calle 1",
      status: "pending",
    });
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
