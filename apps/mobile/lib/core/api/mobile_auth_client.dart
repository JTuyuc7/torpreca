import 'dart:convert';

import 'package:http/http.dart' as http;

import '../env.dart';

/// The account-status codes `POST /mobile/auth/session` returns in a 403's
/// `code` field (see core/errors/app-error.ts's `AccountStatusError`) — mirrors
/// `AccountStatusCode` in packages/shared.
enum AccountStatusCode { pendingApproval, rejected, deactivated }

/// Result of [MobileAuthClient.reportSession] — unlike the other calls here,
/// this one isn't purely best-effort: a clean 403 carrying a `code` means the
/// driver's account genuinely isn't allowed in yet, and [AuthRepository] must
/// sign the (otherwise valid) Supabase session back out. Any other failure
/// (network blip, 401, a role-mismatch 403 without a code, backend down) is
/// still treated leniently — this endpoint only writes an audit log row, its
/// own failure must never block a login Supabase already confirmed.
class SessionCheckResult {
  const SessionCheckResult.ok() : blockedReason = null;
  const SessionCheckResult.blocked(AccountStatusCode reason) : blockedReason = reason;

  final AccountStatusCode? blockedReason;
  bool get isBlocked => blockedReason != null;
}

/// Talks to `POST /api/v1/mobile/auth/*` on the Torpreca backend
/// (apps/backend/src/modules/auth/mobile-auth.routes.ts). These calls only
/// exist to write the `audit_logs` row for auth.login/auth.logout/
/// auth.login_failed — the real session comes from Supabase Auth directly.
/// Every method is best-effort: a failed audit call must never block a
/// login/logout that Supabase already confirmed, same rationale as
/// `verifySession()` in the dashboard's `auth-client.ts`. The one exception
/// is `reportSession`'s account-status check — see [SessionCheckResult].
class MobileAuthClient {
  MobileAuthClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  String get _basePath => '${Env.backendUrl}/api/v1/mobile/auth';

  Future<SessionCheckResult> reportSession(String accessToken) async {
    try {
      final res = await _client.post(
        Uri.parse('$_basePath/session'),
        headers: {'Authorization': 'Bearer $accessToken'},
      );

      if (res.statusCode == 403) {
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        final code = switch (body['code']) {
          'PENDING_APPROVAL' => AccountStatusCode.pendingApproval,
          'REJECTED' => AccountStatusCode.rejected,
          'DEACTIVATED' => AccountStatusCode.deactivated,
          _ => null,
        };
        if (code != null) return SessionCheckResult.blocked(code);
      }
    } catch (_) {
      // Fall through to ok() — see the class doc comment.
    }
    return const SessionCheckResult.ok();
  }

  /// `POST /mobile/auth/register` — public, no token yet. Returns null on
  /// success (204), or a user-facing message extracted from the response on
  /// failure (400: bad signup code / already registered — the backend
  /// deliberately returns the same generic message for both; 429: rate
  /// limited; anything else: a generic fallback).
  Future<String?> register({
    required String email,
    required String password,
    required String name,
    required String signupCode,
  }) async {
    try {
      final res = await _client.post(
        Uri.parse('$_basePath/register'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email,
          'password': password,
          'name': name,
          'signupCode': signupCode,
        }),
      );

      if (res.statusCode == 204) return null;
      if (res.statusCode == 429) {
        return 'Demasiados intentos. Espera un minuto e intenta de nuevo.';
      }
      if (res.statusCode == 400) {
        final body = jsonDecode(res.body) as Map<String, dynamic>;
        return (body['error'] as String?) ?? 'No se pudo completar el registro.';
      }
      return 'No se pudo completar el registro. Intenta de nuevo.';
    } catch (_) {
      return 'No se pudo conectar con el servidor. Intenta de nuevo.';
    }
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
