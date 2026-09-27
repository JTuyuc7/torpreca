import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/routes_client.dart';
import '../../../core/api/stops_client.dart';
import '../../stops/data/driver_route.dart';
import '../../stops/data/stop.dart';
import '../data/daily_report.dart';

/// One of a day's routes with how many of its stops are done.
class RouteSummary {
  const RouteSummary({required this.route, required this.completedStops, required this.totalStops});

  final DriverRoute route;
  final int completedStops;
  final int totalStops;
}

/// The driver's routes on [date] (`yyyy-MM-dd`) with their stop counts —
/// shared by today's report and the detail of a past day.
Future<List<RouteSummary>> loadRouteSummaries(
  String accessToken,
  String date, {
  RoutesClient? routesClient,
  StopsClient? stopsClient,
}) async {
  final routesApi = routesClient ?? RoutesClient();
  final stopsApi = stopsClient ?? StopsClient();

  final routes = await routesApi.listForDate(accessToken, date);
  return Future.wait(
    routes.map((route) async {
      final stops = await stopsApi.listByRoute(accessToken, route.id);
      return RouteSummary(
        route: route,
        completedStops: stops.where((s) => s.status == StopStatus.completed).length,
        totalStops: stops.length,
      );
    }),
  );
}

/// "01:45:00" -> "1h 45m"; "00:15:00" -> "15m"; null -> "—".
String formatTimeOnRoute(String? hms) {
  if (hms == null) return '—';
  final parts = hms.split(':');
  if (parts.length != 3) return hms;
  final hours = int.tryParse(parts[0]) ?? 0;
  final minutes = int.tryParse(parts[1]) ?? 0;
  if (hours == 0) return '${minutes}m';
  return '${hours}h ${minutes}m';
}

/// "2026-09-25" -> "25/09/2026".
String formatDate(String isoDate) {
  final parts = isoDate.split('-');
  if (parts.length != 3) return isoDate;
  return '${parts[2]}/${parts[1]}/${parts[0]}';
}

/// `yyyy-MM-dd` for a picked [DateTime].
String toIsoDate(DateTime date) {
  String two(int n) => n.toString().padLeft(2, '0');
  return '${date.year}-${two(date.month)}-${two(date.day)}';
}

/// Who the report belongs to. Name/email come from the Supabase session
/// (`user_metadata.name`), same source as the Perfil tab — no extra endpoint.
class DriverCard extends StatelessWidget {
  const DriverCard({super.key, required this.dateLabel});

  final String dateLabel;

  @override
  Widget build(BuildContext context) {
    final user = Supabase.instance.client.auth.currentUser;
    final name = (user?.userMetadata?['name'] as String?) ?? user?.email ?? '';
    final email = user?.email ?? '';

    return Card(
      child: ListTile(
        leading: CircleAvatar(child: Text(name.isNotEmpty ? name[0].toUpperCase() : '?')),
        title: Text(name),
        subtitle: Text(email),
        trailing: Text(dateLabel, style: Theme.of(context).textTheme.labelLarge),
      ),
    );
  }
}

/// The four consolidated numbers of a day.
class ReportMetrics extends StatelessWidget {
  const ReportMetrics({super.key, required this.report});

  final DailyReport report;

  @override
  Widget build(BuildContext context) {
    return Column(
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
          value: formatTimeOnRoute(report.timeOnRoute),
        ),
      ],
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

/// One route of a day: code, status, stops done, schedule and — once
/// finished — the kilometers.
class RouteSummaryTile extends StatelessWidget {
  const RouteSummaryTile({super.key, required this.summary});

  final RouteSummary summary;

  static String _hhmm(DateTime t) =>
      '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final route = summary.route;
    final start = route.startTime;
    final end = route.endTime;
    final schedule = start == null
        ? null
        : (end == null ? 'desde ${_hhmm(start)}' : '${_hhmm(start)} – ${_hhmm(end)}');

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        title: Text(route.code),
        subtitle: Text(
          [
            route.statusLabel,
            '${summary.completedStops} de ${summary.totalStops} paradas',
            ?schedule,
          ].join(' · '),
        ),
        // A cancelled route (closed without finishing) also has the km it
        // drove until the end of its day.
        trailing: route.isCompleted || route.status == 'cancelled'
            ? Text(
                '${route.drivenKm.toStringAsFixed(1)} km',
                style: Theme.of(context).textTheme.titleMedium,
              )
            : null,
      ),
    );
  }
}
