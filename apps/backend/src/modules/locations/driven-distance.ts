// TOR-138: the driver app finishes a route without the driver typing in the
// kilometers — they're measured from the GPS pings recorded while the route
// was in progress.

const EARTH_RADIUS_KM = 6371;

// Consecutive pings closer than this are treated as GPS jitter (a parked
// truck's fix drifts a few meters), not movement. The anchor only advances
// when a point is counted, so slow real movement still accumulates.
const MIN_SEGMENT_KM = 0.015;

interface Point {
  lat: number;
  lng: number;
}

export function haversineKm(a: Point, b: Point): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Total kilometers along [points] (already ordered by time), 2 decimals. */
export function drivenKmFromPings(points: Point[]): number {
  let total = 0;
  let anchor: Point | undefined;

  for (const point of points) {
    if (!anchor) {
      anchor = point;
      continue;
    }
    const segment = haversineKm(anchor, point);
    if (segment < MIN_SEGMENT_KM) continue;
    total += segment;
    anchor = point;
  }

  return Math.round(total * 100) / 100;
}
