import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:in_app_update/in_app_update.dart';

/// Result of asking Google Play to download an update.
enum UpdateDownloadResult { downloaded, declined, failed }

/// What the update prompt needs from Google Play — a seam so tests can stand
/// in for the real in-app updates API (which only works on a Play install).
abstract class AppUpdateService {
  /// Whether Play has a newer version this install can update to in the
  /// background (flexible flow). Never throws: any failure means "no".
  Future<bool> isUpdateAvailable();

  /// Downloads the update in the background (Play shows its own consent UI).
  Future<UpdateDownloadResult> downloadUpdate();

  /// Installs the downloaded update — restarts the app.
  Future<void> installUpdate();
}

/// Play In-App Updates, flexible flow. Only does anything on an Android
/// install that came from the Play Store: sideloaded APKs, `flutter run`
/// builds and every other platform just report "no update".
class PlayAppUpdateService implements AppUpdateService {
  const PlayAppUpdateService();

  @override
  Future<bool> isUpdateAvailable() async {
    if (kIsWeb || !Platform.isAndroid) return false;
    try {
      final info = await InAppUpdate.checkForUpdate();
      return info.updateAvailability == UpdateAvailability.updateAvailable &&
          info.flexibleUpdateAllowed;
    } catch (_) {
      // Not installed from Play, no Play Services, offline… — an update
      // prompt is a nicety, never worth surfacing an error for.
      return false;
    }
  }

  @override
  Future<UpdateDownloadResult> downloadUpdate() async {
    try {
      final result = await InAppUpdate.startFlexibleUpdate();
      return switch (result) {
        AppUpdateResult.success => UpdateDownloadResult.downloaded,
        AppUpdateResult.userDeniedUpdate => UpdateDownloadResult.declined,
        AppUpdateResult.inAppUpdateFailed => UpdateDownloadResult.failed,
      };
    } catch (_) {
      return UpdateDownloadResult.failed;
    }
  }

  @override
  Future<void> installUpdate() => InAppUpdate.completeFlexibleUpdate();
}
