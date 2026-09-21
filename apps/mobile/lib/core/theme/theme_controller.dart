import 'package:flutter/material.dart';

/// App-wide theme mode, changeable from [ProfileScreen] and read by [MyApp]
/// (main.dart) via [ValueListenableBuilder] — a single global notifier
/// instead of a state-management package, matching this app's existing
/// approach of no shared state layer (see [TrackingService]'s own
/// [ChangeNotifier] pattern for the same reasoning at a smaller scale).
/// Starts at `system` (this app's original hardcoded behavior) until
/// `_SessionGateState._verify()` in main.dart overwrites it from the
/// backend's saved preference right after login.
class ThemeController {
  ThemeController._();

  static final ValueNotifier<ThemeMode> mode = ValueNotifier(ThemeMode.system);

  static ThemeMode fromApiValue(String value) => switch (value) {
        'light' => ThemeMode.light,
        'dark' => ThemeMode.dark,
        _ => ThemeMode.system,
      };

  static String toApiValue(ThemeMode mode) => switch (mode) {
        ThemeMode.light => 'light',
        ThemeMode.dark => 'dark',
        ThemeMode.system => 'system',
      };
}
