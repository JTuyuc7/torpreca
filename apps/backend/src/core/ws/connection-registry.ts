import type { TrackingWs } from "./tracking-handlers";

// In-memory, single-instance registry of open tracking sockets keyed by
// `users.id` (same id core/middleware/auth.ts puts on ctx.user, and the one
// DELETE /users/:id receives). Same single-instance caveat as ticket-store.ts
// and core/middleware/rate-limit.ts — move to Redis pub/sub if this ever
// scales out to more than one backend process.
const connectionsByUserId = new Map<string, Set<TrackingWs>>();

export function registerConnection(ws: TrackingWs): void {
  const userId = ws.data.user.id;
  const existing = connectionsByUserId.get(userId);
  if (existing) {
    existing.add(ws);
    return;
  }
  connectionsByUserId.set(userId, new Set([ws]));
}

export function unregisterConnection(ws: TrackingWs): void {
  const userId = ws.data.user.id;
  const sockets = connectionsByUserId.get(userId);
  if (!sockets) return;
  sockets.delete(ws);
  if (sockets.size === 0) connectionsByUserId.delete(userId);
}

// Called from users.service.ts on deactivate — a REST/mobile request picks up
// status='deactivated' on its next call via the auth middleware, but an
// already-open WebSocket doesn't re-check status on its own, so it has to be
// closed here explicitly.
export function closeConnectionsForUser(userId: string): void {
  const sockets = connectionsByUserId.get(userId);
  if (!sockets) return;
  for (const ws of sockets) ws.close(4001, "Account deactivated");
  connectionsByUserId.delete(userId);
}
