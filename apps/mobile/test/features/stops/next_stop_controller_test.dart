import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/stops/data/next_stop_controller.dart';

NextStopInfo info({String stopId = 's1', String name = 'Patrick'}) => NextStopInfo(
  routeCode: 'R-20260926-03',
  stopId: stopId,
  customerName: name,
  address: 'Tikal Futura',
  lat: 14.6,
  lng: -90.5,
);

void main() {
  group('NextStopController', () {
    test('notifies when the next stop changes', () {
      final controller = NextStopController();
      var notifications = 0;
      controller.addListener(() => notifications++);

      controller.value = info();
      controller.value = info(stopId: 's2');
      controller.value = null;

      expect(notifications, 3);
    });

    test('does not notify when the same stop is published again', () {
      // StopsScreen republishes after every list change; the map must only
      // redraw when the destination actually changed.
      final controller = NextStopController();
      controller.value = info();
      var notifications = 0;
      controller.addListener(() => notifications++);

      controller.value = info();

      expect(notifications, 0);
    });
  });

  group('formatDistanceMeters', () {
    test('rounds to 10 m under a kilometer', () {
      expect(formatDistanceMeters(347), '350 m');
      expect(formatDistanceMeters(12), '10 m');
    });

    test('switches to km with one decimal from 1000 m', () {
      expect(formatDistanceMeters(1000), '1.0 km');
      expect(formatDistanceMeters(37940), '37.9 km');
    });
  });
}
