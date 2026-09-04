import 'dart:convert';

import 'package:http/http.dart' as http;

import '../env.dart';

/// A short-lived, single-use ticket minted by the backend to authenticate
/// the `/ws` handshake (which can't carry an `Authorization` header).
class WsTicket {
  const WsTicket({required this.ticket, required this.expiresAt});

  final String ticket;
  final DateTime expiresAt;
}

/// Talks to `POST /api/v1/mobile/ws-tickets`
/// (apps/backend/src/modules/ws-tickets/ws-tickets.routes.ts,
/// `registerMobileWsTicketsRoutes`) — the unsigned counterpart of
/// `POST /api/v1/ws-tickets` used by the dashboard's signed BFF. Flutter
/// can't hold `REQUEST_SIGNING_SECRET`, so this route is authenticated by
/// the Supabase JWT + `requireRole("driver")` only, same as
/// `MobileAuthClient`.
class WsTicketClient {
  WsTicketClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Future<WsTicket> requestTicket(String accessToken) async {
    final res = await _client.post(
      Uri.parse('${Env.backendUrl}/api/v1/mobile/ws-tickets'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );

    if (res.statusCode != 200) {
      throw StateError('Failed to mint WS ticket: HTTP ${res.statusCode}');
    }

    final body = jsonDecode(res.body) as Map<String, dynamic>;
    return WsTicket(
      ticket: body['ticket'] as String,
      expiresAt: DateTime.parse(body['expiresAt'] as String),
    );
  }
}