import 'package:http/http.dart' as http;

import 'api_exceptions.dart';

/// Shared by `RoutesClient`/`StopsClient`/`DailyReportsClient` — every one of
/// their calls expects exactly HTTP 200, so this is the one place that turns
/// "the request itself failed" into [NetworkException] and "the server
/// answered but not with 200" into [ApiException], instead of each client
/// repeating its own try/catch + status check.
Future<http.Response> requestOrThrow(Future<http.Response> Function() send) async {
  final http.Response res;
  try {
    res = await send();
  } catch (_) {
    throw const NetworkException();
  }

  if (res.statusCode != 200) {
    throw ApiException(res.statusCode);
  }
  return res;
}
