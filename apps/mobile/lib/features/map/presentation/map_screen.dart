import 'package:flutter/material.dart';
// Both packages export a `Position` and geolocator also exports its own
// `LocationSettings` — different shapes, same names as mapbox_maps_flutter's.
// Prefixed to keep every reference unambiguous.
import 'package:geolocator/geolocator.dart' as geo;
import 'package:mapbox_maps_flutter/mapbox_maps_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../stops/data/next_stop_controller.dart';
import '../../tracking/data/tracking_service.dart';

/// Guatemala City — same fallback center as the dashboard's live map
/// (TOR-12) for when the device's own position isn't available yet (denied
/// permission, GPS off, or still resolving the first fix).
Point get _fallbackCenter => Point(coordinates: Position(-90.5069, 14.6349));

/// "Mapa principal" (TOR-22) — the driver's real post-login screen,
/// replacing the old placeholder. Centers on the device's current position
/// and shows Mapbox's own location puck (device GPS, independent of
/// [TrackingService]'s pings to the backend) plus the existing
/// start/stop tracking control from TOR-18, now as a bottom overlay card
/// instead of the whole screen's content.
///
/// The camera follows the driver while tracking is on: pressing "Iniciar"
/// (or the tracking service reaching `tracking`) transitions the viewport to
/// a [FollowPuckViewportState]. Dragging or pinching the map hands control
/// back to the driver and shows a "Centrar" button to resume following —
/// without this the camera was only positioned once, when the map was
/// created, so it stayed put (even on the fallback city center, if location
/// permission was denied at that moment) while the puck moved away.
///
/// While a route runs, the next stop is drawn on the map — a dot with the
/// customer's name and a straight line from the driver to it — and a card
/// below says how far it is, with a button to frame both on screen. The
/// stop comes from `StopsScreen` through [nextStop]. The full list of stops
/// stays in "Lista de paradas" (TOR-35) / "Detalle de parada" (TOR-20).
class MapScreen extends StatefulWidget {
  const MapScreen({super.key, required this.trackingService, required this.nextStop});

  /// The running route's next stop, published by the Paradas tab.
  final NextStopController nextStop;

  /// Owned by `HomeShell` and shared with the Paradas tab, so "Iniciar ruta"
  /// can turn tracking on and this screen just reflects (and can toggle) it.
  final TrackingService trackingService;

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  TrackingService get _trackingService => widget.trackingService;

  Point? _initialCenter;
  MapboxMap? _mapboxMap;

  /// Null until the first follow request — until then the map keeps the
  /// one-shot `cameraOptions` it was created with. MapWidget re-applies this
  /// only when the instance changes (it compares by identity), which is why
  /// every follow request builds a fresh, non-const state.
  ViewportState? _viewport;
  bool _following = false;
  bool _wasTracking = false;

  NextStopInfo? get _next => widget.nextStop.value;

  // What the next stop is drawn with. Managers exist once the map does.
  PolylineAnnotationManager? _lineManager;
  CircleAnnotationManager? _dotManager;
  PointAnnotationManager? _labelManager;

  /// Annotation calls are async and each redraw is delete-then-create, so
  /// they run one after another — a ping-driven line update can't interleave
  /// with a stop change.
  Future<void> _drawQueue = Future.value();

  // Theme colors as ARGB ints, refreshed on every build (annotations take
  // ints, and drawing happens outside of build).
  int _accent = 0xFFFF8A3D;
  int _labelColor = 0xFF000000;
  int _labelHalo = 0xFFFFFFFF;

  @override
  void initState() {
    super.initState();
    _resolveInitialPosition();
    // Tracking may already be on (started by "Iniciar ruta") by the time this
    // tab is first opened — the map is built lazily.
    _wasTracking = _trackingActive;
    _trackingService.addListener(_onTrackingChanged);
    widget.nextStop.addListener(_onNextStopChanged);
  }

  @override
  void dispose() {
    _trackingService.removeListener(_onTrackingChanged);
    widget.nextStop.removeListener(_onNextStopChanged);
    super.dispose();
  }

  void _enqueueDraw(Future<void> Function() job) {
    _drawQueue = _drawQueue.then((_) => job()).catchError((Object _) {});
  }

  /// The stop the driver is heading to changed (or there's none anymore):
  /// redraw the dot, its label and the line, and refresh the card.
  void _onNextStopChanged() {
    if (!mounted) return;
    setState(() {});
    _enqueueDraw(_drawNextStop);
  }

  Future<void> _drawNextStop() async {
    final dots = _dotManager;
    final labels = _labelManager;
    if (dots == null || labels == null) return;

    await dots.deleteAll();
    await labels.deleteAll();
    final next = _next;
    if (next != null) {
      final point = Point(coordinates: Position(next.lng, next.lat));
      await dots.create(
        CircleAnnotationOptions(
          geometry: point,
          circleRadius: 9,
          circleColor: _accent,
          circleStrokeColor: 0xFFFFFFFF,
          circleStrokeWidth: 3,
        ),
      );
      await labels.create(
        PointAnnotationOptions(
          geometry: point,
          textField: next.customerName,
          textSize: 14,
          textOffset: [0, -1.8],
          textColor: _labelColor,
          textHaloColor: _labelHalo,
          textHaloWidth: 2,
        ),
      );
    }
    await _drawLine();
  }

  /// A straight line from the driver's last fix to the next stop — "no tiene
  /// que ser perfecto": it shows the direction, not the road (road routing
  /// would need the Directions API).
  Future<void> _drawLine() async {
    final lines = _lineManager;
    if (lines == null) return;

    await lines.deleteAll();
    final next = _next;
    final me = _trackingService.lastPosition;
    if (next == null || me == null) return;
    await lines.create(
      PolylineAnnotationOptions(
        geometry: LineString(
          coordinates: [Position(me.longitude, me.latitude), Position(next.lng, next.lat)],
        ),
        lineColor: _accent,
        lineWidth: 4,
        lineOpacity: 0.7,
      ),
    );
  }

  /// Frames the driver and the next stop together (or just the stop, while
  /// there's no position yet). Hands the camera over from following the puck.
  ///
  /// Done with a computed camera + `easeTo`, not an `OverviewViewportState`:
  /// the Android side of the plugin fails to build that viewport state from
  /// its options ("Could not create viewport state out of options").
  Future<void> _showNextStop() async {
    final next = _next;
    final map = _mapboxMap;
    if (next == null || map == null) return;

    final stop = Point(coordinates: Position(next.lng, next.lat));
    final me = _trackingService.lastPosition;

    // Stop following the puck first, or the viewport keeps pulling the camera
    // back to the driver. Idle = the driver (or this code) owns the camera.
    // ignore: experimental_member_use
    setStateWithViewportAnimation(() {
      _viewport = const IdleViewportState();
      _following = false;
    });

    final CameraOptions camera = me == null
        ? CameraOptions(center: stop, zoom: 15)
        : await map.cameraForCoordinatesPadding(
            [Point(coordinates: Position(me.longitude, me.latitude)), stop],
            CameraOptions(),
            // Extra room at the bottom for the cards.
            MbxEdgeInsets(top: 96, left: 48, bottom: 220, right: 48),
            16,
            null,
          );
    await map.easeTo(camera, MapAnimationOptions(duration: 800));
  }

  bool get _trackingActive => _trackingService.isActive;

  /// Starts following the driver whenever tracking goes from off to on —
  /// including when the permission prompt of `start()` is what finally
  /// grants location, which is why the puck is re-enabled here too.
  void _onTrackingChanged() {
    final active = _trackingActive;
    final justStarted = active && !_wasTracking;
    _wasTracking = active;
    if (justStarted) _followDriver();
    // Every ping moves the driver: keep the line to the stop attached to them.
    if (_next != null) _enqueueDraw(_drawLine);
  }

  void _followDriver() {
    if (!mounted) return;
    _mapboxMap?.location.updateSettings(
      LocationComponentSettings(enabled: true, pulsingEnabled: true),
    );
    // Marked @experimental upstream, but mapbox_maps_flutter is vendored
    // (third_party/, TOR-132), so it can't change under us.
    // ignore: experimental_member_use
    setStateWithViewportAnimation(() {
      _viewport = FollowPuckViewportState(
        zoom: 16,
        // Keep the map north-up and flat: the defaults rotate with the phone's
        // heading and tilt 45°, which is disorienting when standing at a stop.
        bearing: const FollowPuckViewportStateBearingConstant(0),
        pitch: 0,
      );
      _following = true;
    });
  }

  /// A drag or pinch means the driver took the camera back.
  void _onUserGesture() {
    if (_following) setState(() => _following = false);
  }

  Future<void> _resolveInitialPosition() async {
    try {
      var permission = await geo.Geolocator.checkPermission();
      if (permission == geo.LocationPermission.denied) {
        permission = await geo.Geolocator.requestPermission();
      }
      if (permission == geo.LocationPermission.denied ||
          permission == geo.LocationPermission.deniedForever ||
          !await geo.Geolocator.isLocationServiceEnabled()) {
        setState(() => _initialCenter = _fallbackCenter);
        return;
      }

      final position = await geo.Geolocator.getCurrentPosition(
        locationSettings: const geo.LocationSettings(accuracy: geo.LocationAccuracy.high),
      );
      if (!mounted) return;
      setState(() {
        _initialCenter = Point(coordinates: Position(position.longitude, position.latitude));
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _initialCenter = _fallbackCenter);
    }
  }

  Future<void> _toggleTracking() async {
    if (_trackingService.status == TrackingStatus.tracking ||
        _trackingService.status == TrackingStatus.connecting) {
      await _trackingService.stop();
      return;
    }

    final accessToken = Supabase.instance.client.auth.currentSession?.accessToken;
    if (accessToken == null) return;
    await _trackingService.start(accessToken);
  }

  String _statusLabel(TrackingStatus status) {
    switch (status) {
      case TrackingStatus.idle:
        return 'Detenido';
      case TrackingStatus.connecting:
        return 'Conectando...';
      case TrackingStatus.tracking:
        return 'Rastreando';
      case TrackingStatus.error:
        return _trackingService.errorMessage ?? 'Ocurrió un error al iniciar el rastreo.';
    }
  }

  Future<void> _createAnnotationManagers(MapboxMap mapboxMap) async {
    // Creation order is drawing order: line under the dot, label on top.
    _lineManager = await mapboxMap.annotations.createPolylineAnnotationManager();
    _dotManager = await mapboxMap.annotations.createCircleAnnotationManager();
    _labelManager = await mapboxMap.annotations.createPointAnnotationManager();
    // The route may already be running by the time the map is ready.
    _enqueueDraw(_drawNextStop);
  }

  void _onMapCreated(MapboxMap mapboxMap) {
    _mapboxMap = mapboxMap;
    _createAnnotationManagers(mapboxMap);
    mapboxMap.location.updateSettings(
      LocationComponentSettings(enabled: true, pulsingEnabled: true),
    );
    // Tracking was already on when the map appeared: start following now,
    // the off→on transition the listener watches for already happened.
    if (_trackingActive) _followDriver();
  }

  @override
  Widget build(BuildContext context) {
    final initialCenter = _initialCenter;
    final scheme = Theme.of(context).colorScheme;
    _accent = scheme.primary.toARGB32();
    _labelColor = scheme.onSurface.toARGB32();
    _labelHalo = scheme.surface.toARGB32();
    final next = _next;

    return Scaffold(
      // TOR-11: logout moved to the Perfil tab — this app bar no longer
      // needs an authRepository, so the constructor param was dropped too.
      appBar: AppBar(title: const Text('Torpreca')),
      body: initialCenter == null
          ? const Center(child: CircularProgressIndicator())
          : Stack(
              children: [
                MapWidget(
                  cameraOptions: CameraOptions(center: initialCenter, zoom: 15),
                  viewport: _viewport,
                  onMapCreated: _onMapCreated,
                  onScrollListener: (_) => _onUserGesture(),
                  onZoomListener: (_) => _onUserGesture(),
                ),
                if (!_following)
                  Positioned(
                    right: 16,
                    // Above the tracking card (~72px tall) plus its margin —
                    // and above the next-stop card when there is one.
                    bottom: next == null ? 96 : 180,
                    child: FloatingActionButton.small(
                      tooltip: 'Centrar en mi ubicación',
                      onPressed: _followDriver,
                      child: const Icon(Icons.my_location),
                    ),
                  ),
                if (next != null)
                  Positioned(
                    left: 16,
                    right: 16,
                    bottom: 96,
                    child: Card(
                      child: ListTile(
                        leading: Icon(Icons.flag_circle, color: scheme.primary, size: 32),
                        title: Text(next.customerName),
                        // Rebuilds with each ping so the distance stays live.
                        subtitle: ListenableBuilder(
                          listenable: _trackingService,
                          builder: (context, _) {
                            final me = _trackingService.lastPosition;
                            if (me == null) return Text(next.address);
                            final meters = geo.Geolocator.distanceBetween(
                              me.latitude,
                              me.longitude,
                              next.lat,
                              next.lng,
                            );
                            return Text('A ${formatDistanceMeters(meters)} en línea recta');
                          },
                        ),
                        trailing: TextButton(onPressed: _showNextStop, child: const Text('Ver')),
                      ),
                    ),
                  ),
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: 16,
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: ListenableBuilder(
                        listenable: _trackingService,
                        builder: (context, _) {
                          final status = _trackingService.status;
                          final isActive =
                              status == TrackingStatus.tracking ||
                              status == TrackingStatus.connecting;
                          final pending = _trackingService.pendingCount;
                          return Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(_statusLabel(status)),
                                    if (pending > 0)
                                      Text(
                                        '$pending sin sincronizar',
                                        style: Theme.of(context).textTheme.bodySmall,
                                      ),
                                    if (status == TrackingStatus.error &&
                                        _trackingService.isLocationServicesDisabled)
                                      TextButton(
                                        onPressed: () => geo.Geolocator.openLocationSettings(),
                                        child: const Text('Abrir ajustes de ubicación'),
                                      ),
                                  ],
                                ),
                              ),
                              FilledButton(
                                onPressed: _toggleTracking,
                                child: Text(isActive ? 'Detener' : 'Iniciar'),
                              ),
                            ],
                          );
                        },
                      ),
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
