import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../features/reports/data/daily_report.dart';
import '../env.dart';
import 'http_helpers.dart';

/// Talks to `GET /api/v1/mobile/daily-reports`
/// (apps/backend/src/modules/daily-reports/daily-reports.routes.ts,
/// `registerMobileDailyReportsRoutes`) — unsigned, same reasoning as
/// `RoutesClient`/`StopsClient`.
class DailyReportsClient {
  DailyReportsClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  /// Returns the driver's consolidated report for [date] (`yyyy-MM-dd`), or
  /// null if none has been generated yet — a normal state (e.g. before the
  /// driver finishes their first route of the day), not an error.
  Future<DailyReport?> getForDate(String accessToken, String date) async {
    final res = await requestOrThrow(
      () => _client.get(
        Uri.parse('${Env.backendUrl}/api/v1/mobile/daily-reports?date=$date'),
        headers: {'Authorization': 'Bearer $accessToken'},
      ),
    );

    final reports = jsonDecode(res.body) as List<dynamic>;
    if (reports.isEmpty) return null;
    return DailyReport.fromJson(reports.first as Map<String, dynamic>);
  }
}
