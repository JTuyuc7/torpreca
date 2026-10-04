import type { NextConfig } from "next";
import pkg from "./package.json";

const nextConfig: NextConfig = {
  // @torpreca/shared is consumed as raw TS source (no build step) via a
  // `link:` dependency to packages/shared — Next needs to compile it itself.
  transpilePackages: ["@torpreca/shared"],
  // Shown in the sidebar footer — single source of truth is package.json.
  env: { NEXT_PUBLIC_APP_VERSION: pkg.version },
};

export default nextConfig;
