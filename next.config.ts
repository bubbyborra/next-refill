import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Loaded from node_modules at run time, not bundled: with the production bundle every agent
  // failed one second after start ("agent exits with reason: RTC connection error"), while the
  // same code ran fine unbundled (next dev, tsx).
  serverExternalPackages: ["agora-agents", "agora-token"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
