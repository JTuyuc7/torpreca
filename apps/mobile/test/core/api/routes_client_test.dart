import 'dart:convert';

import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/api/api_exceptions.dart';
import 'package:mobile/core/api/routes_client.dart';

Map<String, dynamic> routeJson({
  String id = 'route-1',
  String code = 'R-20260924-01',
  String status = 'pending',
  num drivenKm = 0,
  String createdAt = '2026-09-24T10:00:00.000Z',
}) => {'id': id, 'code': code, 'status': status, 'drivenKm': drivenKm, 'createdAt': createdAt};

void main() {
  setUpAll(() {
    dotenv.testLoad(fileInput: 'BACKEND_URL=http://backend.test');
  });

  group('listForDate', () {
    test('asks for the given date with the bearer token and maps the routes', () async {
      http.Request? captured;
      final client = MockClient((request) async {
        captured = request;
        return http.Response(jsonEncode([routeJson(status: 'in_progress')]), 200);
      });

      final routes = await RoutesClient(client: client).listForDate('token-1', '2026-09-24');

      expect(captured!.url.toString(), 'http://backend.test/api/v1/mobile/routes?date=2026-09-24');
      expect(captured!.headers['Authorization'], 'Bearer token-1');
      expect(routes, hasLength(1));
      expect(routes.first.id, 'route-1');
      expect(routes.first.code, 'R-20260924-01');
      expect(routes.first.statusLabel, 'En curso');
    });

    test('returns every route of the day, oldest first', () async {
      final client = MockClient(
        (_) async => http.Response(
          jsonEncode([
            routeJson(id: 'late', code: 'R-2', createdAt: '2026-09-24T12:00:00.000Z'),
            routeJson(id: 'early', code: 'R-1', createdAt: '2026-09-24T08:00:00.000Z'),
          ]),
          200,
        ),
      );

      final routes = await RoutesClient(client: client).listForDate('token-1', '2026-09-24');

      expect(routes.map((r) => r.id), ['early', 'late']);
    });

    test('returns an empty list when no route is assigned that day', () async {
      final client = MockClient((_) async => http.Response('[]', 200));
      expect(await RoutesClient(client: client).listForDate('token-1', '2026-09-24'), isEmpty);
    });
  });

  group('start / finish', () {
    test('start PATCHes /start and returns the updated route', () async {
      http.Request? captured;
      final client = MockClient((request) async {
        captured = request;
        return http.Response(jsonEncode(routeJson(status: 'in_progress')), 200);
      });

      final route = await RoutesClient(client: client).start('token-1', 'route-1');

      expect(captured!.method, 'PATCH');
      expect(captured!.url.toString(), 'http://backend.test/api/v1/mobile/routes/route-1/start');
      expect(captured!.headers['Authorization'], 'Bearer token-1');
      expect(route.isInProgress, isTrue);
    });

    test('finish PATCHes /finish and exposes the measured km', () async {
      http.Request? captured;
      final client = MockClient((request) async {
        captured = request;
        return http.Response(jsonEncode(routeJson(status: 'completed', drivenKm: 12.34)), 200);
      });

      final route = await RoutesClient(client: client).finish('token-1', 'route-1');

      expect(captured!.url.toString(), 'http://backend.test/api/v1/mobile/routes/route-1/finish');
      expect(route.isCompleted, isTrue);
      expect(route.drivenKm, 12.34);
    });

    test('a 409 (route in the wrong state) surfaces as an ApiException', () async {
      final client = MockClient((_) async => http.Response('{}', 409));

      expect(
        RoutesClient(client: client).start('token-1', 'route-1'),
        throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 409)),
      );
    });
  });
}
