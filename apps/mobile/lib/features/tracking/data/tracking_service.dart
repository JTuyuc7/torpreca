import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:uuid/uuid.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../../../core/api/sync_client.dart';
import '../../../core/api/ws_ticket_client.dart';
import '../../../core/env.dart';
import '../../../core/offline/offline_queue_store.dart';
import '../../../core/offline/sync_queue_item.dart';

enum TrackingStatus { idle, connecting, tracking, error }

/// Sends periodic GPS pings over `/ws` (apps/backend/src/core/ws/*) while
/// the app is in the foreground. No route assignment exists yet, so
/// `routeId` is always sent as `null` — matches `CreateLocationSchema` in
/// packages/shared, which still requires the key.
///
/// Offline-first (PG1 requirement): if the socket isn't connected when a
/// ping is due (never connected, or dropped mid-session), the ping is
/// queued locally via [OfflineQueueStore] with `synced: false` instead of
/// being dropped. `status` stays `tracking` through a connection loss —
/// only a fatal error (GPS permission/services, or the initial connect)
/// moves it to `error`. Every time the socket connects (including the
/// first time), the queue is drained via `POST /mobile/sync` — there's no
/// background/periodic retry beyond that, so a queue built up during a long
/// offline stretch clears out the next time the user restarts tracking
/// with a connection available.
///
/// Background tracking (app minimized/closed) is a separate ticket — this
/// only tracks while a screen holding this service stays mounted.
class TrackingService extends ChangeNotifier {
  TrackingService({
    WsTicketClient? ticketClient,
    SyncClient? syncClient,
    OfflineQueueStore? queueStore,
    Uuid? uuid,
  }) : _ticketClient = ticketClient ?? WsTicketClient(),
       _syncClient = syncClient ?? SyncClient(),
       _queueStore = queueStore ?? OfflineQueueStore(),
       _uuid = uuid ?? const Uuid();

  static const _pingInterval = Duration(seconds: 8);

  final WsTicketClient _ticketClient;
  final SyncClient _syncClient;
  final OfflineQueueStore _queueStore;
  final Uuid _uuid;
  bool _queueReady = false;
  bool _draining = false;

  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _channelSub;
  Timer? _pingTimer;

  TrackingStatus _status = TrackingStatus.idle;
  TrackingStatus get status => _status;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  int get pendingCount => _queueReady ? _queueStore.pendingCount : 0;

  Future<void> start(String accessToken) async {
    if (_status == TrackingStatus.connecting || _status == TrackingStatus.tracking) {
      return;
    }
    _setStatus(TrackingStatus.connecting);

    try {
      await _ensureQueueReady();
      await _ensureLocationPermission();
      await _connectSocket(accessToken);

      _pingTimer = Timer.periodic(_pingInterval, (_) => _sendPing());
      _setStatus(TrackingStatus.tracking);
      unawaited(_sendPing());
      unawaited(_drainOfflineQueue(accessToken));
    } catch (error) {
      _fail(error.toString());
    }
  }

  Future<void> _connectSocket(String accessToken) async {
    final wsTicket = await _ticketClient.requestTicket(accessToken);
    final channel = WebSocketChannel.connect(
      Uri.parse('${Env.backendWsUrl}/ws?ticket=${wsTicket.ticket}'),
    );
    await channel.ready;
    _channel = channel;
    _channelSub = channel.stream.listen(
      (_) {},
      onError: (Object _) => _handleConnectionLost(),
      onDone: _handleConnectionLost,
    );
  }

  /// The socket dropped mid-session (network loss, backend restart, etc).
  /// Deliberately does *not* call [_fail] — tracking stays "active" and
  /// subsequent pings fall back to the offline queue in [_sendPing] until
  /// the user restarts tracking. No auto-reconnect here (out of scope for
  /// this ticket — see the class doc comment).
  void _handleConnectionLost() {
    if (_channel == null) return;
    _channelSub?.cancel();
    _channelSub = null;
    _channel = null;
    notifyListeners();
  }

  Future<void> stop() async {
    _pingTimer?.cancel();
    _pingTimer = null;
    await _channelSub?.cancel();
    _channelSub = null;
    await _channel?.sink.close();
    _channel = null;
    _setStatus(TrackingStatus.idle);
  }

  Future<void> _sendPing() async {
    final Position position;
    try {
      position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
    } catch (error) {
      // A GPS read failure is fatal (permission revoked, services turned
      // off mid-session) — unlike a dropped socket, there's nothing to
      // queue, so this does stop tracking.
      _fail(error.toString());
      return;
    }

    final payload = {
      'routeId': null,
      'lat': position.latitude,
      'lng': position.longitude,
      'speed': position.speed >= 0 ? position.speed : null,
      'recordedAt': position.timestamp.toUtc().toIso8601String(),
    };

    if (!_trySendLive(payload)) {
      await _queueStore.enqueue(
        SyncQueueItem(
          id: _uuid.v4(),
          eventType: 'location.ping',
          recordedAt: position.timestamp,
          payload: payload,
        ),
      );
      notifyListeners();
    }
  }

  /// Sends every currently-queued item to `POST /mobile/sync` and drops
  /// the ones the backend confirms it applied (or already had — see
  /// `SyncItemOutcome.shouldRetry`). A network failure here just leaves the
  /// queue untouched for the next connect; it doesn't affect `status` or
  /// stop live pinging.
  Future<void> _drainOfflineQueue(String accessToken) async {
    if (_draining) return;
    final items = _queueStore.pending();
    if (items.isEmpty) return;

    _draining = true;
    try {
      final outcomes = await _syncClient.sync(accessToken, items);
      for (var i = 0; i < outcomes.length && i < items.length; i++) {
        if (!outcomes[i].shouldRetry) {
          await _queueStore.remove(items[i].id);
        }
      }
      notifyListeners();
    } catch (_) {
      // Still offline, or the backend rejected the batch — retry on the
      // next successful connect.
    } finally {
      _draining = false;
    }
  }

  bool _trySendLive(Map<String, dynamic> payload) {
    final channel = _channel;
    if (channel == null) return false;
    try {
      channel.sink.add(jsonEncode({'type': 'location:ping', 'payload': payload}));
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> _ensureQueueReady() async {
    if (_queueReady) return;
    await _queueStore.init();
    _queueReady = true;
  }

  Future<void> _ensureLocationPermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw StateError('Location services are disabled');
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw StateError('Location permission denied');
    }
  }

  void _fail(String message) {
    _pingTimer?.cancel();
    _pingTimer = null;
    _channelSub?.cancel();
    _channelSub = null;
    _channel?.sink.close();
    _channel = null;
    _errorMessage = message;
    _setStatus(TrackingStatus.error);
  }

  void _setStatus(TrackingStatus status) {
    _status = status;
    if (status != TrackingStatus.error) _errorMessage = null;
    notifyListeners();
  }

  @override
  void dispose() {
    stop();
    super.dispose();
  }
}