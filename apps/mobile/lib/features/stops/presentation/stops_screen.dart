import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/routes_client.dart';
import '../../../core/api/stops_client.dart';
import '../data/stop.dart';
import 'stop_detail_screen.dart';
import 'stop_status_ui.dart';

/// "Lista de paradas" (TOR-35) — the driver's stops for today's route, via
/// `GET /mobile/routes` + `GET /mobile/routes/:routeId/stops`. Tapping a stop
/// opens `StopDetailScreen` (TOR-20) to see its full detail and mark it
/// completed/delayed.
class StopsScreen extends StatefulWidget {
  const StopsScreen({super.key});

  @override
  State<StopsScreen> createState() => _StopsScreenState();
}

class _StopsScreenState extends State<StopsScreen> {
  final RoutesClient _routesClient = RoutesClient();
  final StopsClient _stopsClient = StopsClient();

  late Future<List<Stop>> _stopsFuture;

  @override
  void initState() {
    super.initState();
    _stopsFuture = _loadStops();
  }

  Future<List<Stop>> _loadStops() async {
    final accessToken = Supabase.instance.client.auth.currentSession?.accessToken;
    if (accessToken == null) return const [];

    final today = DateTime.now().toIso8601String().split('T').first;
    final route = await _routesClient.getRouteForDate(accessToken, today);
    if (route == null) return const [];

    return _stopsClient.listByRoute(accessToken, route.id);
  }

  Future<void> _refresh() async {
    final future = _loadStops();
    setState(() => _stopsFuture = future);
    await future;
  }

  Future<void> _openDetail(Stop stop) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => StopDetailScreen(stop: stop)),
    );
    // Simpler and more robust than threading the possibly-updated stop back
    // through every way of leaving StopDetailScreen (system back gesture,
    // AppBar button, etc.) — this list is cheap to refetch.
    if (mounted) _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Paradas')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<List<Stop>>(
          future: _stopsFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return _StateMessage(
                icon: Icons.wifi_off,
                title: 'No se pudieron cargar las paradas.',
                description: 'Revisa tu conexión e intenta de nuevo.',
                actionLabel: 'Reintentar',
                onAction: _refresh,
              );
            }
            final stops = snapshot.data ?? const [];
            if (stops.isEmpty) {
              return _StateMessage(
                icon: Icons.event_available_outlined,
                title: 'No tienes paradas asignadas hoy.',
                description: 'Cuando un administrador te asigne una ruta, sus paradas van a aparecer acá.',
                actionLabel: 'Actualizar',
                onAction: _refresh,
              );
            }
            return ListView.builder(
              itemCount: stops.length,
              itemBuilder: (context, index) {
                final stop = stops[index];
                return ListTile(
                  leading: Icon(stopStatusIcon(stop.status)),
                  title: Text(stop.customerName),
                  subtitle: Text(stop.address),
                  trailing: Text(stopStatusLabel(stop.status)),
                  onTap: () => _openDetail(stop),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

// A ListView (not a Center) so pull-to-refresh still works over it, plus an
// explicit action button — the pull gesture alone isn't discoverable enough
// on its own for "nothing to see yet" vs. "something went wrong".
class _StateMessage extends StatelessWidget {
  const _StateMessage({
    required this.icon,
    required this.title,
    required this.description,
    required this.actionLabel,
    required this.onAction,
  });

  final IconData icon;
  final String title;
  final String description;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 48),
          child: Column(
            children: [
              Icon(icon, size: 40, color: Theme.of(context).colorScheme.outline),
              const SizedBox(height: 12),
              Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 4),
              Text(
                description,
                textAlign: TextAlign.center,
                style: Theme.of(
                  context,
                ).textTheme.bodyLarge?.copyWith(color: Theme.of(context).colorScheme.outline),
              ),
              const SizedBox(height: 16),
              OutlinedButton(onPressed: onAction, child: Text(actionLabel)),
            ],
          ),
        ),
      ],
    );
  }
}
