import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/routes_client.dart';
import '../../../core/api/stops_client.dart';
import '../data/stop.dart';

/// "Lista de paradas" (TOR-35) — the driver's stops for today's route, via
/// `GET /mobile/routes` + `GET /mobile/routes/:routeId/stops`. Tapping a stop
/// to see its detail or mark it complete is "Detalle de parada" (TOR-20), a
/// separate ticket.
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

  String _statusLabel(StopStatus status) => switch (status) {
    StopStatus.pending => 'Pendiente',
    StopStatus.next => 'Siguiente',
    StopStatus.completed => 'Completada',
    StopStatus.delayed => 'Retrasada',
  };

  IconData _statusIcon(StopStatus status) => switch (status) {
    StopStatus.pending => Icons.radio_button_unchecked,
    StopStatus.next => Icons.navigation,
    StopStatus.completed => Icons.check_circle,
    StopStatus.delayed => Icons.error_outline,
  };

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
              return _messageList('No se pudieron cargar las paradas.');
            }
            final stops = snapshot.data ?? const [];
            if (stops.isEmpty) {
              return _messageList('No tienes paradas asignadas hoy.');
            }
            return ListView.builder(
              itemCount: stops.length,
              itemBuilder: (context, index) {
                final stop = stops[index];
                return ListTile(
                  leading: Icon(_statusIcon(stop.status)),
                  title: Text(stop.customerName),
                  subtitle: Text(stop.address),
                  trailing: Text(_statusLabel(stop.status)),
                );
              },
            );
          },
        ),
      ),
    );
  }

  // A ListView (not a Center) so pull-to-refresh still works when the list
  // has nothing to show yet.
  Widget _messageList(String message) {
    return ListView(
      children: [Padding(padding: const EdgeInsets.all(24), child: Center(child: Text(message)))],
    );
  }
}
