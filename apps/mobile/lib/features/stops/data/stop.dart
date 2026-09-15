/// Mirrors `StopSchema` (packages/shared/src/schemas/stop.schema.ts) — every
/// field "Lista de paradas" (TOR-35) and "Detalle de parada" (TOR-20) need.
enum StopStatus { pending, next, completed, delayed }

StopStatus _statusFromJson(String value) => switch (value) {
  'next' => StopStatus.next,
  'completed' => StopStatus.completed,
  'delayed' => StopStatus.delayed,
  _ => StopStatus.pending,
};

class Stop {
  Stop({
    required this.id,
    required this.order,
    required this.customerName,
    required this.address,
    required this.lat,
    required this.lng,
    required this.instructions,
    required this.status,
  });

  factory Stop.fromJson(Map<String, dynamic> json) => Stop(
    id: json['id'] as String,
    order: json['order'] as int,
    customerName: json['customerName'] as String,
    address: json['address'] as String,
    lat: (json['lat'] as num).toDouble(),
    lng: (json['lng'] as num).toDouble(),
    instructions: json['instructions'] as String?,
    status: _statusFromJson(json['status'] as String),
  );

  final String id;
  final int order;
  final String customerName;
  final String address;
  final double lat;
  final double lng;
  final String? instructions;
  final StopStatus status;

  Stop copyWith({StopStatus? status}) => Stop(
    id: id,
    order: order,
    customerName: customerName,
    address: address,
    lat: lat,
    lng: lng,
    instructions: instructions,
    status: status ?? this.status,
  );
}
