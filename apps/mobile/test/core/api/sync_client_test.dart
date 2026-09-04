import 'dart:convert';

import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/api/sync_client.dart';
import 'package:mobile/core/offline/sync_queue_item.dart';

void main() {
  setUpAll(() {
    dotenv.testLoad(fileInput: 'BACKEND_URL=http://backend.test');
  });

  final item = SyncQueueItem(
    id: 'local-1',
    eventType: 'location.ping',
    recordedAt: DateTime.utc(2026, 1, 1, 12),
    payload: {'lat': 14.6, 'lng': -90.5},
  );

  test('sync() posts the batch and parses per-item outcomes', () async {
    http.Request? captured;
    final client = MockClient((request) async {
      captured = request;
      return http.Response(
        jsonEncode({
          'results': [
            {'eventType': 'location.ping', 'recordedAt': '2026-01-01T12:00:00.000Z', 'status': 'applied'},
          ],
        }),
        200,
      );
    });

    final outcomes = await SyncClient(client: client).sync('token-1', [item]);

    expect(captured!.url.toString(), 'http://backend.test/api/v1/mobile/sync');
    expect(captured!.headers['Authorization'], 'Bearer token-1');
    final sentBody = jsonDecode(captured!.body) as List<dynamic>;
    expect(sentBody, [
      {'eventType': 'location.ping', 'recordedAt': '2026-01-01T12:00:00.000Z', 'payload': item.payload},
    ]);

    expect(outcomes, hasLength(1));
    expect(outcomes.single.status, 'applied');
    expect(outcomes.single.shouldRetry, isFalse);
  });

  test('an "error" outcome reports shouldRetry true', () async {
    final client = MockClient(
      (_) async => http.Response(
        jsonEncode({
          'results': [
            {
              'eventType': 'location.ping',
              'recordedAt': '2026-01-01T12:00:00.000Z',
              'status': 'error',
              'message': 'boom',
            },
          ],
        }),
        200,
      ),
    );

    final outcomes = await SyncClient(client: client).sync('token-1', [item]);

    expect(outcomes.single.shouldRetry, isTrue);
    expect(outcomes.single.message, 'boom');
  });

  test('a non-200 response throws', () async {
    final client = MockClient((_) async => http.Response('', 401));

    expect(() => SyncClient(client: client).sync('token-1', [item]), throwsStateError);
  });
}