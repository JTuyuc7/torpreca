import type { AuthUser, SyncEvent } from "@torpreca/shared";
import { logEvent } from "../../core/audit/log-event";
import { AppError } from "../../core/errors/app-error";
import type { LocationsService } from "../locations/locations.service";
import type { RoutesService } from "../routes/routes.service";
import type { StopsService } from "../stops/stops.service";
import type { SyncQueueRepository } from "./sync-queue.repository";

export type SyncOutcomeStatus = "applied" | "conflict" | "error";

export interface SyncItemResult {
  eventType: SyncEvent["eventType"];
  recordedAt: string;
  status: SyncOutcomeStatus;
  message?: string;
}

// Implicit contract with stops.service.ts/routes.service.ts: both use 409
// exclusively for "this event was already applied" (idempotency). If either
// service ever adds a 409 with a different meaning, revisit this check too.
function isIdempotencyConflict(err: unknown): err is AppError {
  return err instanceof AppError && err.status === 409;
}

// Takes the three domain services as dependencies (not their repositories) —
// it dispatches to the exact same business logic the direct REST endpoints
// use, so a synced action is indistinguishable from one applied live.
export function createSyncQueueService(
  repo: SyncQueueRepository,
  locationsService: LocationsService,
  stopsService: StopsService,
  routesService: RoutesService,
) {
  async function applyOne(
    event: SyncEvent,
    user: AuthUser,
    ip: string | null,
  ): Promise<SyncItemResult> {
    try {
      switch (event.eventType) {
        case "location.ping":
          // A second ingestion path alongside /ws, on purpose: /ws is for
          // live pings, /sync is for pings recorded offline and backfilled
          // in a batch on reconnect. Doesn't contradict the "no parallel
          // POST /locations" note in locations.routes.ts — that's about a
          // live-duplicate REST endpoint, not this backfill path.
          await locationsService.recordPing(event.payload, user);
          break; // no audit event of its own — same decision as the /ws path

        case "stop.completed": {
          const stop = await stopsService.complete(event.payload.stopId, user);
          await logEvent({
            userId: user.id,
            role: user.role,
            action: "stop.completed",
            entity: "stops",
            entityId: stop.id,
            ip,
            metadata: null,
          });
          break;
        }

        case "stop.delayed": {
          const stop = await stopsService.delay(event.payload.stopId, user);
          await logEvent({
            userId: user.id,
            role: user.role,
            action: "stop.delayed",
            entity: "stops",
            entityId: stop.id,
            ip,
            metadata: null,
          });
          break;
        }

        case "route.started": {
          const route = await routesService.start(event.payload.routeId, user.id);
          await logEvent({
            userId: user.id,
            role: user.role,
            action: "route.started",
            entity: "routes",
            entityId: route.id,
            ip,
            metadata: null,
          });
          break;
        }

        case "route.finished": {
          const route = await routesService.finish(
            event.payload.routeId,
            user.id,
            event.payload.drivenKm,
          );
          await logEvent({
            userId: user.id,
            role: user.role,
            action: "route.finished",
            entity: "routes",
            entityId: route.id,
            ip,
            metadata: null,
          });
          break;
        }
      }

      const row = await repo.record({
        userId: user.id,
        eventType: event.eventType,
        payload: event.payload,
        recordedAt: event.recordedAt,
        synced: true,
      });
      await logEvent({
        userId: user.id,
        role: user.role,
        action: "sync.completed",
        entity: "sync_queue",
        entityId: row.id,
        ip,
        metadata: { eventType: event.eventType, outcome: "applied" },
      });
      return { eventType: event.eventType, recordedAt: event.recordedAt, status: "applied" };
    } catch (err) {
      if (isIdempotencyConflict(err)) {
        // synced:true here too — the target state already exists, retrying
        // won't change anything. synced:false would leave the app retrying
        // something that will never stop "failing".
        const row = await repo.record({
          userId: user.id,
          eventType: event.eventType,
          payload: event.payload,
          recordedAt: event.recordedAt,
          synced: true,
        });
        await logEvent({
          userId: user.id,
          role: user.role,
          action: "sync.completed",
          entity: "sync_queue",
          entityId: row.id,
          ip,
          metadata: { eventType: event.eventType, outcome: "conflict", message: err.message },
        });
        return {
          eventType: event.eventType,
          recordedAt: event.recordedAt,
          status: "conflict",
          message: err.message,
        };
      }

      // Unexpected failure (a real 403/404, a transient DB error, etc.): no
      // sync_queue row is written — we don't yet know if this is transient
      // or permanent. The client keeps the event in its local queue and
      // retries on the next POST /sync; there's nothing good to record here.
      const message = err instanceof Error ? err.message : "Unknown error";
      return { eventType: event.eventType, recordedAt: event.recordedAt, status: "error", message };
    }
  }

  return {
    async drain(events: SyncEvent[], user: AuthUser, ip: string | null): Promise<SyncItemResult[]> {
      const results: SyncItemResult[] = [];
      // Sequential, not Promise.all — preserves the client's queue order and
      // avoids any cross-item race within a single batch.
      for (const event of events) {
        results.push(await applyOne(event, user, ip));
      }
      return results;
    },
  };
}

export type SyncQueueService = ReturnType<typeof createSyncQueueService>;
