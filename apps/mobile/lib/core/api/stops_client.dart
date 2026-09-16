import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../features/stops/data/stop.dart';
import '../env.dart';
import 'http_helpers.dart';

/// Talks to `GET /api/v1/mobile/routes/:routeId/stops` and
/// `PATCH /api/v1/mobile/stops/:id/{complete,delay}`
/// (apps/backend/src/modules/stops/stops.routes.ts,
/// `registerMobileStopsRoutes`) — the unsigned counterpart of
/// `/routes/:routeId/stops` + `/stops/:id/complete|delay`, same reasoning as
/// `RoutesClient`.
class StopsClient {
  StopsClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  String get _basePath => '${Env.backendUrl}/api/v1/mobile';

  Future<List<Stop>> listByRoute(String accessToken, String routeId) async {
    final res = await requestOrThrow(
      () => _client.get(
        Uri.parse('$_basePath/routes/$routeId/stops'),
        headers: {'Authorization': 'Bearer $accessToken'},
      ),
    );

    final stops = jsonDecode(res.body) as List<dynamic>;
    return stops.map((s) => Stop.fromJson(s as Map<String, dynamic>)).toList(growable: false)
      ..sort((a, b) => a.order.compareTo(b.order));
  }

  Future<Stop> complete(String accessToken, String stopId) =>
      _patch(accessToken, '$_basePath/stops/$stopId/complete');

  Future<Stop> delay(String accessToken, String stopId) =>
      _patch(accessToken, '$_basePath/stops/$stopId/delay');

  Future<Stop> _patch(String accessToken, String url) async {
    final res = await requestOrThrow(
      () => _client.patch(Uri.parse(url), headers: {'Authorization': 'Bearer $accessToken'}),
    );

    return Stop.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
  }
}
