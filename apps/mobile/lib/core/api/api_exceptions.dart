/// Thrown when a request never reached the server — no connectivity, DNS
/// failure, timeout, TLS error, etc. (anything the underlying `http.Client`
/// call itself throws). Distinct from [ApiException] so the UI can tell
/// "check your connection" apart from "the server responded with an error".
class NetworkException implements Exception {
  const NetworkException();

  @override
  String toString() => 'NetworkException: could not reach the server';
}

/// Thrown when the server responded, but with a non-2xx status — a real
/// answer, just not a successful one (auth expired, route doesn't exist yet
/// on this environment, server error, etc.).
class ApiException implements Exception {
  const ApiException(this.statusCode);

  final int statusCode;

  @override
  String toString() => 'ApiException: HTTP $statusCode';
}
