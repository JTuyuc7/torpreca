/// Mirrors one variant of `SyncEventSchema`
/// (packages/shared/src/schemas/sync-event.schema.ts) — the shape the
/// backend's `POST /sync` expects once a future sync ticket drains this
/// queue.
/// Only `location.ping` is produced today (from `TrackingService`); the
/// other event types (`stop.completed`, `route.started`, etc.) will reuse
/// this same envelope once their screens exist.
class SyncQueueItem {
  SyncQueueItem({
    required this.id,
    required this.eventType,
    required this.recordedAt,
    required this.payload,
    this.synced = false,
  });

  factory SyncQueueItem.fromMap(Map<dynamic, dynamic> map) {
    return SyncQueueItem(
      id: map['id'] as String,
      eventType: map['eventType'] as String,
      recordedAt: DateTime.parse(map['recordedAt'] as String),
      payload: Map<String, dynamic>.from(map['payload'] as Map),
      synced: map['synced'] as bool? ?? false,
    );
  }

  final String id;
  final String eventType;
  final DateTime recordedAt;
  final Map<String, dynamic> payload;
  final bool synced;

  Map<String, dynamic> toMap() => {
    'id': id,
    'eventType': eventType,
    'recordedAt': recordedAt.toUtc().toIso8601String(),
    'payload': payload,
    'synced': synced,
  };
}