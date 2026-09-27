import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/api_exceptions.dart';
import '../../../core/api/routes_client.dart';
import '../../../core/api/stops_client.dart';
import '../../../core/widgets/state_message.dart';
import '../../tracking/data/tracking_service.dart';
import '../data/driver_route.dart';
import '../data/next_stop_controller.dart';
import '../data/stop.dart';
import 'route_history_screen.dart';
import 'stop_detail_screen.dart';
import 'stop_status_ui.dart';

/// Within this many meters of the next stop the driver is offered a one-tap
/// "mark completed" — GPS is only good to ~10–30 m, and a delivery stop can
/// be a big yard, so it's deliberately generous. Manual completion from the
/// stop's detail screen stays available at any distance.
const double _arrivalRadiusMeters = 100;

/// One of the driver's routes with its stops, already in route order — one of
/// today's, or one left running on a previous day ([stale]).
class _RouteWithStops {
  const _RouteWithStops({required this.route, required this.stops, required this.stale});

  final DriverRoute route;
  final List<Stop> stops;

  /// Started on a previous day and never finished (see [DriverRoute.isStale]).
  final bool stale;

  /// Every stop was either completed or postponed — nothing left to do, so
  /// the route can be finished. A postponed stop stays "delayed" (it wasn't
  /// visited) but no longer blocks closing the route.
  bool get allResolved =>
      stops.isNotEmpty &&
      stops.every((s) => s.status == StopStatus.completed || s.status == StopStatus.delayed);

  /// The stop the driver should go to next: the first one not done or
  /// postponed. Computed here because the backend never sets `next` itself.
  /// Only meaningful while today's route is running.
  Stop? get nextStop {
    if (!route.isInProgress || stale) return null;
    for (final stop in stops) {
      if (stop.status == StopStatus.pending || stop.status == StopStatus.next) return stop;
    }
    return null;
  }

  _RouteWithStops copyWith({DriverRoute? route, List<Stop>? stops, bool? stale}) => _RouteWithStops(
    route: route ?? this.route,
    stops: stops ?? this.stops,
    stale: stale ?? this.stale,
  );
}

/// Active work first: the running route, then the pending ones, then what's
/// already finished. Inside each group the newest route comes first, so one
/// just created shows up at the top instead of at the bottom.
int _groupRank(DriverRoute route) => route.isInProgress
    ? 0
    : route.isPending
    ? 1
    : 2;

List<_RouteWithStops> _sortRoutes(Iterable<_RouteWithStops> routes) {
  return routes.toList()..sort((a, b) {
    final byGroup = _groupRank(a.route).compareTo(_groupRank(b.route));
    return byGroup != 0 ? byGroup : b.route.createdAt.compareTo(a.route.createdAt);
  });
}

/// "Lista de paradas" (TOR-35) — every route the driver has today (TOR-138:
/// a driver can have more than one) plus any left running on a previous day,
/// each as its own card with its header (code, status, progress,
/// start/finish action) followed by its numbered stops in route order.
/// Loads via `GET /mobile/routes` + `GET /mobile/routes/:routeId/stops`.
/// Tapping a stop opens `StopDetailScreen` (TOR-20) to see its full detail and
/// mark it completed/delayed.
///
/// The loaded routes live in this state (not in a `FutureBuilder`): every
/// refetch after the first one is silent — the list stays on screen and is
/// swapped when fresh data arrives, instead of blanking to a spinner — and
/// what the driver just did (complete a stop, start/finish a route) is applied
/// locally from the response the backend already returned, with no refetch at
/// all.
///
/// A full refetch (TOR-136) still happens whenever the driver comes back to
/// the tab — [isActive] flipping to true — or the app resumes from the
/// background, because `HomeShell` keeps tabs alive in an `IndexedStack` and
/// a route assigned meanwhile would otherwise stay invisible.
class StopsScreen extends StatefulWidget {
  const StopsScreen({
    super.key,
    required this.trackingService,
    required this.nextStopController,
    this.isActive = true,
  });

  /// The app-wide tracking session (owned by `HomeShell`). "Iniciar ruta"
  /// turns it on — the kilometers are measured from its GPS pings — and its
  /// last position feeds the distance to the next stop.
  final TrackingService trackingService;

  /// Where the running route's next stop is published for the Mapa tab.
  final NextStopController nextStopController;

  /// Whether this tab is the one currently shown by `HomeShell`.
  final bool isActive;

  @override
  State<StopsScreen> createState() => _StopsScreenState();
}

class _StopsScreenState extends State<StopsScreen> with WidgetsBindingObserver {
  final RoutesClient _routesClient = RoutesClient();
  final StopsClient _stopsClient = StopsClient();

  /// Null until the first load finishes.
  List<_RouteWithStops>? _routes;

  /// Why the first load failed; only shown while there's nothing to show.
  Object? _error;

  /// Route whose start/finish request is in flight — disables its button.
  String? _busyRouteId;

  /// Stop being completed from the next-stop card — disables its button.
  String? _busyStopId;

  /// Bumped per load so a slow, older response can't overwrite a newer one.
  int _loadSeq = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _refresh();
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

  String get _today => DateTime.now().toIso8601String().split('T').first;

  Future<List<_RouteWithStops>> _load(List<_RouteWithStops>? previous) async {
    final accessToken = _accessToken;
    if (accessToken == null) return const [];

    final today = _today;
    final results = await Future.wait([
      _routesClient.listForDate(accessToken, today),
      // Routes left running on an earlier day: without this they'd be
      // invisible (the list is by date) and nothing could ever close them.
      _routesClient.listInProgress(accessToken),
    ]);
    final byId = {
      for (final route in [...results[1], ...results[0]]) route.id: route,
    };
    final before = {for (final item in previous ?? const <_RouteWithStops>[]) item.route.id: item};

    final loaded = await Future.wait(
      byId.values.map((route) async {
        final known = before[route.id];
        // A finished route's stops can't change anymore — reuse them instead
        // of one more request per finished route on every refresh.
        final stops = known != null && route.isFinished && known.route.status == route.status
            ? known.stops
            : await _stopsClient.listByRoute(accessToken, route.id);
        return _RouteWithStops(route: route, stops: stops, stale: route.isStale(today));
      }),
    );

    // A route already running (e.g. the app was closed mid-route) with
    // tracking off would measure 0 km — bring tracking back up. Only from
    // `idle`: after a failure the driver retries explicitly, so a denied
    // permission doesn't re-prompt on every refresh.
    if (loaded.any((r) => r.route.isInProgress && !r.stale) &&
        widget.trackingService.status == TrackingStatus.idle) {
      unawaited(_ensureTracking());
    }
    return _sortRoutes(loaded);
  }

  /// The in-flight [_ensureTracking], if any.
  Future<void>? _trackingStart;

  /// Starts tracking if it isn't running. A failure (permission denied, GPS
  /// off) doesn't undo the route start — it's surfaced in the next-stop card,
  /// which offers a retry.
  ///
  /// Concurrent callers (the post-start refetch also looks for a running
  /// route with tracking off) share one in-flight start, so the caller that
  /// reports errors sees the real outcome instead of the early "already
  /// connecting" return.
  Future<void> _ensureTracking() {
    final pending = _trackingStart;
    if (pending != null) return pending;

    final accessToken = _accessToken;
    if (accessToken == null || widget.trackingService.isActive) return Future.value();
    return _trackingStart = widget.trackingService
        .start(accessToken)
        .whenComplete(() => _trackingStart = null);
  }

  /// Reloads everything, keeping what's on screen until the new data lands.
  Future<void> _refresh() async {
    final seq = ++_loadSeq;
    try {
      final loaded = await _load(_routes);
      if (!mounted || seq != _loadSeq) return;
      setState(() {
        _routes = loaded;
        _error = null;
      });
      _publishNextStop();
    } catch (error) {
      if (!mounted || seq != _loadSeq) return;
      // With data already on screen a failed background refresh just keeps
      // it; only the very first load has nothing else to show.
      if (_routes == null) setState(() => _error = error);
    }
  }

  /// Tells the Mapa tab where the driver is headed: the next stop of the
  /// route running today (null when there is none).
  void _publishNextStop() {
    NextStopInfo? info;
    for (final item in _routes ?? const <_RouteWithStops>[]) {
      final next = item.nextStop;
      if (next == null) continue;
      info = NextStopInfo(
        routeCode: item.route.code,
        stopId: next.id,
        customerName: next.customerName,
        address: next.address,
        lat: next.lat,
        lng: next.lng,
      );
      break;
    }
    widget.nextStopController.value = info;
  }

  void _openHistory() {
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const RouteHistoryScreen()));
  }

  void _applyStop(String routeId, Stop updated) {
    final routes = _routes;
    if (routes == null) return;
    setState(() {
      _routes = [
        for (final item in routes)
          if (item.route.id == routeId)
            item.copyWith(stops: [for (final s in item.stops) s.id == updated.id ? updated : s])
          else
            item,
      ];
    });
    _publishNextStop();
  }

  void _applyRoute(DriverRoute updated) {
    final routes = _routes;
    if (routes == null) return;
    final today = _today;
    setState(() {
      _routes = _sortRoutes([
        for (final item in routes)
          if (item.route.id == updated.id)
            item.copyWith(route: updated, stale: updated.isStale(today))
          else
            item,
      ]);
    });
    _publishNextStop();
  }

  Future<void> _openDetail(DriverRoute route, Stop stop) async {
    final updated = await Navigator.of(context).push<Stop>(
      MaterialPageRoute<Stop>(
        // The backend rejects completing a stop unless the route is running,
        // and the route's start is what opens the clock the report and the
        // km are measured against — so the app doesn't offer it before.
        builder: (_) => StopDetailScreen(stop: stop, canAct: route.isInProgress),
      ),
    );
    // The detail screen hands back the stop as it left it, so the list is
    // patched in place — no refetch of every route just to see one stop change.
    if (mounted && updated != null && updated.status != stop.status) {
      _applyStop(route.id, updated);
    }
  }

  Future<void> _startRoute(DriverRoute route) async {
    final started = await _runRouteAction(
      route,
      (token) => _routesClient.start(token, route.id),
      failure: 'No se pudo iniciar la ruta. Intenta de nuevo.',
    );
    if (!started || !mounted) return;

    // The route's km come from GPS pings, so it must not run untracked.
    await _ensureTracking();
    if (!mounted || widget.trackingService.status != TrackingStatus.error) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          widget.trackingService.errorMessage ??
              'No se pudo activar el rastreo. Los km de la ruta podrían quedar en 0.',
        ),
      ),
    );
  }

  /// One-tap completion from the next-stop card, once the driver is close.
  Future<void> _completeStop(DriverRoute route, Stop stop) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('¿Completar ${stop.customerName}?'),
        content: const Text('La parada se marcará como completada. Esto no se puede deshacer.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Completar'),
          ),
        ],
      ),
    );
    final accessToken = _accessToken;
    if (confirmed != true || accessToken == null || _busyStopId != null) return;

    setState(() => _busyStopId = stop.id);
    try {
      final updated = await _stopsClient.complete(accessToken, stop.id);
      if (mounted) _applyStop(route.id, updated);
    } catch (error) {
      if (mounted) {
        // A 409 means the stop or route already moved on elsewhere.
        final stale = error is ApiException && error.statusCode == 409;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              stale
                  ? 'La parada ya cambió de estado. Se actualizó la lista.'
                  : 'No se pudo actualizar la parada. Intenta de nuevo.',
            ),
          ),
        );
        if (stale) unawaited(_refresh());
      }
    } finally {
      if (mounted) setState(() => _busyStopId = null);
    }
  }

  Future<void> _finishRoute(DriverRoute route, {required bool stale}) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('¿Finalizar ${route.code}?'),
        content: Text(
          stale
              ? 'Se va a cerrar la ruta y se calculará el recorrido con tu ubicación solo hasta el final del ${route.date}. Esto no se puede deshacer.'
              : 'Se va a cerrar la ruta y se calculará el recorrido con tu ubicación. Esto no se puede deshacer.',
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

  /// "Cerrar sin completar" for a route left running on a previous day whose
  /// stops weren't all resolved.
  Future<void> _closeRoute(DriverRoute route) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('¿Cerrar ${route.code} sin completar?'),
        content: Text(
          'La ruta es del ${route.date} y quedó abierta. Se cerrará como no completada y solo se contarán los km hasta el final de ese día. Esto no se puede deshacer.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Cerrar ruta'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    await _runRouteAction(
      route,
      (token) => _routesClient.close(token, route.id),
      failure: 'No se pudo cerrar la ruta. Intenta de nuevo.',
    );
  }

  /// Returns whether [action] succeeded. On success the route the backend
  /// sent back replaces the one in the list; only a 409 (the route changed
  /// state somewhere else) reloads, to show what it actually is now.
  Future<bool> _runRouteAction(
    DriverRoute route,
    Future<DriverRoute> Function(String accessToken) action, {
    required String failure,
  }) async {
    final accessToken = _accessToken;
    if (accessToken == null || _busyRouteId != null) return false;

    setState(() => _busyRouteId = route.id);
    try {
      final updated = await action(accessToken);
      if (mounted) _applyRoute(updated);
      return true;
    } catch (error) {
      if (!mounted) return false;
      final stale = error is ApiException && error.statusCode == 409;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(stale ? 'La ruta cambió de estado. Se actualizó la lista.' : failure),
        ),
      );
      if (stale) unawaited(_refresh());
      return false;
    } finally {
      if (mounted) setState(() => _busyRouteId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Paradas'),
        actions: [
          IconButton(
            tooltip: 'Rutas anteriores',
            onPressed: _openHistory,
            icon: const Icon(Icons.history),
          ),
        ],
      ),
      body: RefreshIndicator(onRefresh: _refresh, child: _buildBody()),
    );
  }

  Widget _buildBody() {
    final routes = _routes;
    if (routes == null) {
      final error = _error;
      if (error == null) return const Center(child: CircularProgressIndicator());
      return StateMessage.forError(
        error,
        title: 'No se pudieron cargar las paradas.',
        onAction: () {
          setState(() => _error = null);
          _refresh();
        },
      );
    }

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

    // Rebuilds on every tracking ping so the next-stop distance stays live.
    return ListenableBuilder(
      listenable: widget.trackingService,
      builder: (context, _) => ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: [
          for (final item in routes)
            _RouteSection(
              // Keeps each card's own expanded/collapsed state when the list
              // reorders (e.g. a route finishes and moves down).
              key: ValueKey(item.route.id),
              item: item,
              tracking: widget.trackingService,
              busy: _busyRouteId == item.route.id,
              completingStopId: _busyStopId,
              // Only one route runs at a time.
              blockedByOther: anotherInProgress && !item.route.isInProgress,
              onStart: () => _startRoute(item.route),
              onFinish: () => _finishRoute(item.route, stale: item.stale),
              onClose: () => _closeRoute(item.route),
              onOpenStop: (stop) => _openDetail(item.route, stop),
              onCompleteStop: (stop) => _completeStop(item.route, stop),
              onEnableTracking: _ensureTracking,
            ),
        ],
      ),
    );
  }
}

/// One route as a single card: its header, the next-stop panel while it runs,
/// and its numbered stops — so it's clear which stops belong to which route.
/// A finished route starts collapsed to just its header (it's history, and
/// several of them would push the active route off the screen); tap it to
/// expand.
class _RouteSection extends StatefulWidget {
  const _RouteSection({
    super.key,
    required this.item,
    required this.tracking,
    required this.busy,
    required this.completingStopId,
    required this.blockedByOther,
    required this.onStart,
    required this.onFinish,
    required this.onClose,
    required this.onOpenStop,
    required this.onCompleteStop,
    required this.onEnableTracking,
  });

  final _RouteWithStops item;
  final TrackingService tracking;
  final bool busy;
  final String? completingStopId;
  final bool blockedByOther;
  final VoidCallback onStart;
  final VoidCallback onFinish;
  final VoidCallback onClose;
  final ValueChanged<Stop> onOpenStop;
  final ValueChanged<Stop> onCompleteStop;
  final VoidCallback onEnableTracking;

  @override
  State<_RouteSection> createState() => _RouteSectionState();
}

class _RouteSectionState extends State<_RouteSection> {
  late bool _expanded = !widget.item.route.isFinished;

  @override
  void didUpdateWidget(_RouteSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    // A route that just finished folds away; one that became active opens.
    final wasFinished = oldWidget.item.route.isFinished;
    final isFinished = widget.item.route.isFinished;
    if (wasFinished != isFinished) _expanded = !isFinished;
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final route = item.route;
    final stops = item.stops;
    final next = item.nextStop;
    final collapsible = route.isFinished;

    return Card(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: collapsible ? () => setState(() => _expanded = !_expanded) : null,
            child: _RouteHeader(
              item: item,
              busy: widget.busy,
              blockedByOther: widget.blockedByOther,
              expanded: _expanded,
              collapsible: collapsible,
              onStart: widget.onStart,
              onFinish: widget.onFinish,
              onClose: widget.onClose,
            ),
          ),
          if (_expanded) ...[
            if (next != null)
              _NextStopPanel(
                stop: next,
                tracking: widget.tracking,
                completing: widget.completingStopId == next.id,
                onComplete: () => widget.onCompleteStop(next),
                onEnableTracking: widget.onEnableTracking,
              ),
            const Divider(height: 1),
            if (stops.isEmpty)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text('Esta ruta todavía no tiene paradas.'),
              )
            else
              for (var i = 0; i < stops.length; i++)
                _StopTile(
                  position: i + 1,
                  stop: stops[i],
                  isNext: stops[i].id == next?.id,
                  onTap: () => widget.onOpenStop(stops[i]),
                ),
          ],
        ],
      ),
    );
  }
}

/// Route code + status, progress, and the start/finish action.
class _RouteHeader extends StatelessWidget {
  const _RouteHeader({
    required this.item,
    required this.busy,
    required this.blockedByOther,
    required this.expanded,
    required this.collapsible,
    required this.onStart,
    required this.onFinish,
    required this.onClose,
  });

  final _RouteWithStops item;
  final bool busy;
  final bool blockedByOther;
  final bool expanded;
  final bool collapsible;
  final VoidCallback onStart;
  final VoidCallback onFinish;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final route = item.route;
    final stops = item.stops;
    final completed = stops.where((s) => s.status == StopStatus.completed).length;
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.outline);

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(route.code, style: theme.textTheme.titleMedium)),
              Chip(label: Text(route.statusLabel)),
              if (collapsible) ...[
                const SizedBox(width: 4),
                Icon(expanded ? Icons.expand_less : Icons.expand_more, color: muted?.color),
              ],
            ],
          ),
          if (stops.isNotEmpty) ...[
            const SizedBox(height: 8),
            LinearProgressIndicator(value: completed / stops.length),
            const SizedBox(height: 8),
            Text('$completed de ${stops.length} paradas completadas', style: muted),
          ],
          if (route.isFinished) ...[
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
            if (item.stale) ...[
              Text(
                'Esta ruta es del ${route.date} y quedó sin cerrar. Ciérrala para poder iniciar otra: los km se cuentan solo hasta el final de ese día.',
                style: muted,
              ),
              const SizedBox(height: 12),
            ],
            if (item.allResolved)
              FilledButton.icon(
                onPressed: busy ? null : onFinish,
                icon: busy ? const _ButtonSpinner() : const Icon(Icons.flag),
                label: const Text('Finalizar ruta'),
              )
            else if (item.stale)
              OutlinedButton.icon(
                onPressed: busy ? null : onClose,
                icon: busy ? const _ButtonSpinner() : const Icon(Icons.block),
                label: const Text('Cerrar sin completar'),
              )
            else
              Text(
                'Completa o retrasa todas las paradas para poder finalizar la ruta.',
                style: muted,
              ),
          ],
        ],
      ),
    );
  }
}

/// "Where am I vs. where do I go" for a running route: the next pending
/// stop, the straight-line distance from the driver's last GPS fix, and — once
/// within [_arrivalRadiusMeters] — a one-tap "mark completed". Straight-line
/// on purpose: road distance/ETA needs the Directions API (map ticket).
class _NextStopPanel extends StatelessWidget {
  const _NextStopPanel({
    required this.stop,
    required this.tracking,
    required this.completing,
    required this.onComplete,
    required this.onEnableTracking,
  });

  final Stop stop;
  final TrackingService tracking;
  final bool completing;
  final VoidCallback onComplete;
  final VoidCallback onEnableTracking;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final muted = theme.textTheme.bodyMedium?.copyWith(color: scheme.outline);

    final position = tracking.lastPosition;
    final meters = position == null
        ? null
        : Geolocator.distanceBetween(position.latitude, position.longitude, stop.lat, stop.lng);
    final isClose = meters != null && meters <= _arrivalRadiusMeters;

    final Widget status;
    if (tracking.status == TrackingStatus.error || tracking.status == TrackingStatus.idle) {
      status = Row(
        children: [
          Icon(Icons.location_disabled, size: 18, color: scheme.error),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              tracking.status == TrackingStatus.error
                  ? (tracking.errorMessage ?? 'No se pudo activar el rastreo.')
                  : 'El rastreo está apagado: no se medirán los km ni tu distancia.',
              style: muted,
            ),
          ),
          TextButton(onPressed: onEnableTracking, child: const Text('Activar')),
        ],
      );
    } else if (meters == null) {
      status = Row(
        children: [
          const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2)),
          const SizedBox(width: 8),
          Text('Obteniendo tu ubicación…', style: muted),
        ],
      );
    } else {
      status = Row(
        children: [
          Icon(isClose ? Icons.place : Icons.directions, size: 18, color: scheme.primary),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              isClose ? 'Estás en la parada' : 'A ${formatDistanceMeters(meters)} en línea recta',
              style: theme.textTheme.titleSmall,
            ),
          ),
        ],
      );
    }

    // A tinted panel inside the route's card (not a card of its own), so it
    // reads as part of that route.
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: scheme.primaryContainer.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Siguiente parada', style: theme.textTheme.labelMedium),
          const SizedBox(height: 4),
          Text(stop.customerName, style: theme.textTheme.titleMedium),
          Text(stop.address, style: muted),
          const SizedBox(height: 12),
          status,
          if (isClose) ...[
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: completing ? null : onComplete,
              icon: completing ? const _ButtonSpinner() : const Icon(Icons.check),
              label: const Text('Marcar completada'),
            ),
          ],
        ],
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
