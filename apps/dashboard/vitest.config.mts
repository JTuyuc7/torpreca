import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirror tsconfig.json's "@/*" -> "./*" path alias for Vite's resolver —
    // tsc only type-checks it, it doesn't make module resolution work here.
    alias: { "@": path.resolve(import.meta.dirname, ".") },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // lib/backend/signed-fetch.ts throws at import time if these are unset
    // (real values only exist in Render, per environment — see
    // docs/deploy/environment-variables.md). Vitest doesn't auto-load
    // .env.local the way Next.js does, so tests importing that module (or
    // anything that imports it) need a default here — placeholders only,
    // never used to make a real request in tests.
    env: {
      NEXT_PUBLIC_BACKEND_URL: "http://localhost:3000",
      REQUEST_SIGNING_SECRET: "test-placeholder-signing-secret",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["app/**", "lib/**"],
      exclude: ["**/*.test.{ts,tsx}", "**/*.d.ts"],
    },
  },
});