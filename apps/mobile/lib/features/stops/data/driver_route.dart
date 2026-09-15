/// Minimal mirror of `RouteSchema` (packages/shared/src/schemas/route.schema.ts)
/// — only what "Lista de paradas" (TOR-35) needs to then fetch that route's
/// stops. Named `DriverRoute`, not `Route`, to avoid clashing with Flutter's
/// own navigation `Route`.
class DriverRoute {
  DriverRoute({required this.id, required this.code});

  factory DriverRoute.fromJson(Map<String, dynamic> json) =>
      DriverRoute(id: json['id'] as String, code: json['code'] as String);

  final String id;
  final String code;
}
