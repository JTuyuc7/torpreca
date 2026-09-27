/// Minimal mirror of `RouteSchema` (packages/shared/src/schemas/route.schema.ts)
/// — only what "Lista de paradas" (TOR-35) needs to fetch that route's stops,
/// plus what its section header shows: code, status, driven km (TOR-137,
/// TOR-138). Named `DriverRoute`, not `Route`, to avoid clashing with
/// Flutter's own navigation `Route`.
class DriverRoute {
  DriverRoute({
    required this.id,
    required this.code,
    required this.date,
    required this.status,
    required this.drivenKm,
    required this.createdAt,
    this.startTime,
    this.endTime,
  });

  factory DriverRoute.fromJson(Map<String, dynamic> json) => DriverRoute(
    id: json['id'] as String,
    code: json['code'] as String,
    date: json['date'] as String,
    status: json['status'] as String,
    drivenKm: (json['drivenKm'] as num).toDouble(),
    createdAt: DateTime.parse(json['createdAt'] as String),
    startTime: _parseTime(json['startTime']),
    endTime: _parseTime(json['endTime']),
  );

  // Local time, since it's shown to the driver on their own clock.
  static DateTime? _parseTime(Object? value) =>
      value is String ? DateTime.parse(value).toLocal() : null;

  final String id;
  final String code;

  /// The route's day, `yyyy-MM-dd` (business calendar day).
  final String date;

  /// Raw `route_status` value: pending, in_progress, completed, delayed or
  /// cancelled.
  final String status;

  /// Kilometers measured from GPS pings when the route was finished.
  final double drivenKm;

  /// Only used to keep several routes of the same day in a stable order.
  final DateTime createdAt;

  /// When the driver started / finished the route; null until it happens.
  final DateTime? startTime;
  final DateTime? endTime;

  bool get isPending => status == 'pending';
  bool get isInProgress => status == 'in_progress';
  bool get isCompleted => status == 'completed';

  /// Over for good: finished, or closed without finishing. Its stops and km
  /// can't change anymore.
  bool get isFinished => status == 'completed' || status == 'cancelled';

  /// Started but never finished, and its day is over ([today] is
  /// `yyyy-MM-dd`): the route the driver left running yesterday. It stops
  /// counting km at the end of its own day, and can't be resumed — only
  /// finished (if every stop was resolved) or closed as not completed.
  bool isStale(String today) => isInProgress && date.compareTo(today) < 0;

  String get statusLabel => switch (status) {
    'pending' => 'Pendiente',
    'in_progress' => 'En curso',
    'completed' => 'Completada',
    'delayed' => 'Retrasada',
    'cancelled' => 'Cancelada',
    _ => status,
  };
}
