import 'dart:convert';

import 'package:http/http.dart' as http;

import '../env.dart';

/// Talks to `POST /api/v1/mobile/auth/*` on the Torpreca backend
/// (apps/backend/src/modules/auth/mobile-auth.routes.ts). These calls only
/// exist to write the `audit_logs` row for auth.login/auth.logout/
/// auth.login_failed — the real session comes from Supabase Auth directly.
/// Every method is best-effort: a failed audit call must never block a
/// login/logout that Supabase already confirmed, same rationale as
/// `verifySession()` in the dashboard's `auth-client.ts`.
class MobileAuthClient {
  MobileAuthClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  String get _basePath => '${Env.backendUrl}/api/v1/mobile/auth';

  Future<void> reportSession(String accessToken) async {
    await _postSilently(
      Uri.parse('$_basePath/session'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
  }

  Future<void> reportLogout(String accessToken) async {
    await _postSilently(
      Uri.parse('$_basePath/logout'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
  }

  Future<void> reportLoginFailed(String email) async {
    await _postSilently(
      Uri.parse('$_basePath/login-failed'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email}),
    );
  }

  Future<void> _postSilently(
    Uri uri, {
    Map<String, String>? headers,
    String? body,
  }) async {
    try {
      await _client.post(uri, headers: headers, body: body);
    } catch (_) {
      // Best-effort: audit logging must never block the auth flow.
    }
  }
}
