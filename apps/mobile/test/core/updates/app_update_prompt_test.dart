import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/updates/app_update_prompt.dart';
import 'package:mobile/core/updates/app_update_service.dart';

class _FakeUpdateService implements AppUpdateService {
  _FakeUpdateService({this.available = true, this.result = UpdateDownloadResult.downloaded});

  final bool available;
  final UpdateDownloadResult result;
  int downloads = 0;
  int installs = 0;

  @override
  Future<bool> isUpdateAvailable() async => available;

  @override
  Future<UpdateDownloadResult> downloadUpdate() async {
    downloads++;
    return result;
  }

  @override
  Future<void> installUpdate() async => installs++;
}

Future<void> _pump(WidgetTester tester, AppUpdateService service) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Builder(
          builder: (context) => TextButton(
            onPressed: () => promptForUpdate(context, service),
            child: const Text('check'),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('check'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('shows nothing when no update is available', (tester) async {
    final service = _FakeUpdateService(available: false);
    await _pump(tester, service);

    expect(find.text('Nueva versión disponible'), findsNothing);
  });

  testWidgets('"Ahora no" closes the dialog without downloading', (tester) async {
    final service = _FakeUpdateService();
    await _pump(tester, service);

    expect(find.text('Nueva versión disponible'), findsOneWidget);
    await tester.tap(find.text('Ahora no'));
    await tester.pumpAndSettle();

    expect(find.text('Nueva versión disponible'), findsNothing);
    expect(service.downloads, 0);
  });

  testWidgets('"Actualizar" downloads, then "Reiniciar" installs', (tester) async {
    final service = _FakeUpdateService();
    await _pump(tester, service);

    await tester.tap(find.text('Actualizar'));
    await tester.pumpAndSettle();

    expect(service.downloads, 1);
    expect(find.text('Actualización lista.'), findsOneWidget);

    await tester.tap(find.text('Reiniciar'));
    await tester.pump();
    expect(service.installs, 1);
  });

  testWidgets('a failed download shows an error and offers no restart', (tester) async {
    final service = _FakeUpdateService(result: UpdateDownloadResult.failed);
    await _pump(tester, service);

    await tester.tap(find.text('Actualizar'));
    await tester.pumpAndSettle();

    expect(find.textContaining('No se pudo descargar'), findsOneWidget);
    expect(find.text('Reiniciar'), findsNothing);
  });
}
