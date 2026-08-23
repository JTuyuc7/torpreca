import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { env } from "../core/config/env";
import { registry } from "./registry";

// Generated once per process — the registry is static after module load.
export const openApiDocument = new OpenApiGeneratorV31(registry.definitions).generateDocument({
  openapi: "3.1.0",
  info: {
    title: "Torpreca API",
    version: "1.0.0",
    description: "REST API for Torpreca fleet route management (PG2 — UMG).",
  },
  servers: [{ url: `http://localhost:${env.PORT}`, description: "Local" }],
});
