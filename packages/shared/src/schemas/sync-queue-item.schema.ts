import { z } from "../zod";

export const SyncQueueItemSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  eventType: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  synced: z.boolean(),
  recordedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type SyncQueueItem = z.infer<typeof SyncQueueItemSchema>;

// Shape sent by the mobile app when draining the offline queue via POST /sync.
export const CreateSyncQueueItemSchema = SyncQueueItemSchema.pick({
  eventType: true,
  payload: true,
  recordedAt: true,
});

export type CreateSyncQueueItemInput = z.infer<typeof CreateSyncQueueItemSchema>;
