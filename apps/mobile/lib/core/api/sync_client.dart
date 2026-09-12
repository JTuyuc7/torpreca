import 'dart:convert';

import 'package:http/http.dart' as http;

import '../env.dart';
import '../offline/sync_queue_item.dart';

/// Per-item outcome from the backend — mirrors `SyncItemResult`
/// (apps/backend/src/modules/sync-queue/sync-queue.service.ts). Results come
/// back positional (same order/length as the request batch), not keyed by
/// the local queue item's id — the backend never sees that id.
class SyncItemOutcome {
  const SyncItemOutcome({required this.status, this.message});

  factory SyncItemOutcome.fromJson(Map<String, dynamic> json) =>
      SyncItemOutcome(status: json['status'] as String, message: json['message'] as String?);

  final String status; // "applied" | "conflict" | "error"
  final String? message;

  bool get shouldRetry => status == 'error';
}

/// Talks to `POST /api/v1/mobile/sync`
/// (apps/backend/src/modules/sync-queue/sync-queue.routes.ts,
/// `registerMobileSyncQueueRoutes`) — the unsigned counterpart of
/// `POST /api/v1/sync`, same reasoning as `WsTicketClient`/`MobileAuthClient`:
/// Flutter can't hold `REQUEST_SIGNING_SECRET`.
class SyncClient {
  SyncClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  /// Sends [items] in their given order — the backend applies them
  /// sequentially and its per-item results come back in that same order.
  Future<List<SyncItemOutcome>> sync(String accessToken, List<SyncQueueItem> items) async {
    final body = jsonEncode(
      items
          .map(
            (item) => {
              'eventType': item.eventType,
              'recordedAt': item.recordedAt.toUtc().toIso8601String(),
              'payload': item.payload,
            },
          )
          .toList(),
    );

    final res = await _client.post(
      Uri.parse('${Env.backendUrl}/api/v1/mobile/sync'),
      headers: {'Authorization': 'Bearer $accessToken', 'Content-Type': 'application/json'},
      body: body,
    );

    if (res.statusCode != 200) {
      throw StateError('Sync failed: HTTP ${res.statusCode}');
    }

    final decoded = jsonDecode(res.body) as Map<String, dynamic>;
    final results = decoded['results'] as List<dynamic>;
    return results
        .map((r) => SyncItemOutcome.fromJson(r as Map<String, dynamic>))
        .toList(growable: false);
  }
}