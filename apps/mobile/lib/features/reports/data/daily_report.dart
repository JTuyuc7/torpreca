/// Mirrors `DailyReportSchema` (packages/shared/src/schemas/daily-report.schema.ts)
/// — only the fields "Reporte del día" (TOR-19) displays.
class DailyReport {
  DailyReport({
    required this.date,
    required this.drivenKm,
    required this.completedStops,
    required this.routesServed,
    required this.timeOnRoute,
  });

  factory DailyReport.fromJson(Map<String, dynamic> json) => DailyReport(
    date: json['date'] as String,
    drivenKm: (json['drivenKm'] as num).toDouble(),
    completedStops: json['completedStops'] as int,
    routesServed: json['routesServed'] as int,
    // Postgres INTERVAL as "HH:MM:SS" text, or null if no completed route
    // that day had both a start and end time (see daily-reports.service.ts).
    timeOnRoute: json['timeOnRoute'] as String?,
  );

  final String date;
  final double drivenKm;
  final int completedStops;
  final int routesServed;
  final String? timeOnRoute;
}
