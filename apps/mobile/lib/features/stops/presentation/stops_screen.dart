import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/api_exceptions.dart';
import '../../../core/api/routes_client.dart';
import '../../../core/api/stops_client.dart';
import '../../../core/widgets/state_message.dart';
import '../data/driver_route.dart';
import '../data/stop.dart';
import 'stop_detail_screen.dart';
import 'stop_status_ui.dart';

/// One of today's routes with its stops, already in route order.
class _RouteWithStops {
  const _RouteWithStops({required this.route, required this.stops});

  final DriverRoute route;
  final List<Stop> stops;

  bool get allCompleted => stops.isNotEmpty && stops.every((s) => s.status == StopStatus.completed);

  /// The stop the driver should go to next: the first one not done or
  /// postponed. Computed here because the backend never sets `next` itself.
  /// Only meaningful once the route is running.
  Stop? get nextStop {
    if (!route.isInProgress) return null;
    for (final stop in stops) {
      if (stop.status == StopStatus.pending || stop.status == StopStatus.next) return stop;
    }
    return null;
  }
}

/// "Lista de paradas" (TOR-35) — every route the driver has today (TOR-138:
/// a driver can have more than one), each as a section with its header
/// (code, status, progress, start/finish action) followed by its numbered
/// stops in route order. Loads via `GET /mobile/routes` +
/// `GET /mobile/routes/:routeId/stops`. Tapping a stop opens
/// `StopDetailScreen` (TOR-20) to see its full detail and mark it
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

  late Future<List<_RouteWithStops>> _future;

  /// Route whose start/finish request is in flight — disables its button.
  String? _busyRouteId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _future = _load();
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

  String? get _accessToken => Supabase.instance.client.auth.currentSession?.accessToken;

  Future<List<_RouteWithStops>> _load() async {
    final accessToken = _accessToken;
    if (accessToken == null) return const [];

    final today = DateTime.now().toIso8601String().split('T').first;
    final routes = await _routesClient.listForDate(accessToken, today);

    return Future.wait(
      routes.map((route) async {
        final stops = await _stopsClient.listByRoute(accessToken, route.id);
        return _RouteWithStops(route: route, stops: stops);
      }),
    );
  }

  Future<void> _refresh() async {
    final future = _load();
    // A block body, not `setState(() => _future = future)` — see the
    // identical note on DailyReportScreen._refresh().
    setState(() {
      _future = future;
    });
    await future;
  }

  Future<void> _openDetail(DriverRoute route, Stop stop) async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        // The backend doesn't stop a stop being completed on a route that
        // never started, but the app does: the route's start is what opens
        // the clock the report and the km are measured against.
        builder: (_) => StopDetailScreen(stop: stop, canAct: route.isInProgress),
      ),
    );
    // Simpler and more robust than threading the possibly-updated stop back
    // through every way of leaving StopDetailScreen (system back gesture,
    // AppBar button, etc.) — this list is cheap to refetch.
    if (mounted) _refresh();
  }

  Future<void> _startRoute(DriverRoute route) => _runRouteAction(
    route,
    (token) => _routesClient.start(token, route.id),
    failure: 'No se pudo iniciar la ruta. Intenta de nuevo.',
  );

  Future<void> _finishRoute(DriverRoute route) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('¿Finalizar ${route.code}?'),
        content: const Text(
          'Se va a cerrar la ruta y se calculará el recorrido con tu ubicación. Esto no se puede deshacer.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Finalizar'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    await _runRouteAction(
      route,
      (token) => _routesClient.finish(token, route.id),
      failure: 'No se pudo finalizar la ruta. Intenta de nuevo.',
    );
  }

  Future<void> _runRouteAction(
    DriverRoute route,
    Future<DriverRoute> Function(String accessToken) action, {
    required String failure,
  }) async {
    final accessToken = _accessToken;
    if (accessToken == null || _busyRouteId != null) return;

    setState(() => _busyRouteId = route.id);
    try {
      await action(accessToken);
    } catch (error) {
      if (!mounted) return;
      final stale = error is ApiException && error.statusCode == 409;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(stale ? 'La ruta cambió de estado. Se actualizó la lista.' : failure),
        ),
      );
    } finally {
      if (mounted) setState(() => _busyRouteId = null);
    }
    // Refetch either way: on success to show the new status, on a 409 to
    // show what the route actually is now.
    if (mounted) await _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Paradas')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<List<_RouteWithStops>>(
          future: _future,
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

            final routes = snapshot.data!;
            if (routes.isEmpty) {
              return StateMessage(
                icon: Icons.event_available_outlined,
                title: 'No tienes una ruta asignada hoy.',
                description: 'Cuando un administrador te asigne una ruta, va a aparecer acá.',
                actionLabel: 'Actualizar',
                onAction: _refresh,
              );
            }

            final anotherInProgress = routes.any((r) => r.route.isInProgress);

            return ListView(
              padding: const EdgeInsets.only(bottom: 24),
              children: [
                for (final item in routes)
                  _RouteSection(
                    item: item,
                    busy: _busyRouteId == item.route.id,
                    // Only one route runs at a time.
                    blockedByOther: anotherInProgress && !item.route.isInProgress,
                    onStart: () => _startRoute(item.route),
                    onFinish: () => _finishRoute(item.route),
                    onOpenStop: (stop) => _openDetail(item.route, stop),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

/// A route's header card followed by its stops.
class _RouteSection extends StatelessWidget {
  const _RouteSection({
    required this.item,
    required this.busy,
    required this.blockedByOther,
    required this.onStart,
    required this.onFinish,
    required this.onOpenStop,
  });

  final _RouteWithStops item;
  final bool busy;
  final bool blockedByOther;
  final VoidCallback onStart;
  final VoidCallback onFinish;
  final ValueChanged<Stop> onOpenStop;

  @override
  Widget build(BuildContext context) {
    final route = item.route;
    final stops = item.stops;
    final next = item.nextStop;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _RouteHeader(
          item: item,
          busy: busy,
          blockedByOther: blockedByOther,
          onStart: onStart,
          onFinish: onFinish,
        ),
        if (stops.isEmpty)
          const Padding(
            padding: EdgeInsets.fromLTRB(24, 4, 24, 16),
            child: Text('Esta ruta todavía no tiene paradas.'),
          )
        else
          for (var i = 0; i < stops.length; i++)
            _StopTile(
              position: i + 1,
              stop: stops[i],
              isNext: stops[i].id == next?.id,
              onTap: () => onOpenStop(stops[i]),
            ),
        if (route.isCompleted && stops.isNotEmpty) const SizedBox(height: 8),
      ],
    );
  }
}

/// Route code + status, progress, and the start/finish action.
class _RouteHeader extends StatelessWidget {
  const _RouteHeader({
    required this.item,
    required this.busy,
    required this.blockedByOther,
    required this.onStart,
    required this.onFinish,
  });

  final _RouteWithStops item;
  final bool busy;
  final bool blockedByOther;
  final VoidCallback onStart;
  final VoidCallback onFinish;

  @override
  Widget build(BuildContext context) {
    final route = item.route;
    final stops = item.stops;
    final completed = stops.where((s) => s.status == StopStatus.completed).length;
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.outline);

    return Card(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(route.code, style: theme.textTheme.titleMedium)),
                Chip(label: Text(route.statusLabel)),
              ],
            ),
            if (stops.isNotEmpty) ...[
              const SizedBox(height: 8),
              LinearProgressIndicator(value: completed / stops.length),
              const SizedBox(height: 8),
              Text('$completed de ${stops.length} paradas completadas', style: muted),
            ],
            if (route.isCompleted) ...[
              const SizedBox(height: 8),
              Text('Recorrido: ${route.drivenKm.toStringAsFixed(2)} km', style: muted),
            ],
            if (route.isPending) ...[
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: busy || stops.isEmpty || blockedByOther ? null : onStart,
                icon: busy ? const _ButtonSpinner() : const Icon(Icons.play_arrow),
                label: const Text('Iniciar ruta'),
              ),
              if (stops.isEmpty || blockedByOther) ...[
                const SizedBox(height: 8),
                Text(
                  stops.isEmpty
                      ? 'Necesita al menos una parada para poder iniciarse.'
                      : 'Finaliza la ruta en curso para iniciar esta.',
                  style: muted,
                ),
              ],
            ],
            if (route.isInProgress) ...[
              const SizedBox(height: 12),
              if (item.allCompleted)
                FilledButton.icon(
                  onPressed: busy ? null : onFinish,
                  icon: busy ? const _ButtonSpinner() : const Icon(Icons.flag),
                  label: const Text('Finalizar ruta'),
                )
              else
                Text('Completa todas las paradas para poder finalizar la ruta.', style: muted),
            ],
          ],
        ),
      ),
    );
  }
}

class _ButtonSpinner extends StatelessWidget {
  const _ButtonSpinner();

  @override
  Widget build(BuildContext context) =>
      const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2));
}

/// One numbered stop. Completed stops stay where they are (dimmed) so the
/// route's order never shifts under the driver; the next one is highlighted.
class _StopTile extends StatelessWidget {
  const _StopTile({
    required this.position,
    required this.stop,
    required this.isNext,
    required this.onTap,
  });

  final int position;
  final Stop stop;
  final bool isNext;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final done = stop.status == StopStatus.completed;
    final delayed = stop.status == StopStatus.delayed;

    return ListTile(
      tileColor: isNext ? scheme.primaryContainer.withValues(alpha: 0.5) : null,
      leading: CircleAvatar(
        radius: 16,
        backgroundColor: done
            ? scheme.primary
            : delayed
            ? scheme.errorContainer
            : isNext
            ? scheme.primary
            : scheme.surfaceContainerHighest,
        foregroundColor: done || isNext
            ? scheme.onPrimary
            : delayed
            ? scheme.onErrorContainer
            : scheme.onSurfaceVariant,
        child: done ? const Icon(Icons.check, size: 18) : Text('$position'),
      ),
      title: Text(stop.customerName, style: done ? TextStyle(color: scheme.outline) : null),
      subtitle: Text(stop.address),
      trailing: Text(
        isNext ? 'Siguiente' : stopStatusLabel(stop.status),
        style: isNext ? TextStyle(color: scheme.primary, fontWeight: FontWeight.w600) : null,
      ),
      onTap: onTap,
    );
  }
}
