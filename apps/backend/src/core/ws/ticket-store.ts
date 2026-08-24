import type { AuthUser } from "@torpreca/shared";

interface TicketEntry {
  user: AuthUser;
  expiresAt: number;
}

const TICKET_TTL_MS = 30_000;

// In-memory, single-use, short-lived — the JWT never travels in a WS query
// string (would sit in access/proxy logs); this opaque ticket is minted from
// an already-authenticated+signed REST request and redeemed once at the /ws
// upgrade. Fine for a single backend instance — move to Redis if this ever
// scales out (same caveat as core/middleware/rate-limit.ts).
const tickets = new Map<string, TicketEntry>();

export function mintTicket(user: AuthUser): { ticket: string; expiresAt: string } {
  const ticket = crypto.randomUUID();
  const expiresAt = Date.now() + TICKET_TTL_MS;
  tickets.set(ticket, { user, expiresAt });
  return { ticket, expiresAt: new Date(expiresAt).toISOString() };
}

// Single-use: deletes on read regardless of outcome (hit or miss).
export function redeemTicket(ticket: string | null): AuthUser | null {
  if (!ticket) return null;
  const entry = tickets.get(ticket);
  tickets.delete(ticket);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.user;
}
