import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/mobile_auth_client.dart';

/// User-facing text for each blocked-account reason — shared by whatever
/// signs the driver back out after finding a non-active status. Public
/// (unlike the removed `AccountNotReadyException`) because `AuthGate` in
/// main.dart needs it too: the account-status check moved there (see its
/// doc comment for why `signIn()` itself can no longer own this check).
String accountStatusMessage(AccountStatusCode code) => switch (code) {
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
      // No account-status check here on purpose: Supabase's session stream
      // (onAuthStateChange) fires the instant signInWithPassword resolves,
      // before this function would even get a chance to await that check —
      // AuthGate (main.dart) reacts to the same stream, so it would already
      // be showing HomePlaceholder by the time this code ran, then a later
      // signOut() here would just bounce back to a *brand-new* LoginScreen
      // instance, losing whatever error this function set (its old State
      // was already disposed). AuthGate does this check itself instead —
      // see its doc comment — covering both a fresh login and an
      // already-active session found on app start.
      await _supabase.auth.signInWithPassword(email: email, password: password);
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
