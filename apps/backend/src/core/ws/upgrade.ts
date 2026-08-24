import type { AuthUser } from "@torpreca/shared";
import { createRateLimitBucket, type RateLimitBucket } from "./rate-limit";
import { redeemTicket } from "./ticket-store";

export interface TrackingSocketData {
  user: AuthUser;
  pingBucket: RateLimitBucket;
}

// Synchronous — redeemTicket is a pure in-memory lookup, no Supabase
// round-trip needed here (that already happened when the ticket was minted
// via the authenticated+signed POST /api/v1/ws-tickets).
export function resolveUpgradeData(req: Request): TrackingSocketData | null {
  const ticket = new URL(req.url).searchParams.get("ticket");
  const user = redeemTicket(ticket);
  if (!user) return null;
  return { user, pingBucket: createRateLimitBucket(10, 10_000) };
}
