import { z } from "../zod";
import { CreateLocationSchema } from "./location.schema";
import { FinishRouteSchema } from "./route.schema";

const baseEvent = { recordedAt: z.iso.datetime() };

// Driver's app queues these locally (SQLite/Hive) while offline, then drains
// them in a batch via POST /sync when it reconnects. One variant per
// offline-capable driver action — reuses the same field schemas the direct
// REST endpoints already validate against, so a queued event and a live
// request are held to the same shape.
export const LocationPingEventSchema = z.object({
  ...baseEvent,
  eventType: z.literal("location.ping"),
  payload: CreateLocationSchema,
});

export const StopCompletedEventSchema = z.object({
  ...baseEvent,
  eventType: z.literal("stop.completed"),
  payload: z.object({ stopId: z.uuid() }),
});

export const StopDelayedEventSchema = z.object({
  ...baseEvent,
  eventType: z.literal("stop.delayed"),
  payload: z.object({ stopId: z.uuid() }),
});

export const RouteStartedEventSchema = z.object({
  ...baseEvent,
  eventType: z.literal("route.started"),
  payload: z.object({ routeId: z.uuid() }),
});

export const RouteFinishedEventSchema = z.object({
  ...baseEvent,
  eventType: z.literal("route.finished"),
  payload: z.object({ routeId: z.uuid() }).extend(FinishRouteSchema.shape),
});

export const SyncEventSchema = z.discriminatedUnion("eventType", [
  LocationPingEventSchema,
  StopCompletedEventSchema,
  StopDelayedEventSchema,
  RouteStartedEventSchema,
  RouteFinishedEventSchema,
]);

export type SyncEvent = z.infer<typeof SyncEventSchema>;

// 500 is a placeholder ceiling, not a measured limit — no real mobile ping
// interval exists yet to size this precisely against a plausible offline
// duration. Tune once the Flutter app defines its queuing cadence.
export const SyncBatchSchema = z.array(SyncEventSchema).min(1).max(500);

export type SyncBatchInput = z.infer<typeof SyncBatchSchema>;
