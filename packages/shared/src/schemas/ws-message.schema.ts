import { z } from "../zod";
import { CreateLocationSchema, LocationSchema } from "./location.schema";

// Driver -> server, over the /ws connection, once authenticated.
export const WsLocationPingSchema = z.object({
  type: z.literal("location:ping"),
  payload: CreateLocationSchema,
});

export type WsLocationPing = z.infer<typeof WsLocationPingSchema>;

// Server -> dashboard clients subscribed to the "tracking" topic.
export const WsLocationBroadcastSchema = z.object({
  type: z.literal("location:broadcast"),
  payload: LocationSchema,
});

export type WsLocationBroadcast = z.infer<typeof WsLocationBroadcastSchema>;

// Server -> any client, on a rejected/invalid inbound message.
export const WsErrorSchema = z.object({
  type: z.literal("error"),
  message: z.string(),
});

export type WsError = z.infer<typeof WsErrorSchema>;

// Discriminated union of everything a client may send. Extend with more
// variants here as they're added — don't add message types speculatively.
export const WsInboundMessageSchema = WsLocationPingSchema;

export type WsInboundMessage = z.infer<typeof WsInboundMessageSchema>;
