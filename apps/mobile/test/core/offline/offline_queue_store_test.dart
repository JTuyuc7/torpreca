import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hive/hive.dart';
import 'package:mobile/core/offline/offline_queue_store.dart';
import 'package:mobile/core/offline/sync_queue_item.dart';

void main() {
  late Directory tempDir;
  late OfflineQueueStore store;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('offline_queue_store_test');
    Hive.init(tempDir.path);
    store = OfflineQueueStore(boxName: 'sync_queue_test');
    await store.init();
  });

  tearDown(() async {
    await Hive.deleteBoxFromDisk('sync_queue_test');
    await tempDir.delete(recursive: true);
  });

  test('enqueue persists an item and pendingCount reflects it', () async {
    expect(store.pendingCount, 0);

    await store.enqueue(
      SyncQueueItem(
        id: 'a',
        eventType: 'location.ping',
        recordedAt: DateTime.utc(2026, 1, 1, 12),
        payload: {'lat': 14.6, 'lng': -90.5},
      ),
    );

    expect(store.pendingCount, 1);
  });

  test('pending() returns items ordered by recordedAt ascending', () async {
    await store.enqueue(
      SyncQueueItem(
        id: 'later',
        eventType: 'location.ping',
        recordedAt: DateTime.utc(2026, 1, 1, 12, 5),
        payload: {'lat': 1.0, 'lng': 1.0},
      ),
    );
    await store.enqueue(
      SyncQueueItem(
        id: 'earlier',
        eventType: 'location.ping',
        recordedAt: DateTime.utc(2026, 1, 1, 12),
        payload: {'lat': 2.0, 'lng': 2.0},
      ),
    );

    final pending = store.pending();

    expect(pending.map((item) => item.id).toList(), ['earlier', 'later']);
  });

  test('a fresh store with no items reports zero pending', () {
    expect(store.pendingCount, 0);
    expect(store.pending(), isEmpty);
  });
}