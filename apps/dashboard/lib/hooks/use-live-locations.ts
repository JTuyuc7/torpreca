import type { Location } from "@torpreca/shared";
import { useEffect, useState } from "react";
import { getLatestLocations, mintWsTicket } from "@/lib/api/dashboard-client";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL as string;

function toWsUrl(httpUrl: string): string {
  return httpUrl.replace(/^http/, "ws");
}

export type LiveLocationsStatus = "connecting" | "connected" | "error";

// The mobile app pings every 8s while a driver has tracking on
// (TrackingService._pingInterval) — anything older than this has almost
// certainly stopped tracking (closed the app, pressed "Detener", lost GPS),
// not just hit a slow network tick. `listLatestPerDriver()`
// (locations.repository.ts) never expires a row on its own — it always
// returns each driver's single most recent ping, even one from days ago —
// so without this filter, a driver who tracked once would show as "online"
// forever. Found while building the drivers table's live-status column
// (TOR-31); the live map (TOR-12) shares this hook and gets the same fix.
const STALE_AFTER_MS = 30_000;

// Read-only client for the same "tracking" WebSocket topic the mobile app
// pings into (core/ws/tracking-handlers.ts) — any authenticated connection
// is subscribed on open, so this dashboard socket just listens and never
// sends. REST snapshot (GET /locations/latest) seeds the initial state so
// the map isn't empty while waiting for the next broadcast.
export function useLiveLocations() {
  const [locationsByDriver, setLocationsByDriver] = useState<Map<string, Location>>(new Map());
  const [status, setStatus] = useState<LiveLocationsStatus>("connecting");
  // Ticks so a driver who simply stopped sending pings — no new broadcast
  // will ever arrive to trigger a re-render on its own — still ages out of
  // `locations` within STALE_AFTER_MS instead of only on the next unrelated
  // render.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | undefined;

    function upsert(location: Location) {
      setLocationsByDriver((prev) => {
        const next = new Map(prev);
        next.set(location.driverId, location);
        return next;
      });
    }

    async function connect() {
      setStatus("connecting");

      const snapshot = await getLatestLocations();
      if (cancelled) return;
      if (snapshot.ok) {
        setLocationsByDriver(new Map(snapshot.locations.map((l) => [l.driverId, l])));
      }

      const ticketResult = await mintWsTicket();
      if (cancelled) return;
      if (!ticketResult.ok) {
        setStatus("error");
        return;
      }

      ws = new WebSocket(`${toWsUrl(BACKEND_URL)}/ws?ticket=${ticketResult.ticket}`);
      ws.onopen = () => !cancelled && setStatus("connected");
      ws.onerror = () => !cancelled && setStatus("error");
      ws.onclose = () => !cancelled && setStatus("error");
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string) as {
            type: string;
            payload: Location;
          };
          if (message.type === "location:broadcast") upsert(message.payload);
        } catch {
          // Ignore malformed frames — the backend only ever sends
          // location:broadcast/error, and a parse failure here shouldn't
          // tear down an otherwise-healthy connection.
        }
      };
    }

    connect().catch(() => !cancelled && setStatus("error"));

    return () => {
      cancelled = true;
      ws?.close();
    };
  }, []);

  const locations = Array.from(locationsByDriver.values()).filter(
    (l) => now - new Date(l.recordedAt).getTime() < STALE_AFTER_MS,
  );

  return { locations, status };
}