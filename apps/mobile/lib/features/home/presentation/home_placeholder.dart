import 'package:flutter/material.dart';

import '../../auth/data/auth_repository.dart';

/// Minimal post-login screen — proves the session persists and logout
/// works end-to-end. The real 4-tab NavigationBar shell is TOR-29, a
/// separate ticket.
class HomePlaceholder extends StatelessWidget {
  const HomePlaceholder({super.key, required this.authRepository});

  final AuthRepository authRepository;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Torpreca')),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Sesión iniciada'),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => authRepository.signOut(),
              child: const Text('Cerrar sesión'),
            ),
          ],
        ),
      ),
    );
  }
}
