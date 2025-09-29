import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Set the workspace root to fix lockfile warning
  outputFileTracingRoot: __dirname,
  experimental: {
    turbo: {
      root: __dirname,
    },
  },
};

export default nextConfig;
