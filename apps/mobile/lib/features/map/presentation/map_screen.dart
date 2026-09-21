import 'package:flutter/material.dart';
// Both packages export a `Position` and geolocator also exports its own
// `LocationSettings` — different shapes, same names as mapbox_maps_flutter's.
// Prefixed to keep every reference unambiguous.
import 'package:geolocator/geolocator.dart' as geo;
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../tracking/data/tracking_service.dart';

/// Guatemala City — same fallback center as the dashboard's live map
/// (TOR-12) for when the device's own position isn't available yet (denied
/// permission, GPS off, or still resolving the first fix).
Point get _fallbackCenter => Point(coordinates: Position(-90.5069, 14.6349));

/// "Mapa principal" (TOR-22) — the driver's real post-login screen,
/// replacing the old placeholder. Centers on the device's current position
/// and shows Mapbox's own location puck (device GPS, independent of
/// [TrackingService]'s pings to the backend) plus the existing
/// start/stop tracking control from TOR-18, now as a bottom overlay card
/// instead of the whole screen's content.
///
/// Deliberately does not show the driver's assigned route or its stops yet
/// — that's "Lista de paradas" (TOR-35) and "Detalle de parada" (TOR-20),
/// separate tickets.
class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final TrackingService _trackingService = TrackingService();

  Point? _initialCenter;

  @override
  void initState() {
    super.initState();
    _resolveInitialPosition();
  }

  @override
  void dispose() {
    _trackingService.dispose();
    super.dispose();
  }

  Future<void> _resolveInitialPosition() async {
    try {
      var permission = await geo.Geolocator.checkPermission();
      if (permission == geo.LocationPermission.denied) {
        permission = await geo.Geolocator.requestPermission();
      }
      if (permission == geo.LocationPermission.denied ||
          permission == geo.LocationPermission.deniedForever ||
          !await geo.Geolocator.isLocationServiceEnabled()) {
        setState(() => _initialCenter = _fallbackCenter);
        return;
      }

      final position = await geo.Geolocator.getCurrentPosition(
        locationSettings: const geo.LocationSettings(accuracy: geo.LocationAccuracy.high),
      );
      if (!mounted) return;
      setState(() {
        _initialCenter = Point(coordinates: Position(position.longitude, position.latitude));
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _initialCenter = _fallbackCenter);
    }
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
        return _trackingService.errorMessage ?? 'Ocurrió un error al iniciar el rastreo.';
    }
  }

  void _onMapCreated(MapboxMap mapboxMap) {
    mapboxMap.location.updateSettings(
      LocationComponentSettings(enabled: true, pulsingEnabled: true),
    );
  }

  @override
  Widget build(BuildContext context) {
    final initialCenter = _initialCenter;

    return Scaffold(
      // TOR-11: logout moved to the Perfil tab — this app bar no longer
      // needs an authRepository, so the constructor param was dropped too.
      appBar: AppBar(title: const Text('Torpreca')),
      body: initialCenter == null
          ? const Center(child: CircularProgressIndicator())
          : Stack(
              children: [
                MapWidget(
                  cameraOptions: CameraOptions(center: initialCenter, zoom: 15),
                  onMapCreated: _onMapCreated,
                ),
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: 16,
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: ListenableBuilder(
                        listenable: _trackingService,
                        builder: (context, _) {
                          final status = _trackingService.status;
                          final isActive = status == TrackingStatus.tracking ||
                              status == TrackingStatus.connecting;
                          final pending = _trackingService.pendingCount;
                          return Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(_statusLabel(status)),
                                    if (pending > 0)
                                      Text(
                                        '$pending sin sincronizar',
                                        style: Theme.of(context).textTheme.bodySmall,
                                      ),
                                    if (status == TrackingStatus.error &&
                                        _trackingService.isLocationServicesDisabled)
                                      TextButton(
                                        onPressed: () => geo.Geolocator.openLocationSettings(),
                                        child: const Text('Abrir ajustes de ubicación'),
                                      ),
                                  ],
                                ),
                              ),
                              FilledButton(
                                onPressed: _toggleTracking,
                                child: Text(isActive ? 'Detener' : 'Iniciar'),
                              ),
                            ],
                          );
                        },
                      ),
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}