/// Mirrors `StopSchema` (packages/shared/src/schemas/stop.schema.ts) — only
/// the fields "Lista de paradas" (TOR-35) displays. Detail fields (lat/lng/
/// instructions/times) belong to "Detalle de parada" (TOR-20).
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
    required this.status,
  });

  factory Stop.fromJson(Map<String, dynamic> json) => Stop(
    id: json['id'] as String,
    order: json['order'] as int,
    customerName: json['customerName'] as String,
    address: json['address'] as String,
    status: _statusFromJson(json['status'] as String),
  );

  final String id;
  final int order;
  final String customerName;
  final String address;
  final StopStatus status;
}
