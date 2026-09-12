import { describe, expect, it } from "bun:test";
import type { AuthUser } from "@torpreca/shared";
import { mintTicket, redeemTicket } from "./ticket-store";

const user: AuthUser = { id: "driver-1", role: "driver", status: "active" };

describe("ticket-store", () => {
  it("mints a ticket that redeems back to the same user", () => {
    const { ticket } = mintTicket(user);
    expect(redeemTicket(ticket)).toEqual(user);
  });

  it("is single-use — redeeming the same ticket twice returns null the second time", () => {
    const { ticket } = mintTicket(user);
    redeemTicket(ticket);
    expect(redeemTicket(ticket)).toBeNull();
  });

  it("returns null for an unknown ticket", () => {
    expect(redeemTicket("does-not-exist")).toBeNull();
  });

  it("returns null when no ticket is provided", () => {
    expect(redeemTicket(null)).toBeNull();
  });
});
