import 'main.dart';

/// Entry point for `flutter run --flavor production -t lib/main_production.dart`
/// (TOR-111) — the `production` flavor keeps the app's original
/// `applicationId` (`com.torpreca.mobile`) and release signing config, so
/// this is exactly the build that ships to Play Store. See `.env.production`
/// for why it still points at the staging backend/Supabase project today.
Future<void> main() => bootstrap('.env.production');
