import 'dart:convert';

import 'package:http/http.dart' as http;

import '../env.dart';
import 'http_helpers.dart';

/// A driving route between two points, as returned by the Mapbox Directions
/// API — road distance/duration and the actual road geometry, as opposed to
/// the straight line `MapScreen` falls back to.
class DirectionsRoute {
  const DirectionsRoute({
    required this.distanceMeters,
    required this.durationSeconds,
    required this.coordinates,
  });

  final double distanceMeters;
  final double durationSeconds;

  /// `[lng, lat]` pairs in path order, straight from the API's GeoJSON —
  /// kept as raw pairs here (not `mapbox_maps_flutter`'s `Position`) so this
  /// client doesn't depend on the map plugin.
  final List<List<double>> coordinates;

  factory DirectionsRoute.fromJson(Map<String, dynamic> json) {
    final route = (json['routes'] as List).first as Map<String, dynamic>;
    final geometry = route['geometry'] as Map<String, dynamic>;
    final coords = (geometry['coordinates'] as List)
        .map((c) => (c as List).map((v) => (v as num).toDouble()).toList())
        .toList();
    return DirectionsRoute(
      distanceMeters: (route['distance'] as num).toDouble(),
      durationSeconds: (route['duration'] as num).toDouble(),
      coordinates: coords,
    );
  }
}

/// Talks directly to Mapbox's own Directions API (`api.mapbox.com`), not our
/// backend — same access token as the map itself ([Env.mapboxToken]), no
/// bearer auth. Used by `MapScreen` to draw the next stop's line following
/// roads instead of as the crow flies, with a real distance/ETA.
class DirectionsClient {
  DirectionsClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  static const _base = 'https://api.mapbox.com/directions/v5/mapbox/driving';

  /// Throws [NetworkException]/[ApiException] like the rest of the API
  /// clients — callers fall back to the straight line on failure rather than
  /// surfacing this to the driver, so a Mapbox outage never blocks the map.
  Future<DirectionsRoute> route({
    required double fromLat,
    required double fromLng,
    required double toLat,
    required double toLng,
  }) async {
    final uri = Uri.parse('$_base/$fromLng,$fromLat;$toLng,$toLat').replace(
      queryParameters: {
        'geometries': 'geojson',
        'overview': 'full',
        'access_token': Env.mapboxToken,
      },
    );
    final res = await requestOrThrow(() => _client.get(uri));
    return DirectionsRoute.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
  }
}
