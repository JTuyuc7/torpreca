import 'package:flutter/material.dart';

/// Design System V2 tokens (Notion -> Sistema de Diseño), copied 1:1.
/// Keep in sync with apps/dashboard/app/globals.css if either changes.
class AppColors {
  AppColors._();

  static const light = AppPalette(
    background: Color(0xFFFFFBFE),
    surface: Color(0xFFEEF4FB),
    primary: Color(0xFF00529E),
    secondary: Color(0xFFEA7016),
    secondaryHover: Color(0xFFDE6E20),
    text: Color(0xFF1C1B1F),
    outline: Color(0xFF79747E),
    error: Color(0xFFB3261E),
  );

  static const dark = AppPalette(
    background: Color(0xFF0C1929),
    surface: Color(0xFF152639),
    primary: Color(0xFF7DC0F5),
    secondary: Color(0xFFFFB06B),
    secondaryHover: Color(0xFFFFB06B),
    text: Color(0xFFE6E1E5),
    outline: Color(0xFF8BAFC8),
    error: Color(0xFFF2B8B5),
  );
}

class AppPalette {
  const AppPalette({
    required this.background,
    required this.surface,
    required this.primary,
    required this.secondary,
    required this.secondaryHover,
    required this.text,
    required this.outline,
    required this.error,
  });

  final Color background;
  final Color surface;
  final Color primary;
  final Color secondary;
  final Color secondaryHover;
  final Color text;
  final Color outline;
  final Color error;
}
