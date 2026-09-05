import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/auth/data/auth_repository.dart';
import 'package:mobile/features/auth/presentation/register_screen.dart';

class _FakeAuthRepository implements AuthRepository {
  _FakeAuthRepository({this.errorMessage});

  /// Null means `register()` succeeds; non-null is returned as the failure message.
  final String? errorMessage;
  Map<String, String>? lastRegisterCall;

  @override
  Future<void> signIn({required String email, required String password}) async {}

  @override
  Future<void> signOut() async {}

  @override
  Future<String?> register({
    required String email,
    required String password,
    required String name,
    required String signupCode,
  }) async {
    lastRegisterCall = {
      'email': email,
      'password': password,
      'name': name,
      'signupCode': signupCode,
    };
    return errorMessage;
  }
}

Widget _wrap(AuthRepository repository) {
  return MaterialApp(
    theme: AppTheme.light,
    home: RegisterScreen(authRepository: repository),
  );
}

Future<void> _fillForm(WidgetTester tester) async {
  await tester.enterText(find.widgetWithText(TextFormField, 'Nombre completo'), 'Nuevo Driver');
  await tester.enterText(find.widgetWithText(TextFormField, 'Correo'), 'nuevo@torpreca.com');
  await tester.enterText(find.widgetWithText(TextFormField, 'Contraseña'), 'password123');
  await tester.enterText(find.widgetWithText(TextFormField, 'Código de invitación'), 'the-code');
}

void main() {
  testWidgets('renders all the registration fields', (tester) async {
    await tester.pumpWidget(_wrap(_FakeAuthRepository()));

    expect(find.widgetWithText(TextFormField, 'Nombre completo'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Correo'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Contraseña'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Código de invitación'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Crear cuenta'), findsOneWidget);
  });

  testWidgets('validates a too-short password before calling register()', (tester) async {
    final repository = _FakeAuthRepository();
    await tester.pumpWidget(_wrap(repository));

    await _fillForm(tester);
    await tester.enterText(find.widgetWithText(TextFormField, 'Contraseña'), 'short');
    await tester.tap(find.widgetWithText(FilledButton, 'Crear cuenta'));
    await tester.pumpAndSettle();

    expect(find.text('Debe tener al menos 8 caracteres'), findsOneWidget);
    expect(repository.lastRegisterCall, isNull);
  });

  testWidgets('on success shows the confirmation message instead of the form', (tester) async {
    final repository = _FakeAuthRepository();
    await tester.pumpWidget(_wrap(repository));

    await _fillForm(tester);
    await tester.tap(find.widgetWithText(FilledButton, 'Crear cuenta'));
    await tester.pumpAndSettle();

    expect(repository.lastRegisterCall, {
      'email': 'nuevo@torpreca.com',
      'password': 'password123',
      'name': 'Nuevo Driver',
      'signupCode': 'the-code',
    });
    expect(find.text('Solicitud enviada'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Correo'), findsNothing);
  });

  testWidgets('on failure shows the backend error message and keeps the form', (tester) async {
    final repository = _FakeAuthRepository(errorMessage: 'Invalid registration details');
    await tester.pumpWidget(_wrap(repository));

    await _fillForm(tester);
    await tester.tap(find.widgetWithText(FilledButton, 'Crear cuenta'));
    await tester.pumpAndSettle();

    expect(find.text('Invalid registration details'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Correo'), findsOneWidget);
  });
}