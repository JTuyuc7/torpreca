import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/daily_reports_client.dart';
import '../../../core/widgets/state_message.dart';
import '../data/daily_report.dart';
import 'daily_report_detail_screen.dart';
import 'report_widgets.dart';

/// Today's report plus the routes of today.
class _TodayData {
  const _TodayData({required this.report, required this.routes});

  /// Null until the driver finishes their first route of the day.
  final DailyReport? report;
  final List<RouteSummary> routes;
}

/// How many past reports each page of the "Historial" shows.
const int _historyPageSize = 5;

/// "Reporte del día" (TOR-19) — the driver's own data: who they are, today's
/// consolidated stats (km recorridos, paradas completadas, rutas atendidas,
/// tiempo en ruta) generated backend-side whenever one of their routes
/// finishes (TOR-78, `daily-reports.service.ts`), the breakdown per route so a
/// day in progress isn't an empty screen, and a "Historial" of past days —
/// the 5 most recent by default, "Ver más" for older ones, and a date-range
/// filter to jump to a specific period.
///
/// Refetches whenever the tab is re-selected or the app resumes — `HomeShell`
/// keeps tabs alive in an `IndexedStack`, so without this the report finished
/// a minute ago would only show up after a manual pull-to-refresh.
class DailyReportScreen extends StatefulWidget {
  const DailyReportScreen({super.key, this.isActive = true});

  /// Whether this tab is the one currently shown by `HomeShell`.
  final bool isActive;

  @override
  State<DailyReportScreen> createState() => _DailyReportScreenState();
}

class _DailyReportScreenState extends State<DailyReportScreen> with WidgetsBindingObserver {
  final DailyReportsClient _reportsClient = DailyReportsClient();

  late Future<_TodayData> _today;

  // "Historial" — kept in state (not a FutureBuilder) because it grows page
  // by page and reloads when the filter changes.
  final List<DailyReport> _history = [];
  bool _historyLoading = true;
  bool _loadingMore = false;
  bool _hasMore = false;
  Object? _historyError;
  DateTimeRange? _range;

  String get _todayIso => toIsoDate(DateTime.now());

  String? get _accessToken => Supabase.instance.client.auth.currentSession?.accessToken;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _today = _loadToday();
    _loadHistory(reset: true);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didUpdateWidget(DailyReportScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive && !oldWidget.isActive) _refresh();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && widget.isActive) _refresh();
  }

  Future<_TodayData> _loadToday() async {
    final accessToken = _accessToken;
    if (accessToken == null) return const _TodayData(report: null, routes: []);

    final today = _todayIso;
    final results = await Future.wait([
      _reportsClient.getForDate(accessToken, today),
      loadRouteSummaries(accessToken, today),
    ]);
    return _TodayData(report: results[0] as DailyReport?, routes: results[1] as List<RouteSummary>);
  }

  /// Loads the first page ([reset]) or the next one of the history.
  /// Without a filter the history starts before today — today has its own
  /// section above; with one, it covers exactly the picked range.
  Future<void> _loadHistory({bool reset = false}) async {
    final accessToken = _accessToken;
    if (accessToken == null) return;

    setState(() {
      if (reset) {
        _historyLoading = true;
        _historyError = null;
      } else {
        _loadingMore = true;
      }
    });

    try {
      final range = _range;
      final page = await _reportsClient.history(
        accessToken,
        limit: _historyPageSize,
        before: reset ? (range == null ? _todayIso : null) : _history.last.date,
        from: range == null ? null : toIsoDate(range.start),
        to: range == null ? null : toIsoDate(range.end),
      );
      if (!mounted) return;
      setState(() {
        if (reset) _history.clear();
        _history.addAll(page);
        _hasMore = page.length == _historyPageSize;
      });
    } catch (error) {
      if (!mounted) return;
      if (reset) {
        setState(() => _historyError = error);
      } else {
        // The pages already loaded stay on screen; only the extra page failed.
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No se pudieron cargar más reportes. Intenta de nuevo.')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _historyLoading = false;
          _loadingMore = false;
        });
      }
    }
  }

  Future<void> _refresh() async {
    final future = _loadToday();
    // A block body, not `setState(() => _today = future)` — that
    // arrow form's "return value" is the assignment's value (the Future
    // itself), which setState's own runtime check flags as "performing
    // asynchronous work inside setState" even though nothing async actually
    // ran in the callback.
    setState(() {
      _today = future;
    });
    await Future.wait([future, _loadHistory(reset: true)]);
  }

  Future<void> _pickRange() async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(now.year - 2),
      lastDate: now,
      initialDateRange: _range,
      helpText: 'Buscar reportes por fecha',
      saveText: 'Buscar',
    );
    if (picked == null || !mounted) return;
    setState(() => _range = picked);
    await _loadHistory(reset: true);
  }

  Future<void> _clearRange() async {
    setState(() => _range = null);
    await _loadHistory(reset: true);
  }

  String _rangeLabel(DateTimeRange range) {
    final start = formatDate(toIsoDate(range.start));
    final end = formatDate(toIsoDate(range.end));
    return start == end ? start : '$start – $end';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reporte del día')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<_TodayData>(
          future: _today,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return StateMessage.forError(
                snapshot.error!,
                title: 'No se pudo cargar el reporte de hoy.',
                onAction: _refresh,
              );
            }

            final data = snapshot.data!;
            final report = data.report;
            final theme = Theme.of(context);
            final muted = theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.outline);

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                DriverCard(dateLabel: formatDate(_todayIso)),
                const SizedBox(height: 16),
                if (report == null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(
                      'El resumen del día se genera automáticamente cuando termines tu primera ruta.',
                      style: muted,
                    ),
                  )
                else
                  ReportMetrics(report: report),
                const SizedBox(height: 8),
                Text('Rutas de hoy', style: theme.textTheme.titleMedium),
                const SizedBox(height: 8),
                if (data.routes.isEmpty)
                  Text('No tienes rutas asignadas hoy.', style: muted)
                else
                  for (final summary in data.routes) RouteSummaryTile(summary: summary),
                const SizedBox(height: 16),
                _buildHistory(theme, muted),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildHistory(ThemeData theme, TextStyle? muted) {
    final range = _range;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text('Historial', style: theme.textTheme.titleMedium)),
            IconButton(
              tooltip: 'Buscar por fecha',
              onPressed: _pickRange,
              icon: const Icon(Icons.date_range),
            ),
          ],
        ),
        if (range != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: InputChip(
              avatar: const Icon(Icons.filter_alt_outlined, size: 18),
              label: Text(_rangeLabel(range)),
              onDeleted: _clearRange,
              deleteButtonTooltipMessage: 'Quitar filtro',
            ),
          ),
        if (_historyLoading)
          const Padding(
            padding: EdgeInsets.all(24),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (_historyError != null)
          StateMessage.forError(
            _historyError!,
            title: 'No se pudo cargar el historial.',
            onAction: () => _loadHistory(reset: true),
          )
        else if (_history.isEmpty)
          Text(
            range == null
                ? 'Todavía no hay reportes de días anteriores.'
                : 'No hay reportes en ese rango de fechas.',
            style: muted,
          )
        else ...[
          for (final report in _history)
            Card(
              margin: const EdgeInsets.only(bottom: 8),
              child: ListTile(
                leading: const Icon(Icons.event_note_outlined),
                title: Text(formatDate(report.date)),
                subtitle: Text(
                  '${report.routesServed} ${report.routesServed == 1 ? 'ruta' : 'rutas'} · ${report.completedStops} ${report.completedStops == 1 ? 'parada' : 'paradas'}',
                ),
                trailing: Text(
                  '${report.drivenKm.toStringAsFixed(1)} km',
                  style: theme.textTheme.titleMedium,
                ),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(builder: (_) => DailyReportDetailScreen(report: report)),
                ),
              ),
            ),
          if (_hasMore)
            Center(
              child: TextButton(
                onPressed: _loadingMore ? null : () => _loadHistory(),
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
    );
  }
}
