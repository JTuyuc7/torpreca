import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/mobile_auth_client.dart';

/// Thrown by [SupabaseAuthRepository.signIn] when Supabase accepted the
/// credentials but the backend's own account status doesn't allow the
/// driver in yet (pending approval, rejected, or deactivated) — the
/// Supabase session is signed back out before this is thrown, so the caller
/// never ends up "logged in" with a blocked account.
class AccountNotReadyException implements Exception {
  const AccountNotReadyException(this.reason, this.message);

  final AccountStatusCode reason;
  final String message;
}

String _messageFor(AccountStatusCode code) => switch (code) {
  AccountStatusCode.pendingApproval =>
    'Tu cuenta está pendiente de aprobación por un administrador.',
  AccountStatusCode.rejected => 'Tu solicitud de registro fue rechazada.',
  AccountStatusCode.deactivated => 'Tu cuenta fue desactivada.',
};

/// Injectable so `LoginScreen` can be widget-tested with a fake instead of
/// hitting Supabase/the backend for real — same repository-injectable
/// pattern the backend already uses in every module
/// (see context/backend/TOR-14-scaffolding-users-vehicles.md).
abstract class AuthRepository {
  Future<void> signIn({required String email, required String password});
  Future<void> signOut();

  /// Self-registration (see the self-signup design doc). Returns null on
  /// success, or a user-facing error message. Does not sign the caller in —
  /// the new account can't authenticate yet (email unconfirmed, then
  /// `status = 'pending'` until an admin approves it).
  Future<String?> register({
    required String email,
    required String password,
    required String name,
    required String signupCode,
  });
}

class SupabaseAuthRepository implements AuthRepository {
  SupabaseAuthRepository({MobileAuthClient? mobileAuthClient})
      : _mobileAuthClient = mobileAuthClient ?? MobileAuthClient();

  final MobileAuthClient _mobileAuthClient;

  SupabaseClient get _supabase => Supabase.instance.client;

  @override
  Future<void> signIn({required String email, required String password}) async {
    try {
      final response = await _supabase.auth.signInWithPassword(
        email: email,
        password: password,
      );

      final accessToken = response.session?.accessToken;
      if (accessToken != null) {
        final check = await _mobileAuthClient.reportSession(accessToken);
        if (check.isBlocked) {
          // Supabase already accepted the credentials — undo that session
          // before surfacing the error, so the caller never observes a
          // signed-in state for an account that isn't allowed in yet.
          await _supabase.auth.signOut();
          throw AccountNotReadyException(check.blockedReason!, _messageFor(check.blockedReason!));
        }
      }
    } on AuthException {
      unawaited(_mobileAuthClient.reportLoginFailed(email));
      rethrow;
    }
  }

  @override
  Future<void> signOut() async {
    final accessToken = _supabase.auth.currentSession?.accessToken;
    if (accessToken != null) {
      unawaited(_mobileAuthClient.reportLogout(accessToken));
    }
    await _supabase.auth.signOut();
  }

  @override
  Future<String?> register({
    required String email,
    required String password,
    required String name,
    required String signupCode,
  }) {
    return _mobileAuthClient.register(
      email: email,
      password: password,
      name: name,
      signupCode: signupCode,
    );
  }
}
