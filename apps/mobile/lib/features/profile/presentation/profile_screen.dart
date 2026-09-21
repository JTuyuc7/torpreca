import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/preferences_client.dart';
import '../../../core/theme/theme_controller.dart';
import '../../auth/data/auth_repository.dart';

/// "Pantalla Perfil + cerrar sesión" (TOR-11) — also where TOR-131's theme
/// preference lives on mobile. Name/email come straight from the Supabase
/// session (`user_metadata.name`, set at registration by
/// `auth.ts`'s `create_user_encrypted` call) instead of a new backend
/// endpoint — this app has no "GET my profile" call today, and the session
/// already carries everything this screen shows.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, required this.authRepository});

  final AuthRepository authRepository;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final PreferencesClient _preferencesClient = PreferencesClient();
  bool _savingTheme = false;

  Future<void> _onThemeChanged(ThemeMode mode) async {
    final accessToken = Supabase.instance.client.auth.currentSession?.accessToken;
    if (accessToken == null) return;

    // Optimistic: the picker reflects the tap immediately via
    // ThemeController.mode (MyApp rebuilds through its ValueListenableBuilder
    // regardless of whether the PATCH below succeeds) — a failed save just
    // means it doesn't persist for the next launch, not a broken picker now.
    ThemeController.mode.value = mode;
    setState(() => _savingTheme = true);
    try {
      await _preferencesClient.updateTheme(accessToken, ThemeController.toApiValue(mode));
    } catch (_) {
      // Ignored — see comment above.
    } finally {
      if (mounted) setState(() => _savingTheme = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = Supabase.instance.client.auth.currentUser;
    final name = (user?.userMetadata?['name'] as String?) ?? user?.email ?? '';
    final email = user?.email ?? '';

    return Scaffold(
      appBar: AppBar(title: const Text('Perfil')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?'),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(name, style: Theme.of(context).textTheme.titleMedium),
                        Text(email, style: Theme.of(context).textTheme.bodySmall),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text('Tema', style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 8),
          ValueListenableBuilder<ThemeMode>(
            valueListenable: ThemeController.mode,
            builder: (context, mode, _) => SegmentedButton<ThemeMode>(
              segments: const [
                ButtonSegment(value: ThemeMode.light, label: Text('Claro'), icon: Icon(Icons.light_mode)),
                ButtonSegment(value: ThemeMode.dark, label: Text('Oscuro'), icon: Icon(Icons.dark_mode)),
                ButtonSegment(
                  value: ThemeMode.system,
                  label: Text('Sistema'),
                  icon: Icon(Icons.settings_suggest),
                ),
              ],
              selected: {mode},
              onSelectionChanged: _savingTheme
                  ? null
                  : (selection) => _onThemeChanged(selection.first),
            ),
          ),
          const SizedBox(height: 32),
          OutlinedButton.icon(
            onPressed: () => widget.authRepository.signOut(),
            icon: const Icon(Icons.logout),
            label: const Text('Cerrar sesión'),
          ),
        ],
      ),
    );
  }
}
