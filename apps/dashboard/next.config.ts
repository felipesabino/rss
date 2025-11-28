import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@rss/db"],
  turbopack: {
    root: __dirname,
    resolveAlias: {
      "@rss/db": "./node_modules/@rss/db",
    },
  },
};

export default nextConfig;
