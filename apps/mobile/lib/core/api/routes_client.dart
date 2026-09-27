import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../features/stops/data/driver_route.dart';
import '../env.dart';
import 'http_helpers.dart';

/// Talks to `GET /api/v1/mobile/routes` and
/// `PATCH /api/v1/mobile/routes/:id/{start,finish}`
/// (apps/backend/src/modules/routes/routes.routes.ts,
/// `registerMobileRoutesRoutes`) — the unsigned counterpart of `/routes`,
/// same reasoning as `MobileAuthClient`/`SyncClient`: Flutter can't hold
/// REQUEST_SIGNING_SECRET.
class RoutesClient {
  RoutesClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  String get _basePath => '${Env.backendUrl}/api/v1/mobile/routes';

  /// Every route the driver has on [date] (`yyyy-MM-dd`), oldest first — a
  /// driver can have more than one route per day (TOR-138). Empty if none.
  Future<List<DriverRoute>> listForDate(String accessToken, String date) async {
    final res = await requestOrThrow(
      () => _client.get(
        Uri.parse('$_basePath?date=$date'),
        headers: {'Authorization': 'Bearer $accessToken'},
      ),
    );

    final routes = (jsonDecode(res.body) as List<dynamic>)
        .map((r) => DriverRoute.fromJson(r as Map<String, dynamic>))
        .toList();
    // The backend only orders by date, so routes of the same day come back in
    // no particular order — keep them stable here.
    routes.sort((a, b) => a.createdAt.compareTo(b.createdAt));
    return routes;
  }

  /// The driver's finished routes (completed, or closed without finishing),
  /// newest first (`GET /mobile/routes/history`): [limit] per page from
  /// [offset], optionally within an inclusive [from]/[to] date range
  /// (`yyyy-MM-dd`).
  Future<List<DriverRoute>> history(
    String accessToken, {
    int limit = 5,
    int offset = 0,
    String? from,
    String? to,
  }) async {
    final query = <String, String>{
      'limit': '$limit',
      'offset': '$offset',
      'from': ?from,
      'to': ?to,
    };
    final res = await requestOrThrow(
      () => _client.get(
        Uri.parse('$_basePath/history').replace(queryParameters: query),
        headers: {'Authorization': 'Bearer $accessToken'},
      ),
    );

    return (jsonDecode(res.body) as List<dynamic>)
        .map((r) => DriverRoute.fromJson(r as Map<String, dynamic>))
        .toList();
  }

  /// The driver's routes that are started and not finished, of any date —
  /// how the app finds the ones it left running on a previous day.
  Future<List<DriverRoute>> listInProgress(String accessToken) async {
    final res = await requestOrThrow(
      () => _client.get(
        Uri.parse('$_basePath?status=in_progress'),
        headers: {'Authorization': 'Bearer $accessToken'},
      ),
    );

    return (jsonDecode(res.body) as List<dynamic>)
        .map((r) => DriverRoute.fromJson(r as Map<String, dynamic>))
        .toList();
  }

  Future<DriverRoute> start(String accessToken, String routeId) =>
      _patch(accessToken, '$_basePath/$routeId/start');

  /// The backend measures the kilometers from the driver's GPS pings — the
  /// app doesn't send any.
  Future<DriverRoute> finish(String accessToken, String routeId) =>
      _patch(accessToken, '$_basePath/$routeId/finish');

  /// "Cerrar sin completar": gives up a route from a past day that was started
  /// and never finished. The backend keeps only the km driven up to the end of
  /// that day and marks the route cancelled.
  Future<DriverRoute> close(String accessToken, String routeId) =>
      _patch(accessToken, '$_basePath/$routeId/close');

  Future<DriverRoute> _patch(String accessToken, String url) async {
    final res = await requestOrThrow(
      () => _client.patch(Uri.parse(url), headers: {'Authorization': 'Bearer $accessToken'}),
    );

    return DriverRoute.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
  }
}
