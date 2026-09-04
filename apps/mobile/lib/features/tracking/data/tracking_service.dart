import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../../../core/api/ws_ticket_client.dart';
import '../../../core/env.dart';

enum TrackingStatus { idle, connecting, tracking, error }

/// Sends periodic GPS pings over `/ws` (apps/backend/src/core/ws/*) while
/// the app is in the foreground. No route assignment exists yet, so
/// `routeId` is always sent as `null` — matches `CreateLocationSchema` in
/// packages/shared, which still requires the key.
///
/// Background tracking (app minimized/closed) is a separate ticket — this
/// only tracks while a screen holding this service stays mounted.
class TrackingService extends ChangeNotifier {
  TrackingService({WsTicketClient? ticketClient})
    : _ticketClient = ticketClient ?? WsTicketClient();

  static const _pingInterval = Duration(seconds: 8);

  final WsTicketClient _ticketClient;

  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _channelSub;
  Timer? _pingTimer;

  TrackingStatus _status = TrackingStatus.idle;
  TrackingStatus get status => _status;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  Future<void> start(String accessToken) async {
    if (_status == TrackingStatus.connecting || _status == TrackingStatus.tracking) {
      return;
    }
    _setStatus(TrackingStatus.connecting);

    try {
      await _ensureLocationPermission();
      final wsTicket = await _ticketClient.requestTicket(accessToken);

      final channel = WebSocketChannel.connect(
        Uri.parse('${Env.backendWsUrl}/ws?ticket=${wsTicket.ticket}'),
      );
      await channel.ready;
      _channel = channel;

      _channelSub = channel.stream.listen(
        (_) {},
        onError: (Object error) => _fail(error.toString()),
        onDone: () {
          if (_status == TrackingStatus.tracking) _fail('Connection closed');
        },
      );

      _pingTimer = Timer.periodic(_pingInterval, (_) => _sendPing());
      _setStatus(TrackingStatus.tracking);
      unawaited(_sendPing());
    } catch (error) {
      _fail(error.toString());
    }
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
    final channel = _channel;
    if (channel == null) return;

    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      channel.sink.add(
        jsonEncode({
          'type': 'location:ping',
          'payload': {
            'routeId': null,
            'lat': position.latitude,
            'lng': position.longitude,
            'speed': position.speed >= 0 ? position.speed : null,
            'recordedAt': position.timestamp.toUtc().toIso8601String(),
          },
        }),
      );
    } catch (error) {
      _fail(error.toString());
    }
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