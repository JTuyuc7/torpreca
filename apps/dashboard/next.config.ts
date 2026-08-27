import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @torpreca/shared is consumed as raw TS source (no build step) via a
  // `link:` dependency to packages/shared — Next needs to compile it itself.
  transpilePackages: ["@torpreca/shared"],
};

export default nextConfig;
