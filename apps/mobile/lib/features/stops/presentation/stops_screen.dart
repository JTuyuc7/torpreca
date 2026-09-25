import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/routes_client.dart';
import '../../../core/api/stops_client.dart';
import '../../../core/widgets/state_message.dart';
import '../data/stop.dart';
import 'stop_detail_screen.dart';
import 'stop_status_ui.dart';

/// "Lista de paradas" (TOR-35) — the driver's stops for today's route, via
/// `GET /mobile/routes` + `GET /mobile/routes/:routeId/stops`. Tapping a stop
/// opens `StopDetailScreen` (TOR-20) to see its full detail and mark it
/// completed/delayed.
///
/// Refetches (TOR-136) whenever the driver comes back to it — [isActive]
/// flipping to true when they re-select this tab, or the app resuming from
/// the background — because `HomeShell` keeps tabs alive in an
/// `IndexedStack`, so `initState` alone would leave a route assigned after
/// the first load invisible until they pulled to refresh by hand.
class StopsScreen extends StatefulWidget {
  const StopsScreen({super.key, this.isActive = true});

  /// Whether this tab is the one currently shown by `HomeShell`.
  final bool isActive;

  @override
  State<StopsScreen> createState() => _StopsScreenState();
}

class _StopsScreenState extends State<StopsScreen> with WidgetsBindingObserver {
  final RoutesClient _routesClient = RoutesClient();
  final StopsClient _stopsClient = StopsClient();

  late Future<List<Stop>> _stopsFuture;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _stopsFuture = _loadStops();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didUpdateWidget(StopsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive && !oldWidget.isActive) _refresh();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && widget.isActive) _refresh();
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
    // A block body, not `setState(() => _stopsFuture = future)` — see the
    // identical note on DailyReportScreen._refresh().
    setState(() {
      _stopsFuture = future;
    });
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
              return StateMessage.forError(
                snapshot.error!,
                title: 'No se pudieron cargar las paradas.',
                onAction: _refresh,
              );
            }
            final stops = snapshot.data ?? const [];
            if (stops.isEmpty) {
              return StateMessage(
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
