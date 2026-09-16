import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/daily_reports_client.dart';
import '../../../core/widgets/state_message.dart';
import '../data/daily_report.dart';

/// "Reporte del día" (TOR-19) — the driver's consolidated stats for today
/// (km recorridos, paradas completadas, rutas atendidas, tiempo en ruta),
/// generated backend-side whenever one of their routes finishes
/// (TOR-78, `daily-reports.service.ts`).
class DailyReportScreen extends StatefulWidget {
  const DailyReportScreen({super.key});

  @override
  State<DailyReportScreen> createState() => _DailyReportScreenState();
}

class _DailyReportScreenState extends State<DailyReportScreen> {
  final DailyReportsClient _client = DailyReportsClient();

  late Future<DailyReport?> _reportFuture;

  @override
  void initState() {
    super.initState();
    _reportFuture = _loadReport();
  }

  Future<DailyReport?> _loadReport() async {
    final accessToken = Supabase.instance.client.auth.currentSession?.accessToken;
    if (accessToken == null) return null;

    final today = DateTime.now().toIso8601String().split('T').first;
    return _client.getForDate(accessToken, today);
  }

  Future<void> _refresh() async {
    final future = _loadReport();
    // A block body, not `setState(() => _reportFuture = future)` — that
    // arrow form's "return value" is the assignment's value (the Future
    // itself), which setState's own runtime check flags as "performing
    // asynchronous work inside setState" even though nothing async actually
    // ran in the callback.
    setState(() {
      _reportFuture = future;
    });
    await future;
  }

  // "01:45:00" -> "1h 45m"; "00:15:00" -> "15m"; null -> "—".
  String _formatTimeOnRoute(String? hms) {
    if (hms == null) return '—';
    final parts = hms.split(':');
    if (parts.length != 3) return hms;
    final hours = int.tryParse(parts[0]) ?? 0;
    final minutes = int.tryParse(parts[1]) ?? 0;
    if (hours == 0) return '${minutes}m';
    return '${hours}h ${minutes}m';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reporte del día')),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<DailyReport?>(
          future: _reportFuture,
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
            final report = snapshot.data;
            if (report == null) {
              return StateMessage(
                icon: Icons.summarize_outlined,
                title: 'Todavía no hay reporte para hoy.',
                description: 'Se genera automáticamente cuando termines tu primera ruta del día.',
                actionLabel: 'Actualizar',
                onAction: _refresh,
              );
            }
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _MetricTile(
                  icon: Icons.route_outlined,
                  label: 'Rutas atendidas',
                  value: '${report.routesServed}',
                ),
                _MetricTile(
                  icon: Icons.location_on_outlined,
                  label: 'Paradas completadas',
                  value: '${report.completedStops}',
                ),
                _MetricTile(
                  icon: Icons.map_outlined,
                  label: 'Km recorridos',
                  value: report.drivenKm.toStringAsFixed(1),
                ),
                _MetricTile(
                  icon: Icons.schedule_outlined,
                  label: 'Tiempo en ruta',
                  value: _formatTimeOnRoute(report.timeOnRoute),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _MetricTile extends StatelessWidget {
  const _MetricTile({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: Icon(icon),
        title: Text(label),
        trailing: Text(value, style: Theme.of(context).textTheme.titleLarge),
      ),
    );
  }
}
