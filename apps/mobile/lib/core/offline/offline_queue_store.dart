import 'package:hive_flutter/hive_flutter.dart';

import 'sync_queue_item.dart';

/// Local-first queue for driver actions recorded while offline (PG1 survey
/// requirement — see Notion backlog "Guardado local offline"). Backed by a
/// raw Hive box (no generated TypeAdapter needed — every item round-trips
/// through plain `Map`s, matching the JSON shape `POST /sync` expects) so
/// draining it later (a separate ticket) is a straight read + HTTP call.
///
/// Storage only — nothing in this class talks to the network. Items stay
/// `synced: false` until a future sync ticket drains and marks/removes them.
class OfflineQueueStore {
  OfflineQueueStore({this.boxName = 'sync_queue'});

  final String boxName;
  Box<Map>? _box;

  Future<void> init() async {
    _box = await Hive.openBox<Map>(boxName);
  }

  Box<Map> get _requireBox {
    final box = _box;
    if (box == null) {
      throw StateError('OfflineQueueStore.init() must be called before use');
    }
    return box;
  }

  Future<void> enqueue(SyncQueueItem item) {
    return _requireBox.put(item.id, item.toMap());
  }

  /// Drops an item once the backend confirms it's been applied (or was
  /// already applied — `SyncItemOutcome.status == "conflict"` also counts,
  /// see `SyncClient`). An "error" outcome is *not* removed — it stays
  /// queued for the next sync attempt.
  Future<void> remove(String id) {
    return _requireBox.delete(id);
  }

  /// Pending (unsynced) items, oldest `recordedAt` first — the order the
  /// backend needs to replay them in once a sync ticket sends this batch.
  List<SyncQueueItem> pending() {
    final items = _requireBox.values
        .map((raw) => SyncQueueItem.fromMap(raw))
        .where((item) => !item.synced)
        .toList()
      ..sort((a, b) => a.recordedAt.compareTo(b.recordedAt));
    return items;
  }

  int get pendingCount => _requireBox.values.where((raw) => raw['synced'] != true).length;
}