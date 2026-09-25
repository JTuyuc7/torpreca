/// Minimal mirror of `RouteSchema` (packages/shared/src/schemas/route.schema.ts)
/// — only what "Lista de paradas" (TOR-35) needs to fetch that route's stops,
/// plus what its section header shows: code, status, driven km (TOR-137,
/// TOR-138). Named `DriverRoute`, not `Route`, to avoid clashing with
/// Flutter's own navigation `Route`.
class DriverRoute {
  DriverRoute({
    required this.id,
    required this.code,
    required this.status,
    required this.drivenKm,
    required this.createdAt,
  });

  factory DriverRoute.fromJson(Map<String, dynamic> json) => DriverRoute(
    id: json['id'] as String,
    code: json['code'] as String,
    status: json['status'] as String,
    drivenKm: (json['drivenKm'] as num).toDouble(),
    createdAt: DateTime.parse(json['createdAt'] as String),
  );

  final String id;
  final String code;

  /// Raw `route_status` value: pending, in_progress, completed, delayed or
  /// cancelled.
  final String status;

  /// Kilometers measured from GPS pings when the route was finished.
  final double drivenKm;

  /// Only used to keep several routes of the same day in a stable order.
  final DateTime createdAt;

  bool get isPending => status == 'pending';
  bool get isInProgress => status == 'in_progress';
  bool get isCompleted => status == 'completed';

  String get statusLabel => switch (status) {
    'pending' => 'Pendiente',
    'in_progress' => 'En curso',
    'completed' => 'Completada',
    'delayed' => 'Retrasada',
    'cancelled' => 'Cancelada',
    _ => status,
  };
}
