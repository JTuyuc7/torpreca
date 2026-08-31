import 'dart:async';

import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/mobile_auth_client.dart';

/// Injectable so `LoginScreen` can be widget-tested with a fake instead of
/// hitting Supabase/the backend for real — same repository-injectable
/// pattern the backend already uses in every module
/// (see context/backend/TOR-14-scaffolding-users-vehicles.md).
abstract class AuthRepository {
  Future<void> signIn({required String email, required String password});
  Future<void> signOut();
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
        // Fire-and-forget: the Supabase session is already valid even if
        // this audit call fails (network blip, backend down, etc).
        unawaited(_mobileAuthClient.reportSession(accessToken));
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
}
