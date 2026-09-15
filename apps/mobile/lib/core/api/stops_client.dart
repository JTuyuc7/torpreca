import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../features/stops/data/stop.dart';
import '../env.dart';

/// Talks to `GET /api/v1/mobile/routes/:routeId/stops`
/// (apps/backend/src/modules/stops/stops.routes.ts,
/// `registerMobileStopsRoutes`) — the unsigned counterpart of
/// `GET /routes/:routeId/stops`, same reasoning as `RoutesClient`.
class StopsClient {
  StopsClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Future<List<Stop>> listByRoute(String accessToken, String routeId) async {
    final res = await _client.get(
      Uri.parse('${Env.backendUrl}/api/v1/mobile/routes/$routeId/stops'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );

    if (res.statusCode != 200) {
      throw StateError('Failed to load stops: HTTP ${res.statusCode}');
    }

    final stops = jsonDecode(res.body) as List<dynamic>;
    return stops.map((s) => Stop.fromJson(s as Map<String, dynamic>)).toList(growable: false)
      ..sort((a, b) => a.order.compareTo(b.order));
  }
}
