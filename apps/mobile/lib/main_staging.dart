import 'main.dart';

/// Entry point for `flutter run --flavor staging -t lib/main_staging.dart`
/// (TOR-111) — points at the staging backend/Supabase project, installs as
/// its own app (`applicationIdSuffix = ".staging"`, see
/// android/app/build.gradle.kts) alongside the production flavor on the same
/// device.
Future<void> main() => bootstrap('.env.staging');
