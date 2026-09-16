import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../features/stops/data/driver_route.dart';
import '../env.dart';
import 'http_helpers.dart';

/// Talks to `GET /api/v1/mobile/routes`
/// (apps/backend/src/modules/routes/routes.routes.ts,
/// `registerMobileRoutesRoutes`) — the unsigned counterpart of `GET /routes`,
/// same reasoning as `MobileAuthClient`/`SyncClient`: Flutter can't hold
/// REQUEST_SIGNING_SECRET.
class RoutesClient {
  RoutesClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  /// Returns the driver's route for [date] (`yyyy-MM-dd`), or null if none is
  /// assigned that day.
  Future<DriverRoute?> getRouteForDate(String accessToken, String date) async {
    final res = await requestOrThrow(
      () => _client.get(
        Uri.parse('${Env.backendUrl}/api/v1/mobile/routes?date=$date'),
        headers: {'Authorization': 'Bearer $accessToken'},
      ),
    );

    final routes = jsonDecode(res.body) as List<dynamic>;
    if (routes.isEmpty) return null;
    return DriverRoute.fromJson(routes.first as Map<String, dynamic>);
  }
}
