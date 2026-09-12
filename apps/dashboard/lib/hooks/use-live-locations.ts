import type { Location } from "@torpreca/shared";
import { useEffect, useState } from "react";
import { getLatestLocations, mintWsTicket } from "@/lib/api/dashboard-client";
import { getAccessToken } from "@/lib/supabase/access-token";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL as string;

function toWsUrl(httpUrl: string): string {
  return httpUrl.replace(/^http/, "ws");
}

export type LiveLocationsStatus = "connecting" | "connected" | "error";

// Read-only client for the same "tracking" WebSocket topic the mobile app
// pings into (core/ws/tracking-handlers.ts) — any authenticated connection
// is subscribed on open, so this dashboard socket just listens and never
// sends. REST snapshot (GET /locations/latest) seeds the initial state so
// the map isn't empty while waiting for the next broadcast.
export function useLiveLocations() {
  const [locationsByDriver, setLocationsByDriver] = useState<Map<string, Location>>(new Map());
  const [status, setStatus] = useState<LiveLocationsStatus>("connecting");

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
      const token = await getAccessToken();

      const snapshot = await getLatestLocations(token);
      if (cancelled) return;
      if (snapshot.ok) {
        setLocationsByDriver(new Map(snapshot.locations.map((l) => [l.driverId, l])));
      }

      const ticketResult = await mintWsTicket(token);
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

  return { locations: Array.from(locationsByDriver.values()), status };
}