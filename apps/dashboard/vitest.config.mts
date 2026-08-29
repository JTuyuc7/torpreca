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
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["app/**", "lib/**"],
      exclude: ["**/*.test.{ts,tsx}", "**/*.d.ts"],
    },
  },
});