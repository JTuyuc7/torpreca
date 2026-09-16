import 'package:flutter/material.dart';

import '../api/api_exceptions.dart';

/// Shared empty/error state for list screens — icon + title + description +
/// an explicit action button. Wrapped in a `ListView` (not a `Center`) so
/// pull-to-refresh still works over it; the button exists because the pull
/// gesture alone isn't discoverable enough on its own for "nothing to see
/// yet" vs. "something went wrong". Extracted from `StopsScreen` (TOR-35)
/// when `DailyReportScreen` (TOR-19) became the second screen to need it.
class StateMessage extends StatelessWidget {
  const StateMessage({
    super.key,
    required this.icon,
    required this.title,
    required this.description,
    required this.actionLabel,
    required this.onAction,
  });

  /// Builds the right icon/description for a `FutureBuilder.error` — a
  /// [NetworkException] ("couldn't even reach the server") reads very
  /// differently from an [ApiException] ("the server answered, just not
  /// with success"). [title] stays screen-specific since "no se pudieron
  /// cargar las paradas" reads better there than a generic message.
  factory StateMessage.forError(
    Object error, {
    required String title,
    required VoidCallback onAction,
  }) {
    final isNetwork = error is NetworkException;
    return StateMessage(
      icon: isNetwork ? Icons.wifi_off : Icons.error_outline,
      title: title,
      description: isNetwork
          ? 'Revisa tu conexión e intenta de nuevo.'
          : 'El servidor respondió con un error. Intenta de nuevo en unos minutos.',
      actionLabel: 'Reintentar',
      onAction: onAction,
    );
  }

  final IconData icon;
  final String title;
  final String description;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
          child: Column(
            children: [
              Icon(icon, size: 40, color: Theme.of(context).colorScheme.outline),
              const SizedBox(height: 12),
              Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 4),
              Text(
                description,
                textAlign: TextAlign.center,
                style: Theme.of(
                  context,
                ).textTheme.bodyLarge?.copyWith(color: Theme.of(context).colorScheme.outline),
              ),
              const SizedBox(height: 16),
              OutlinedButton(onPressed: onAction, child: Text(actionLabel)),
            ],
          ),
        ),
      ],
    );
  }
}
