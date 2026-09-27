import 'package:flutter/foundation.dart';

/// The stop the driver is heading to on the route that's running now — what
/// the Mapa tab draws. Built by `StopsScreen`, which owns the routes data.
@immutable
class NextStopInfo {
  const NextStopInfo({
    required this.routeCode,
    required this.stopId,
    required this.customerName,
    required this.address,
    required this.lat,
    required this.lng,
  });

  final String routeCode;
  final String stopId;
  final String customerName;
  final String address;
  final double lat;
  final double lng;

  @override
  bool operator ==(Object other) =>
      other is NextStopInfo &&
      other.routeCode == routeCode &&
      other.stopId == stopId &&
      other.customerName == customerName &&
      other.address == address &&
      other.lat == lat &&
      other.lng == lng;

  @override
  int get hashCode => Object.hash(routeCode, stopId, customerName, address, lat, lng);
}

/// Shares the running route's next stop between tabs: `StopsScreen` publishes
/// it whenever its routes change, `MapScreen` listens. Null when no route is
/// running (or every stop is done). Owned by `HomeShell`, like the tracking
/// session. [ValueNotifier] only notifies on a real change, which is why
/// [NextStopInfo] has value equality.
class NextStopController extends ValueNotifier<NextStopInfo?> {
  NextStopController() : super(null);
}

/// "350 m" below a kilometer (rounded to 10 m), "1.2 km" above.
String formatDistanceMeters(double meters) =>
    meters < 1000 ? '${(meters / 10).round() * 10} m' : '${(meters / 1000).toStringAsFixed(1)} km';
