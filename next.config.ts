import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "googleapis"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  agentRules: false,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
