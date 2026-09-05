import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../auth/data/auth_repository.dart';
import '../../tracking/data/tracking_service.dart';

/// Minimal post-login screen — proves the session persists and logout
/// works end-to-end. The real 4-tab NavigationBar shell is TOR-29, a
/// separate ticket.
///
/// Also hosts a manual "start/stop tracking" toggle wired to
/// [TrackingService] (TOR-18) — there's no map screen yet (that's a later
/// ticket), so this is the only way to exercise the `/ws` pipe end-to-end
/// until the real tracking screen lands.
class HomePlaceholder extends StatefulWidget {
  const HomePlaceholder({super.key, required this.authRepository});

  final AuthRepository authRepository;

  @override
  State<HomePlaceholder> createState() => _HomePlaceholderState();
}

class _HomePlaceholderState extends State<HomePlaceholder> {
  final TrackingService _trackingService = TrackingService();

  @override
  void dispose() {
    _trackingService.dispose();
    super.dispose();
  }

  Future<void> _toggleTracking() async {
    if (_trackingService.status == TrackingStatus.tracking ||
        _trackingService.status == TrackingStatus.connecting) {
      await _trackingService.stop();
      return;
    }

    final accessToken = Supabase.instance.client.auth.currentSession?.accessToken;
    if (accessToken == null) return;
    await _trackingService.start(accessToken);
  }

  String _statusLabel(TrackingStatus status) {
    switch (status) {
      case TrackingStatus.idle:
        return 'Detenido';
      case TrackingStatus.connecting:
        return 'Conectando...';
      case TrackingStatus.tracking:
        return 'Rastreando';
      case TrackingStatus.error:
        return 'Error: ${_trackingService.errorMessage}';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Torpreca')),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Sesión iniciada'),
            const SizedBox(height: 24),
            ListenableBuilder(
              listenable: _trackingService,
              builder: (context, _) {
                final status = _trackingService.status;
                final isActive =
                    status == TrackingStatus.tracking || status == TrackingStatus.connecting;
                final pending = _trackingService.pendingCount;
                return Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_statusLabel(status)),
                    if (pending > 0) ...[
                      const SizedBox(height: 4),
                      Text('$pending sin sincronizar'),
                    ],
                    const SizedBox(height: 8),
                    FilledButton(
                      onPressed: _toggleTracking,
                      child: Text(isActive ? 'Detener seguimiento' : 'Iniciar seguimiento'),
                    ),
                    if (status == TrackingStatus.error &&
                        _trackingService.isLocationServicesDisabled) ...[
                      const SizedBox(height: 8),
                      OutlinedButton(
                        onPressed: () => Geolocator.openLocationSettings(),
                        child: const Text('Abrir ajustes de ubicación'),
                      ),
                    ],
                  ],
                );
              },
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () => widget.authRepository.signOut(),
              child: const Text('Cerrar sesión'),
            ),
          ],
        ),
      ),
    );
  }
}
