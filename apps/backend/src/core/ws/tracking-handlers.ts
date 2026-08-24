import type { AuthUser, CreateLocationInput, Location } from "@torpreca/shared";
import { WsInboundMessageSchema } from "@torpreca/shared";
import type { TrackingSocketData } from "./upgrade";

const TRACKING_TOPIC = "tracking";

// Duck-typed subset of Bun's ServerWebSocket<TrackingSocketData> actually
// used — keeps these handlers unit-testable against a plain fake object,
// with no dependency on a real Bun.serve instance.
export interface TrackingWs {
  data: TrackingSocketData;
  send(data: string): void;
  subscribe(topic: string): void;
  unsubscribe(topic: string): void;
}

export interface TrackingHandlerDeps {
  recordPing: (input: CreateLocationInput, user: AuthUser) => Promise<Location>;
  // server.publish, not ws.publish — ws.publish excludes the sender, and this
  // is injected as a bare function decoupled from any one connection.
  publish: (topic: string, message: string) => void;
}

function sendError(ws: TrackingWs, message: string) {
  ws.send(JSON.stringify({ type: "error", message }));
}

export function handleOpen(ws: TrackingWs) {
  ws.subscribe(TRACKING_TOPIC);
}

export async function handleMessage(
  ws: TrackingWs,
  raw: string | Buffer,
  deps: TrackingHandlerDeps,
) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString());
  } catch {
    sendError(ws, "Invalid JSON");
    return;
  }

  const result = WsInboundMessageSchema.safeParse(parsed);
  if (!result.success) {
    sendError(ws, "Invalid message");
    return;
  }

  if (!ws.data.pingBucket.tryConsume()) {
    sendError(ws, "Rate limit exceeded");
    return;
  }

  try {
    const location = await deps.recordPing(result.data.payload, ws.data.user);
    deps.publish(TRACKING_TOPIC, JSON.stringify({ type: "location:broadcast", payload: location }));
  } catch (err) {
    sendError(ws, err instanceof Error ? err.message : "Failed to record ping");
  }
}

export function handleClose(ws: TrackingWs) {
  ws.unsubscribe(TRACKING_TOPIC);
}
