import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/stops_client.dart';
import '../data/stop.dart';
import 'stop_status_ui.dart';

/// "Detalle de parada" (TOR-20) — full info for one stop plus the actions to
/// mark it completed or delayed (`PATCH /mobile/stops/:id/complete|delay`).
/// Pushed from `StopsScreen` when a `ListTile` is tapped; `StopsScreen`
/// re-fetches the list when this screen is popped (simpler and more robust
/// than threading a return value through every way back — system gesture,
/// AppBar button, etc. — for a screen that's cheap to refetch anyway).
class StopDetailScreen extends StatefulWidget {
  const StopDetailScreen({super.key, required this.stop, this.canAct = true});

  final Stop stop;

  /// False while the stop's route hasn't been started (TOR-138): the details
  /// are still readable, but completing/delaying waits for "Iniciar ruta".
  final bool canAct;

  @override
  State<StopDetailScreen> createState() => _StopDetailScreenState();
}

class _StopDetailScreenState extends State<StopDetailScreen> {
  final StopsClient _stopsClient = StopsClient();

  late Stop _stop = widget.stop;
  bool _updating = false;

  Future<void> _update(Future<Stop> Function(String accessToken, String stopId) action) async {
    final accessToken = Supabase.instance.client.auth.currentSession?.accessToken;
    if (accessToken == null || _updating) return;

    setState(() => _updating = true);
    try {
      final updated = await action(accessToken, _stop.id);
      if (!mounted) return;
      setState(() => _stop = updated);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No se pudo actualizar la parada. Intenta de nuevo.')),
      );
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isFinal = _stop.status == StopStatus.completed;

    return Scaffold(
      appBar: AppBar(title: Text(_stop.customerName)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.location_on_outlined, size: 18),
                      const SizedBox(width: 8),
                      Expanded(child: Text(_stop.address)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Icon(stopStatusIcon(_stop.status), size: 18),
                      const SizedBox(width: 8),
                      Text(stopStatusLabel(_stop.status)),
                    ],
                  ),
                  if (_stop.instructions != null && _stop.instructions!.trim().isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Text('Instrucciones', style: Theme.of(context).textTheme.labelLarge),
                    const SizedBox(height: 4),
                    Text(_stop.instructions!),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          if (isFinal)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Center(child: Text('Esta parada ya fue completada.')),
            )
          else ...[
            if (!widget.canAct)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  'Inicia la ruta desde la lista de paradas para poder registrar esta parada.',
                  style: Theme.of(context).textTheme.bodyMedium
                      ?.copyWith(color: Theme.of(context).colorScheme.outline),
                ),
              ),
            FilledButton.icon(
              onPressed: _updating || !widget.canAct
                  ? null
                  : () => _update((t, id) => _stopsClient.complete(t, id)),
              icon: _updating
                  ? const SizedBox(
                      height: 16,
                      width: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.check),
              label: const Text('Marcar completada'),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _updating || !widget.canAct
                  ? null
                  : () => _update((t, id) => _stopsClient.delay(t, id)),
              icon: const Icon(Icons.schedule),
              label: const Text('Retrasar'),
            ),
          ],
        ],
      ),
    );
  }
}
