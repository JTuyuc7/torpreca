import { describe, expect, it, mock } from "bun:test";
import type { AuthUser, Location } from "@torpreca/shared";
import { createRateLimitBucket } from "./rate-limit";
import {
  handleClose,
  handleMessage,
  handleOpen,
  type TrackingHandlerDeps,
  type TrackingWs,
} from "./tracking-handlers";

const user: AuthUser = { id: "driver-1", role: "driver", active: true };

const location: Location = {
  id: "l1",
  driverId: user.id,
  routeId: "11111111-1111-4111-8111-111111111111",
  lat: 14.6,
  lng: -90.5,
  speed: 10,
  recordedAt: new Date().toISOString(),
  synced: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function createFakeWs(): TrackingWs & {
  sent: string[];
  subscribed: string[];
  unsubscribed: string[];
} {
  const sent: string[] = [];
  const subscribed: string[] = [];
  const unsubscribed: string[] = [];
  return {
    data: { user, pingBucket: createRateLimitBucket(10, 10_000) },
    send: (data: string) => {
      sent.push(data);
    },
    subscribe: (topic: string) => {
      subscribed.push(topic);
    },
    unsubscribe: (topic: string) => {
      unsubscribed.push(topic);
    },
    sent,
    subscribed,
    unsubscribed,
  };
}

const validPing = JSON.stringify({
  type: "location:ping",
  payload: {
    routeId: location.routeId,
    lat: 14.6,
    lng: -90.5,
    speed: 10,
    recordedAt: location.recordedAt,
  },
});

describe("tracking-handlers", () => {
  it("handleOpen subscribes to the tracking topic", () => {
    const ws = createFakeWs();
    handleOpen(ws);
    expect(ws.subscribed).toEqual(["tracking"]);
  });

  it("handleClose unsubscribes from the tracking topic", () => {
    const ws = createFakeWs();
    handleClose(ws);
    expect(ws.unsubscribed).toEqual(["tracking"]);
  });

  it("a valid ping records it and broadcasts on the tracking topic", async () => {
    const ws = createFakeWs();
    const recordPing = mock(async () => location);
    const publish = mock((_topic: string, _message: string) => {});
    const deps: TrackingHandlerDeps = { recordPing, publish };

    await handleMessage(ws, validPing, deps);

    expect(recordPing).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      "tracking",
      JSON.stringify({ type: "location:broadcast", payload: location }),
    );
    expect(ws.sent).toEqual([]);
  });

  it("malformed JSON sends an error and skips recordPing/publish", async () => {
    const ws = createFakeWs();
    const recordPing = mock(async () => location);
    const publish = mock((_topic: string, _message: string) => {});

    await handleMessage(ws, "not json", { recordPing, publish });

    expect(recordPing).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(ws.sent).toEqual([JSON.stringify({ type: "error", message: "Invalid JSON" })]);
  });

  it("a schema-invalid payload sends an error and skips recordPing/publish", async () => {
    const ws = createFakeWs();
    const recordPing = mock(async () => location);
    const publish = mock((_topic: string, _message: string) => {});
    const badPing = JSON.stringify({
      type: "location:ping",
      payload: {
        routeId: location.routeId,
        lat: 999,
        lng: -90.5,
        speed: null,
        recordedAt: location.recordedAt,
      },
    });

    await handleMessage(ws, badPing, { recordPing, publish });

    expect(recordPing).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(ws.sent).toEqual([JSON.stringify({ type: "error", message: "Invalid message" })]);
  });

  it("rejects once the connection's rate limit is exceeded", async () => {
    const ws = createFakeWs();
    ws.data.pingBucket = createRateLimitBucket(0, 10_000);
    const recordPing = mock(async () => location);
    const publish = mock((_topic: string, _message: string) => {});

    await handleMessage(ws, validPing, { recordPing, publish });

    expect(recordPing).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
    expect(ws.sent).toEqual([JSON.stringify({ type: "error", message: "Rate limit exceeded" })]);
  });

  it("when recordPing rejects, sends an error back and does not broadcast", async () => {
    const ws = createFakeWs();
    const recordPing = mock(async () => {
      throw new Error("This route belongs to another driver");
    });
    const publish = mock((_topic: string, _message: string) => {});

    await handleMessage(ws, validPing, { recordPing, publish });

    expect(publish).not.toHaveBeenCalled();
    expect(ws.sent).toEqual([
      JSON.stringify({ type: "error", message: "This route belongs to another driver" }),
    ]);
  });
});
