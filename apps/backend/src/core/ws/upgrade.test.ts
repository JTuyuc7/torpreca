import { describe, expect, it } from "bun:test";
import type { AuthUser } from "@torpreca/shared";
import { mintTicket } from "./ticket-store";
import { resolveUpgradeData } from "./upgrade";

const user: AuthUser = { id: "driver-1", role: "driver", active: true };

describe("resolveUpgradeData", () => {
  it("returns the user + a ping bucket for a valid ticket", () => {
    const { ticket } = mintTicket(user);
    const data = resolveUpgradeData(new Request(`http://x/ws?ticket=${ticket}`));

    expect(data?.user).toEqual(user);
    expect(typeof data?.pingBucket.tryConsume).toBe("function");
  });

  it("returns null when no ticket is present", () => {
    expect(resolveUpgradeData(new Request("http://x/ws"))).toBeNull();
  });

  it("returns null for an unknown ticket", () => {
    expect(resolveUpgradeData(new Request("http://x/ws?ticket=bogus"))).toBeNull();
  });

  it("consumes the ticket — the same one can't be used twice", () => {
    const { ticket } = mintTicket(user);
    const url = `http://x/ws?ticket=${ticket}`;

    expect(resolveUpgradeData(new Request(url))).not.toBeNull();
    expect(resolveUpgradeData(new Request(url))).toBeNull();
  });
});
