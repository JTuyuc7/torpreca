import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Thin wrapper over the values loaded from `.env` by `flutter_dotenv`.
///
/// Fails fast (like `apps/backend/src/core/config/env.ts`) instead of
/// letting a missing var surface later as a confusing network/auth error.
class Env {
  Env._();

  static String get supabaseUrl => _require('SUPABASE_URL');
  static String get supabaseAnonKey => _require('SUPABASE_ANON_KEY');
  static String get backendUrl => _require('BACKEND_URL');

  static String _require(String key) {
    final value = dotenv.env[key];
    if (value == null || value.isEmpty || value.startsWith('TODO_')) {
      throw StateError(
        'Missing or placeholder value for "$key" in apps/mobile/.env',
      );
    }
    return value;
  }
}
