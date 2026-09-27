import 'package:flutter/material.dart';

import '../data/stop.dart';

/// Shared between `StopsScreen` and `StopDetailScreen` so both read the same
/// label/icon for a given [StopStatus].
String stopStatusLabel(StopStatus status) => switch (status) {
  StopStatus.pending => 'Pendiente',
  StopStatus.next => 'Siguiente',
  StopStatus.completed => 'Completada',
  StopStatus.delayed => 'Retrasada',
};

IconData stopStatusIcon(StopStatus status) => switch (status) {
  StopStatus.pending => Icons.radio_button_unchecked,
  StopStatus.next => Icons.navigation,
  StopStatus.completed => Icons.check_circle,
  StopStatus.delayed => Icons.error_outline,
};
