import type { SyncEvent, SyncQueueItem } from "@torpreca/shared";
import { supabaseAdmin } from "../../core/db/supabase";

function toSyncQueueItem(row: Record<string, unknown>): SyncQueueItem {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    eventType: row.event_type as string,
    payload: row.payload as Record<string, unknown>,
    synced: row.synced as boolean,
    recordedAt: row.recorded_at as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export interface RecordSyncQueueItemInput {
  userId: string;
  eventType: SyncEvent["eventType"];
  payload: Record<string, unknown>;
  recordedAt: string;
  synced: boolean;
}

export interface SyncQueueRepository {
  record(input: RecordSyncQueueItemInput): Promise<SyncQueueItem>;
}

// No RPCs, no PII — payload is stored as-is (jsonb column).
export const syncQueueRepository: SyncQueueRepository = {
  async record(input) {
    const { data, error } = await supabaseAdmin
      .from("sync_queue")
      .insert({
        user_id: input.userId,
        event_type: input.eventType,
        payload: input.payload,
        synced: input.synced,
        recorded_at: input.recordedAt,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toSyncQueueItem(data);
  },
};
