import 'dart:convert';

import 'package:http/http.dart' as http;

import '../env.dart';
import 'http_helpers.dart';

/// One of the three values `user_preferences.theme` accepts
/// (apps/backend/supabase/migrations/..._add_user_preferences.sql) — kept as
/// a plain string here (not an enum) since the only consumer is
/// [ThemeController], which already speaks Flutter's own `ThemeMode`.
class UserPreferences {
  const UserPreferences({required this.theme});

  final String theme;

  factory UserPreferences.fromJson(Map<String, dynamic> json) =>
      UserPreferences(theme: json['theme'] as String);
}

/// Talks to `GET`/`PATCH /api/v1/mobile/users/me/preferences`
/// (apps/backend/src/modules/user-preferences/user-preferences.routes.ts,
/// `registerMobileUserPreferencesRoutes`) — the unsigned counterpart of the
/// dashboard's `/users/me/preferences`, same reasoning as `StopsClient`. Only
/// `theme` is read/written from mobile today (Perfil screen, TOR-11);
/// `language`/`defaultMapView` are dashboard-only concerns (TOR-131 card
/// notes) but the endpoint doesn't distinguish callers, so a future ticket
/// can read them from here too without a backend change.
class PreferencesClient {
  PreferencesClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  String get _basePath => '${Env.backendUrl}/api/v1/mobile/users/me/preferences';

  Future<UserPreferences> get(String accessToken) async {
    final res = await requestOrThrow(
      () => _client.get(Uri.parse(_basePath), headers: {'Authorization': 'Bearer $accessToken'}),
    );
    return UserPreferences.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
  }

  Future<UserPreferences> updateTheme(String accessToken, String theme) async {
    final res = await requestOrThrow(
      () => _client.patch(
        Uri.parse(_basePath),
        headers: {
          'Authorization': 'Bearer $accessToken',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'theme': theme}),
      ),
    );
    return UserPreferences.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
  }
}
