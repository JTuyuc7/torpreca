import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/auth/data/auth_repository.dart';
import 'package:mobile/features/auth/presentation/login_screen.dart';

class _FakeAuthRepository implements AuthRepository {
  _FakeAuthRepository({this.shouldFail = false});

  final bool shouldFail;
  bool signInCalled = false;

  @override
  Future<void> signIn({required String email, required String password}) async {
    signInCalled = true;
    await Future.delayed(const Duration(milliseconds: 50));
    if (shouldFail) {
      throw Exception('invalid credentials');
    }
  }

  @override
  Future<void> signOut() async {}

  @override
  Future<String?> register({
    required String email,
    required String password,
    required String name,
    required String signupCode,
  }) async => null;
}

Widget _wrap(AuthRepository repository) {
  return MaterialApp(
    theme: AppTheme.light,
    home: LoginScreen(authRepository: repository),
  );
}

void main() {
  testWidgets('renders email and password fields plus the submit button', (tester) async {
    await tester.pumpWidget(_wrap(_FakeAuthRepository()));

    expect(find.widgetWithText(TextFormField, 'Correo'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Contraseña'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Ingresar'), findsOneWidget);
  });

  testWidgets('shows a loading indicator while signing in', (tester) async {
    await tester.pumpWidget(_wrap(_FakeAuthRepository()));

    await tester.enterText(find.widgetWithText(TextFormField, 'Correo'), 'driver@torpreca.com');
    await tester.enterText(find.widgetWithText(TextFormField, 'Contraseña'), 'password123');
    await tester.tap(find.widgetWithText(FilledButton, 'Ingresar'));
    await tester.pump();

    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    await tester.pumpAndSettle();
  });

  testWidgets('shows an error message when sign in fails', (tester) async {
    final repository = _FakeAuthRepository(shouldFail: true);
    await tester.pumpWidget(_wrap(repository));

    await tester.enterText(find.widgetWithText(TextFormField, 'Correo'), 'driver@torpreca.com');
    await tester.enterText(find.widgetWithText(TextFormField, 'Contraseña'), 'wrong');
    await tester.tap(find.widgetWithText(FilledButton, 'Ingresar'));
    await tester.pumpAndSettle();

    expect(repository.signInCalled, isTrue);
    expect(find.text('No se pudo iniciar sesión. Intenta de nuevo.'), findsOneWidget);
  });

  testWidgets('tapping "Regístrate" navigates to RegisterScreen', (tester) async {
    await tester.pumpWidget(_wrap(_FakeAuthRepository()));

    await tester.tap(find.text('¿No tienes cuenta? Regístrate'));
    await tester.pumpAndSettle();

    expect(find.text('Crear cuenta'), findsWidgets);
    expect(find.widgetWithText(TextFormField, 'Código de invitación'), findsOneWidget);
  });
}
