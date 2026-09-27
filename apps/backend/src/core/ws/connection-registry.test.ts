import { describe, expect, it } from "bun:test";
import type { AuthUser } from "@torpreca/shared";
import {
  closeConnectionsForUser,
  registerConnection,
  unregisterConnection,
} from "./connection-registry";
import { createRateLimitBucket } from "./rate-limit";
import type { TrackingWs } from "./tracking-handlers";

function fakeWs(user: AuthUser): TrackingWs & { closed: [number, string][] } {
  const closed: [number, string][] = [];
  return {
    data: { user, pingBucket: createRateLimitBucket(10, 10_000) },
    send: () => {},
    subscribe: () => {},
    unsubscribe: () => {},
    close: (code = 0, reason = "") => {
      closed.push([code, reason]);
    },
    closed,
  };
}

// Unique ids per test — connectionsByUserId is a module-level singleton, so
// reusing an id across tests would leak sockets between them.
describe("connection-registry", () => {
  it("closes every open socket registered for a user", () => {
    const user: AuthUser = { id: "user-close-1", role: "driver", status: "active" };
    const wsA = fakeWs(user);
    const wsB = fakeWs(user);
    registerConnection(wsA);
    registerConnection(wsB);

    closeConnectionsForUser(user.id);

    expect(wsA.closed).toEqual([[4001, "Account deactivated"]]);
    expect(wsB.closed).toEqual([[4001, "Account deactivated"]]);
  });

  it("does nothing for a user with no open sockets", () => {
    expect(() => closeConnectionsForUser("no-connections")).not.toThrow();
  });

  it("a socket removed via unregisterConnection is no longer closed", () => {
    const user: AuthUser = { id: "user-close-2", role: "driver", status: "active" };
    const ws = fakeWs(user);
    registerConnection(ws);
    unregisterConnection(ws);

    closeConnectionsForUser(user.id);

    expect(ws.closed).toEqual([]);
  });

  it("closing doesn't affect another user's sockets", () => {
    const userA: AuthUser = { id: "user-close-3a", role: "driver", status: "active" };
    const userB: AuthUser = { id: "user-close-3b", role: "driver", status: "active" };
    const wsA = fakeWs(userA);
    const wsB = fakeWs(userB);
    registerConnection(wsA);
    registerConnection(wsB);

    closeConnectionsForUser(userA.id);

    expect(wsA.closed).toEqual([[4001, "Account deactivated"]]);
    expect(wsB.closed).toEqual([]);
  });
});
