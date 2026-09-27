import 'dart:convert';

import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/api/daily_reports_client.dart';

Map<String, dynamic> reportJson(String date) => {
  'date': date,
  'drivenKm': 12.5,
  'completedStops': 4,
  'routesServed': 1,
  'timeOnRoute': '01:30:00',
};

void main() {
  setUpAll(() {
    dotenv.testLoad(fileInput: 'BACKEND_URL=http://backend.test');
  });

  group('history', () {
    test('asks for 5 reports by default with the bearer token and maps them', () async {
      http.Request? captured;
      final client = MockClient((request) async {
        captured = request;
        return http.Response(jsonEncode([reportJson('2026-09-25'), reportJson('2026-09-24')]), 200);
      });

      final reports = await DailyReportsClient(client: client).history('token-1');

      expect(captured!.url.path, '/api/v1/mobile/daily-reports/history');
      expect(captured!.url.queryParameters, {'limit': '5'});
      expect(captured!.headers['Authorization'], 'Bearer token-1');
      expect(reports.map((r) => r.date), ['2026-09-25', '2026-09-24']);
      expect(reports.first.drivenKm, 12.5);
    });

    test('sends the cursor and the date range only when given', () async {
      http.Request? captured;
      final client = MockClient((request) async {
        captured = request;
        return http.Response('[]', 200);
      });

      final reports = await DailyReportsClient(
        client: client,
      ).history('token-1', limit: 10, before: '2026-09-20', from: '2026-09-01', to: '2026-09-15');

      expect(captured!.url.queryParameters, {
        'limit': '10',
        'before': '2026-09-20',
        'from': '2026-09-01',
        'to': '2026-09-15',
      });
      expect(reports, isEmpty);
    });
  });
}
