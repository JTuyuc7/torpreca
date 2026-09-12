import 'dart:convert';

import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:mobile/core/api/mobile_auth_client.dart';

void main() {
  setUpAll(() {
    dotenv.testLoad(fileInput: 'BACKEND_URL=http://backend.test');
  });

  group('reportSession', () {
    test('200 returns ok (not blocked)', () async {
      final client = MockClient((_) async => http.Response('{}', 200));
      final result = await MobileAuthClient(client: client).reportSession('token-1');
      expect(result.isBlocked, isFalse);
    });

    test('403 with a code returns blocked with the matching reason', () async {
      final client = MockClient(
        (_) async => http.Response(jsonEncode({'code': 'PENDING_APPROVAL'}), 403),
      );
      final result = await MobileAuthClient(client: client).reportSession('token-1');
      expect(result.isBlocked, isTrue);
      expect(result.blockedReason, AccountStatusCode.pendingApproval);
    });

    test('403 without a code (e.g. wrong role) is treated leniently, not blocked', () async {
      final client = MockClient((_) async => http.Response(jsonEncode({'error': 'Access denied'}), 403));
      final result = await MobileAuthClient(client: client).reportSession('token-1');
      expect(result.isBlocked, isFalse);
    });

    test('a network failure is treated leniently, not blocked', () async {
      final client = MockClient((_) async => throw Exception('network down'));
      final result = await MobileAuthClient(client: client).reportSession('token-1');
      expect(result.isBlocked, isFalse);
    });
  });

  group('register', () {
    test('204 returns null (success)', () async {
      http.Request? captured;
      final client = MockClient((request) async {
        captured = request;
        return http.Response('', 204);
      });

      final error = await MobileAuthClient(client: client).register(
        email: 'nuevo@torpreca.com',
        password: 'password123',
        name: 'Nuevo Driver',
        signupCode: 'the-code',
      );

      expect(error, isNull);
      expect(captured!.url.toString(), 'http://backend.test/api/v1/mobile/auth/register');
      final body = jsonDecode(captured!.body) as Map<String, dynamic>;
      expect(body, {
        'email': 'nuevo@torpreca.com',
        'password': 'password123',
        'name': 'Nuevo Driver',
        'signupCode': 'the-code',
      });
    });

    test('400 returns the backend error message', () async {
      final client = MockClient(
        (_) async => http.Response(jsonEncode({'error': 'Invalid registration details'}), 400),
      );

      final error = await MobileAuthClient(client: client).register(
        email: 'nuevo@torpreca.com',
        password: 'password123',
        name: 'Nuevo Driver',
        signupCode: 'wrong-code',
      );

      expect(error, 'Invalid registration details');
    });

    test('429 returns a rate-limit message', () async {
      final client = MockClient((_) async => http.Response('', 429));

      final error = await MobileAuthClient(client: client).register(
        email: 'nuevo@torpreca.com',
        password: 'password123',
        name: 'Nuevo Driver',
        signupCode: 'the-code',
      );

      expect(error, contains('Demasiados intentos'));
    });
  });
}