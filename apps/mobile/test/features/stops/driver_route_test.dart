import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/stops/data/driver_route.dart';

Map<String, dynamic> json({Object? startTime, Object? endTime}) => {
  'id': 'route-1',
  'code': 'R-20260926-01',
  'date': '2026-09-26',
  'status': 'completed',
  'drivenKm': 12.5,
  'createdAt': '2026-09-26T10:00:00.000Z',
  'startTime': startTime,
  'endTime': endTime,
};

void main() {
  group('DriverRoute.fromJson', () {
    test('parses start and end time as instants', () {
      final route = DriverRoute.fromJson(
        json(startTime: '2026-09-26T14:00:00.000Z', endTime: '2026-09-26T16:30:00.000Z'),
      );

      expect(route.startTime!.toUtc(), DateTime.utc(2026, 9, 26, 14));
      expect(route.endTime!.toUtc(), DateTime.utc(2026, 9, 26, 16, 30));
    });

    test('keeps start and end time null until the route starts and finishes', () {
      final route = DriverRoute.fromJson(json());

      expect(route.startTime, isNull);
      expect(route.endTime, isNull);
    });
  });

  group('DriverRoute.isStale', () {
    DriverRoute route(String status, String date) =>
        DriverRoute.fromJson({...json(), 'status': status, 'date': date});

    test('is true for an in-progress route of a previous day', () {
      expect(route('in_progress', '2026-09-25').isStale('2026-09-26'), isTrue);
    });

    test("is false for today's route, however far along", () {
      expect(route('in_progress', '2026-09-26').isStale('2026-09-26'), isFalse);
    });

    test('is false for routes that are not running, even on a past day', () {
      expect(route('pending', '2026-09-25').isStale('2026-09-26'), isFalse);
      expect(route('completed', '2026-09-25').isStale('2026-09-26'), isFalse);
      expect(route('cancelled', '2026-09-25').isStale('2026-09-26'), isFalse);
    });
  });

  group('DriverRoute.isFinished', () {
    DriverRoute route(String status) => DriverRoute.fromJson({...json(), 'status': status});

    test('is true once completed or closed without finishing', () {
      expect(route('completed').isFinished, isTrue);
      expect(route('cancelled').isFinished, isTrue);
    });

    test('is false while the route can still change', () {
      expect(route('pending').isFinished, isFalse);
      expect(route('in_progress').isFinished, isFalse);
    });
  });
}
