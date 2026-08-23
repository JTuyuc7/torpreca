import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  type ResponseConfig,
  type RouteConfig,
} from "@asteasolutions/zod-to-openapi";
import {
  CreateRouteSchema,
  CreateStopSchema,
  CreateUserSchema,
  CreateVehicleSchema,
  FinishRouteSchema,
  RouteSchema,
  StopSchema,
  UserSchema,
  VehicleSchema,
  z,
} from "@torpreca/shared";

// `registry.register()` calls `zodSchema.openapi(refId)` under the hood — that
// method only exists once this runs, so it must happen before any register() call.
// Using shared's re-exported `z` (not a fresh `import { z } from "zod"`) matters:
// it's the exact module instance the shared schemas were built with.
extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "Supabase JWT",
});

const ErrorSchema = registry.register(
  "Error",
  z.object({
    error: z.string(),
    issues: z.unknown().optional(),
  }),
);

function jsonResponse(description: string, schema: z.ZodType): ResponseConfig {
  return { description, content: { "application/json": { schema } } };
}

const errorResponse = (description: string) => jsonResponse(description, ErrorSchema);

const unauthorized = errorResponse("Missing or invalid token");
const forbidden = errorResponse("Insufficient role");
const notFound = errorResponse("Resource not found");
const badRequest = errorResponse("Body failed zod validation");

const Vehicle = registry.register("Vehicle", VehicleSchema);
const CreateVehicle = registry.register("CreateVehicle", CreateVehicleSchema);
const User = registry.register("User", UserSchema);
const CreateUser = registry.register("CreateUser", CreateUserSchema);
const Route = registry.register("Route", RouteSchema);
const CreateRoute = registry.register("CreateRoute", CreateRouteSchema);
const FinishRoute = registry.register("FinishRoute", FinishRouteSchema);
const Stop = registry.register("Stop", StopSchema);
const CreateStop = registry.register("CreateStop", CreateStopSchema.omit({ routeId: true }));

const IdParam = z.object({ id: z.uuid() });
const RouteIdParam = z.object({ routeId: z.uuid() });
const OnlyActiveQuery = z.object({
  all: z.enum(["true", "false"]).optional().describe("Set to 'true' to include inactive rows"),
});

const authed = { security: [{ bearerAuth: [] }] };

// Every module route lives under /api/v1 (see Router#withPrefix in index.ts) —
// /health is the one unversioned route and is registered separately, below.
function path(config: RouteConfig) {
  registry.registerPath({ ...authed, ...config, path: `/api/v1${config.path}` });
}

// --- vehicles ---
path({
  method: "get",
  path: "/vehicles",
  tags: ["Vehicles"],
  summary: "List vehicles",
  request: { query: OnlyActiveQuery },
  responses: { 200: jsonResponse("Vehicles", z.array(Vehicle)), 401: unauthorized },
});
path({
  method: "get",
  path: "/vehicles/{id}",
  tags: ["Vehicles"],
  summary: "Get a vehicle by id",
  request: { params: IdParam },
  responses: { 200: jsonResponse("Vehicle", Vehicle), 401: unauthorized, 404: notFound },
});
path({
  method: "post",
  path: "/vehicles",
  tags: ["Vehicles"],
  summary: "Create a vehicle",
  request: { body: { content: { "application/json": { schema: CreateVehicle } } } },
  responses: {
    201: jsonResponse("Vehicle created", Vehicle),
    400: badRequest,
    401: unauthorized,
    403: forbidden,
  },
});
path({
  method: "delete",
  path: "/vehicles/{id}",
  tags: ["Vehicles"],
  summary: "Deactivate a vehicle",
  request: { params: IdParam },
  responses: {
    204: { description: "Deactivated" },
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
});

// --- users ---
path({
  method: "get",
  path: "/users",
  tags: ["Users"],
  summary: "List users",
  request: { query: OnlyActiveQuery },
  responses: { 200: jsonResponse("Users", z.array(User)), 401: unauthorized, 403: forbidden },
});
path({
  method: "get",
  path: "/users/{id}",
  tags: ["Users"],
  summary: "Get a user by id",
  request: { params: IdParam },
  responses: { 200: jsonResponse("User", User), 401: unauthorized, 403: forbidden, 404: notFound },
});
path({
  method: "post",
  path: "/users",
  tags: ["Users"],
  summary: "Create a user",
  request: { body: { content: { "application/json": { schema: CreateUser } } } },
  responses: {
    201: jsonResponse("User created", User),
    400: badRequest,
    401: unauthorized,
    403: forbidden,
  },
});
path({
  method: "delete",
  path: "/users/{id}",
  tags: ["Users"],
  summary: "Deactivate a user",
  request: { params: IdParam },
  responses: {
    204: { description: "Deactivated" },
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
});

// --- routes ---
path({
  method: "get",
  path: "/routes",
  tags: ["Routes"],
  summary: "List routes visible to the caller",
  request: { query: z.object({ date: z.iso.date().optional() }) },
  responses: { 200: jsonResponse("Routes", z.array(Route)), 401: unauthorized },
});
path({
  method: "get",
  path: "/routes/{id}",
  tags: ["Routes"],
  summary: "Get a route by id",
  request: { params: IdParam },
  responses: {
    200: jsonResponse("Route", Route),
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
});
path({
  method: "post",
  path: "/routes",
  tags: ["Routes"],
  summary: "Create a route",
  request: { body: { content: { "application/json": { schema: CreateRoute } } } },
  responses: {
    201: jsonResponse("Route created", Route),
    400: badRequest,
    401: unauthorized,
    403: forbidden,
  },
});
path({
  method: "patch",
  path: "/routes/{id}/start",
  tags: ["Routes"],
  summary: "Driver starts their route",
  request: { params: IdParam },
  responses: {
    200: jsonResponse("Route started", Route),
    401: unauthorized,
    403: forbidden,
    404: notFound,
    409: errorResponse("Route not in a startable state"),
  },
});
path({
  method: "patch",
  path: "/routes/{id}/finish",
  tags: ["Routes"],
  summary: "Driver finishes their route",
  request: {
    params: IdParam,
    body: { content: { "application/json": { schema: FinishRoute } } },
  },
  responses: {
    200: jsonResponse("Route finished", Route),
    400: badRequest,
    401: unauthorized,
    403: forbidden,
    404: notFound,
    409: errorResponse("Route not in a finishable state"),
  },
});

// --- stops ---
path({
  method: "get",
  path: "/routes/{routeId}/stops",
  tags: ["Stops"],
  summary: "List stops of a route",
  request: { params: RouteIdParam },
  responses: {
    200: jsonResponse("Stops", z.array(Stop)),
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
});
path({
  method: "post",
  path: "/routes/{routeId}/stops",
  tags: ["Stops"],
  summary: "Add a stop to a route",
  request: {
    params: RouteIdParam,
    body: { content: { "application/json": { schema: CreateStop } } },
  },
  responses: {
    201: jsonResponse("Stop created", Stop),
    400: badRequest,
    401: unauthorized,
    403: forbidden,
    404: notFound,
  },
});
path({
  method: "patch",
  path: "/stops/{id}/complete",
  tags: ["Stops"],
  summary: "Driver marks a stop as completed",
  request: { params: IdParam },
  responses: {
    200: jsonResponse("Stop completed", Stop),
    401: unauthorized,
    403: forbidden,
    404: notFound,
    409: errorResponse("Stop not in a completable state"),
  },
});
path({
  method: "patch",
  path: "/stops/{id}/delay",
  tags: ["Stops"],
  summary: "Driver marks a stop as delayed",
  request: { params: IdParam },
  responses: {
    200: jsonResponse("Stop delayed", Stop),
    401: unauthorized,
    403: forbidden,
    404: notFound,
    409: errorResponse("Stop not in a delayable state"),
  },
});

// --- health ---
registry.registerPath({
  method: "get",
  path: "/health",
  tags: ["Health"],
  summary: "Liveness check",
  responses: { 200: jsonResponse("OK", z.object({ ok: z.boolean() })) },
});
