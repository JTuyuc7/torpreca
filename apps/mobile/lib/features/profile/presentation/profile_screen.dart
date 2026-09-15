import 'package:flutter/material.dart';

/// Placeholder for "Pantalla Perfil + cerrar sesión" (TOR-11) — not
/// implemented yet. Signing out still lives on [MapScreen]'s app bar until
/// that ticket moves it here.
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Perfil')),
      body: const Center(child: Text('Próximamente')),
    );
  }
}
