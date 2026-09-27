import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/api/mobile_auth_client.dart';
import 'core/api/preferences_client.dart';
import 'core/env.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/theme_controller.dart';
import 'features/auth/data/auth_repository.dart';
import 'features/auth/presentation/login_screen.dart';
import 'features/home/presentation/home_shell.dart';

// Default entry point (`flutter run`/`flutter test` with no explicit -t) —
// boots straight into staging, the safer default for ad-hoc local runs. Real
// builds go through main_staging.dart/main_production.dart + `--flavor`
// (TOR-111) so the Android applicationId/app name/env file all agree with
// each other instead of drifting independently.
Future<void> main() => bootstrap('.env.staging');

/// Shared app bootstrap — each flavor's entry point (`main_staging.dart`,
/// `main_production.dart`) just picks which `.env.*` asset to load here.
/// [envFileName] must match one of the assets declared in `pubspec.yaml`.
Future<void> bootstrap(String envFileName) async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: envFileName);
  await Hive.initFlutter();
  await Supabase.initialize(url: Env.supabaseUrl, publishableKey: Env.supabaseAnonKey);
  MapboxOptions.setAccessToken(Env.mapboxToken);
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    // TOR-131: themeMode is no longer hardcoded — ThemeController.mode is
    // overwritten from the driver's saved preference right after login (see
    // _SessionGateState._verify() below) and again from Perfil (TOR-11)
    // whenever they change it there.
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: ThemeController.mode,
      builder: (context, mode, _) => MaterialApp(
        title: 'Torpreca',
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: mode,
        home: const AuthGate(),
      ),
    );
  }
}

/// Reactively swaps between LoginScreen and HomeShell based on
/// Supabase's own session stream — no manual Navigator.push on
/// login/logout, matching the pattern supabase_flutter recommends.
///
/// Whenever a session appears (a fresh login *or* one already persisted from
/// a previous app launch), it's handed to [_SessionGate] to confirm the
/// backend's own account status (`POST /mobile/auth/session`) before ever
/// showing [HomeShell] — a driver approved yesterday and rejected
/// today shouldn't get in just because their phone still has Supabase's
/// session cached. This check deliberately lives here, not inside
/// `AuthRepository.signIn()`: that would race this same stream (it fires the
/// instant `signInWithPassword` resolves, before signIn() could even await
/// the check), showing HomeShell first and only bouncing back to a
/// *brand-new* LoginScreen instance afterwards — losing whatever error
/// message the old, already-disposed instance tried to set.
class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  final AuthRepository _authRepository = SupabaseAuthRepository();
  final MobileAuthClient _mobileAuthClient = MobileAuthClient();
  String? _blockedMessage;

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<AuthState>(
      stream: Supabase.instance.client.auth.onAuthStateChange,
      initialData: AuthState(
        AuthChangeEvent.initialSession,
        Supabase.instance.client.auth.currentSession,
      ),
      builder: (context, snapshot) {
        final session = snapshot.data?.session;
        if (session == null) {
          // Read once via the widget's initState, not re-read on every
          // rebuild of this branch — a fresh LoginScreen instance is created
          // exactly when we land back here after a blocked sign-in, so this
          // is naturally "shown once" without needing to null it out here.
          return LoginScreen(authRepository: _authRepository, initialError: _blockedMessage);
        }
        return _SessionGate(
          key: ValueKey(session.accessToken),
          accessToken: session.accessToken,
          mobileAuthClient: _mobileAuthClient,
          onBlocked: (message) => setState(() => _blockedMessage = message),
          child: HomeShell(authRepository: _authRepository),
        );
      },
    );
  }
}

/// Confirms a Supabase session is actually usable (backend account status is
/// `active`) before showing [child]. Keyed by access token in [AuthGate] so
/// a genuinely new session re-runs the check.
class _SessionGate extends StatefulWidget {
  const _SessionGate({
    required super.key,
    required this.accessToken,
    required this.mobileAuthClient,
    required this.onBlocked,
    required this.child,
  });

  final String accessToken;
  final MobileAuthClient mobileAuthClient;
  final ValueChanged<String> onBlocked;
  final Widget child;

  @override
  State<_SessionGate> createState() => _SessionGateState();
}

class _SessionGateState extends State<_SessionGate> {
  bool _checking = true;

  @override
  void initState() {
    super.initState();
    _verify();
  }

  Future<void> _verify() async {
    final result = await widget.mobileAuthClient.reportSession(widget.accessToken);
    if (!mounted) return;

    if (result.isBlocked) {
      // Set the message *before* signing out — signOut() is what flips
      // AuthGate's stream back to "no session", which builds a brand-new
      // LoginScreen right then. That new instance's State reads
      // `widget.initialError` exactly once, in its field initializer — if
      // onBlocked() ran after signOut(), that first build would still see
      // the old (null) message, and nothing forces a second read.
      widget.onBlocked(accountStatusMessage(result.blockedReason!));
      // Supabase already accepted the credentials (or resumed an old
      // session) — undo that before the caller ever sees `child`.
      await Supabase.instance.client.auth.signOut();
      return;
    }
    setState(() => _checking = false);
    unawaited(_syncTheme());
  }

  // Fire-and-forget: never blocks showing HomeShell, and a failure here just
  // leaves ThemeController at its current value (system, or whatever the
  // last successful sync set) instead of surfacing an error the driver can't
  // act on.
  Future<void> _syncTheme() async {
    try {
      final preferences = await PreferencesClient().get(widget.accessToken);
      ThemeController.mode.value = ThemeController.fromApiValue(preferences.theme);
    } catch (_) {
      // Ignored on purpose — see comment above.
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return widget.child;
  }
}