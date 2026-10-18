import 'package:flutter/material.dart';

import 'app_update_service.dart';

/// Asks Google Play whether a newer version exists and, if so, tells the
/// driver with a dialog. "Actualizar" downloads it in the background (flexible
/// flow — the app stays usable, which matters mid-route) and, once it's ready,
/// a snackbar offers the restart that installs it. "Ahora no" just closes the
/// dialog; it shows again the next time the app is opened.
Future<void> promptForUpdate(BuildContext context, AppUpdateService service) async {
  if (!await service.isUpdateAvailable()) return;
  if (!context.mounted) return;

  final accepted = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Nueva versión disponible'),
      content: const Text(
        'Hay una versión nueva de Torpreca con mejoras y correcciones. '
        'Se descarga en segundo plano y puedes seguir usando la app.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Ahora no'),
        ),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: const Text('Actualizar'),
        ),
      ],
    ),
  );
  if (accepted != true || !context.mounted) return;

  final messenger = ScaffoldMessenger.of(context);
  messenger.showSnackBar(const SnackBar(content: Text('Descargando la actualización…')));

  final result = await service.downloadUpdate();
  messenger.hideCurrentSnackBar();
  switch (result) {
    case UpdateDownloadResult.downloaded:
      messenger.showSnackBar(
        SnackBar(
          duration: const Duration(days: 1),
          content: const Text('Actualización lista.'),
          action: SnackBarAction(label: 'Reiniciar', onPressed: service.installUpdate),
        ),
      );
    case UpdateDownloadResult.failed:
      messenger.showSnackBar(
        const SnackBar(content: Text('No se pudo descargar la actualización. Intenta más tarde.')),
      );
    case UpdateDownloadResult.declined:
      break;
  }
}
