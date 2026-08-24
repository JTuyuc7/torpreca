// Must be the first export: it extends zod with `.openapi()` before any
// schema below is constructed (zod v4 bakes methods per-instance at
// construction time, so extending the prototype later doesn't reach schemas
// already built — see zod.ts). Also re-exports `z` so consumers building
// extra schemas (the backend's OpenAPI registry) use this exact, already
// extended module instance rather than a fresh `import { z } from "zod"`.

export * from "./constants/audit-events";
export * from "./constants/roles";
export * from "./constants/statuses";
export * from "./schemas/audit-log.schema";
export * from "./schemas/auth-user.schema";
export * from "./schemas/daily-report.schema";
export * from "./schemas/location.schema";
export * from "./schemas/route.schema";
export * from "./schemas/stop.schema";
export * from "./schemas/sync-event.schema";
export * from "./schemas/sync-queue-item.schema";
export * from "./schemas/user.schema";
export * from "./schemas/vehicle.schema";
export * from "./schemas/ws-message.schema";
export * from "./zod";
