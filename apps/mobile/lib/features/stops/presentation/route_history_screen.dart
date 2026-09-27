import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/routes_client.dart';
import '../../../core/api/stops_client.dart';
import '../../../core/widgets/state_message.dart';
import '../../reports/presentation/report_widgets.dart';
import '../data/driver_route.dart';
import '../data/stop.dart';
import 'stop_status_ui.dart';

/// How many past routes each page shows.
const int _pageSize = 5;

/// "Rutas anteriores" — the driver's finished routes of earlier days
/// (completed, or closed without finishing), newest first: the 5 most recent
/// by default, "Ver más" for older ones and a date-range filter to jump to a
/// period. Read-only: expanding a route loads its stops.
///
/// Reached from the history button of the Paradas tab, which only lists
/// today's routes (plus any left running), so what the driver did on earlier
/// days isn't lost.
class RouteHistoryScreen extends StatefulWidget {
  const RouteHistoryScreen({super.key});

  @override
  State<RouteHistoryScreen> createState() => _RouteHistoryScreenState();
}

class _RouteHistoryScreenState extends State<RouteHistoryScreen> {
  final RoutesClient _routesClient = RoutesClient();

  final List<DriverRoute> _routes = [];
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = false;
  Object? _error;
  DateTimeRange? _range;

  String? get _accessToken => Supabase.instance.client.auth.currentSession?.accessToken;

  @override
  void initState() {
    super.initState();
    _load(reset: true);
  }

  /// Loads the first page ([reset]) or the next one.
  Future<void> _load({bool reset = false}) async {
    final accessToken = _accessToken;
    if (accessToken == null) return;

    setState(() {
      if (reset) {
        _loading = true;
        _error = null;
      } else {
        _loadingMore = true;
      }
    });

    try {
      final range = _range;
      final page = await _routesClient.history(
        accessToken,
        limit: _pageSize,
        offset: reset ? 0 : _routes.length,
        from: range == null ? null : toIsoDate(range.start),
        to: range == null ? null : toIsoDate(range.end),
      );
      if (!mounted) return;
      setState(() {
        if (reset) _routes.clear();
        _routes.addAll(page);
        _hasMore = page.length == _pageSize;
      });
    } catch (error) {
      if (!mounted) return;
      if (reset) {
        setState(() => _error = error);
      } else {
        // The pages already loaded stay on screen; only the extra page failed.
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No se pudieron cargar más rutas. Intenta de nuevo.')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
          _loadingMore = false;
        });
      }
    }
  }

  Future<void> _pickRange() async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 2),
      lastDate: now,
      initialDateRange: _range,
      helpText: 'Buscar rutas por fecha',
      saveText: 'Buscar',
    );
    if (picked == null || !mounted) return;
    setState(() => _range = picked);
    await _load(reset: true);
  }

  Future<void> _clearRange() async {
    setState(() => _range = null);
    await _load(reset: true);
  }

  String _rangeLabel(DateTimeRange range) {
    final start = formatDate(toIsoDate(range.start));
    final end = formatDate(toIsoDate(range.end));
    return start == end ? start : '$start – $end';
  }

  @override
  Widget build(BuildContext context) {
    final range = _range;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Rutas anteriores'),
        actions: [
          IconButton(
            tooltip: 'Buscar por fecha',
            onPressed: _pickRange,
            icon: const Icon(Icons.date_range),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => _load(reset: true),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (range != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: InputChip(
                    avatar: const Icon(Icons.filter_alt_outlined, size: 18),
                    label: Text(_rangeLabel(range)),
                    onDeleted: _clearRange,
                    deleteButtonTooltipMessage: 'Quitar filtro',
                  ),
                ),
              ),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(48),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              StateMessage.forError(
                _error!,
                title: 'No se pudieron cargar las rutas anteriores.',
                onAction: () => _load(reset: true),
              )
            else if (_routes.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 48),
                child: Text(
                  range == null
                      ? 'Todavía no tienes rutas terminadas.'
                      : 'No hay rutas terminadas en ese rango de fechas.',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium
                      ?.copyWith(color: Theme.of(context).colorScheme.outline),
                ),
              )
            else ...[
              for (final route in _routes) _HistoryRouteCard(key: ValueKey(route.id), route: route),
              if (_hasMore)
                Center(
                  child: TextButton(
                    onPressed: _loadingMore ? null : () => _load(),
                    child: _loadingMore
                        ? const SizedBox(
                            height: 16,
                            width: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Ver más'),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

/// A finished route: code, day, status and km, expandable to its stops (read
/// only, loaded the first time it's opened).
class _HistoryRouteCard extends StatefulWidget {
  const _HistoryRouteCard({super.key, required this.route});

  final DriverRoute route;

  @override
  State<_HistoryRouteCard> createState() => _HistoryRouteCardState();
}

class _HistoryRouteCardState extends State<_HistoryRouteCard> {
  final StopsClient _stopsClient = StopsClient();

  bool _expanded = false;
  Future<List<Stop>>? _stops;

  void _toggle() {
    setState(() {
      _expanded = !_expanded;
      _stops ??= _loadStops();
    });
  }

  Future<List<Stop>> _loadStops() async {
    final accessToken = Supabase.instance.client.auth.currentSession?.accessToken;
    if (accessToken == null) return const [];
    return _stopsClient.listByRoute(accessToken, widget.route.id);
  }

  void _retry() {
    final future = _loadStops();
    setState(() {
      _stops = future;
    });
  }

  @override
  Widget build(BuildContext context) {
    final route = widget.route;
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.outline);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: _toggle,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(child: Text(route.code, style: theme.textTheme.titleMedium)),
                      Chip(label: Text(route.statusLabel)),
                      const SizedBox(width: 4),
                      Icon(_expanded ? Icons.expand_less : Icons.expand_more, color: muted?.color),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${formatDate(route.date)} · ${route.drivenKm.toStringAsFixed(2)} km',
                    style: muted,
                  ),
                ],
              ),
            ),
          ),
          if (_expanded) ...[
            const Divider(height: 1),
            FutureBuilder<List<Stop>>(
              future: _stops,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }
                if (snapshot.hasError) {
                  return Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Expanded(child: Text('No se pudieron cargar las paradas.', style: muted)),
                        TextButton(onPressed: _retry, child: const Text('Reintentar')),
                      ],
                    ),
                  );
                }
                final stops = snapshot.data!;
                if (stops.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text('Esta ruta no tenía paradas.', style: muted),
                  );
                }
                return Column(
                  children: [
                    for (final stop in stops)
                      ListTile(
                        leading: Icon(stopStatusIcon(stop.status)),
                        title: Text(stop.customerName),
                        subtitle: Text(stop.address),
                        trailing: Text(stopStatusLabel(stop.status)),
                      ),
                  ],
                );
              },
            ),
          ],
        ],
      ),
    );
  }
}
