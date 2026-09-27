import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/widgets/state_message.dart';
import '../data/daily_report.dart';
import 'report_widgets.dart';

/// One past day of the "Historial": its consolidated numbers plus the routes
/// the driver had that day. Pushed from `DailyReportScreen`.
class DailyReportDetailScreen extends StatefulWidget {
  const DailyReportDetailScreen({super.key, required this.report});

  final DailyReport report;

  @override
  State<DailyReportDetailScreen> createState() => _DailyReportDetailScreenState();
}

class _DailyReportDetailScreenState extends State<DailyReportDetailScreen> {
  late Future<List<RouteSummary>> _routes;

  @override
  void initState() {
    super.initState();
    _routes = _load();
  }

  Future<List<RouteSummary>> _load() async {
    final accessToken = Supabase.instance.client.auth.currentSession?.accessToken;
    if (accessToken == null) return const [];
    return loadRouteSummaries(accessToken, widget.report.date);
  }

  void _retry() {
    final future = _load();
    setState(() {
      _routes = future;
    });
  }

  @override
  Widget build(BuildContext context) {
    final report = widget.report;
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: Text('Reporte del ${formatDate(report.date)}')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          DriverCard(dateLabel: formatDate(report.date)),
          const SizedBox(height: 16),
          ReportMetrics(report: report),
          const SizedBox(height: 8),
          Text('Rutas del día', style: theme.textTheme.titleMedium),
          const SizedBox(height: 8),
          FutureBuilder<List<RouteSummary>>(
            future: _routes,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(child: CircularProgressIndicator()),
                );
              }
              if (snapshot.hasError) {
                return StateMessage.forError(
                  snapshot.error!,
                  title: 'No se pudieron cargar las rutas de ese día.',
                  onAction: _retry,
                );
              }
              final routes = snapshot.data!;
              if (routes.isEmpty) {
                return Text(
                  'No hay rutas registradas ese día.',
                  style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.outline),
                );
              }
              return Column(
                children: [for (final summary in routes) RouteSummaryTile(summary: summary)],
              );
            },
          ),
        ],
      ),
    );
  }
}
