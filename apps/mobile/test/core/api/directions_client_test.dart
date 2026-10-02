import 'dart:convert';

import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/api/directions_client.dart';

Map<String, dynamic> _directionsJson() => {
  'routes': [
    {
      'distance': 1234.5,
      'duration': 300.0,
      'geometry': {
        'coordinates': [
          [-90.51, 14.63],
          [-90.505, 14.635],
        ],
      },
    },
  ],
};

void main() {
  setUpAll(() {
    dotenv.testLoad(fileInput: 'MAPBOX_TOKEN=pk.test-token');
  });

  test('route() calls Mapbox Directions with both points and the access token', () async {
    http.Request? captured;
    final client = MockClient((request) async {
      captured = request;
      return http.Response(jsonEncode(_directionsJson()), 200);
    });

    final route = await DirectionsClient(client: client)
        .route(fromLat: 14.63, fromLng: -90.51, toLat: 14.635, toLng: -90.505);

    expect(
      captured!.url.toString(),
      startsWith('https://api.mapbox.com/directions/v5/mapbox/driving/-90.51,14.63;-90.505,14.635'),
    );
    expect(captured!.url.queryParameters['access_token'], 'pk.test-token');
    expect(captured!.url.queryParameters['geometries'], 'geojson');
    expect(route.distanceMeters, 1234.5);
    expect(route.durationSeconds, 300.0);
    expect(route.coordinates, [
      [-90.51, 14.63],
      [-90.505, 14.635],
    ]);
  });

  test('throws when Mapbox responds with a non-200 status', () async {
    final client = MockClient((request) async => http.Response('not found', 404));

    expect(
      () => DirectionsClient(client: client).route(fromLat: 0, fromLng: 0, toLat: 1, toLng: 1),
      throwsA(isA<Exception>()),
    );
  });
}
