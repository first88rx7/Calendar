import type { NextConfig } from "next";

const lowMem = process.env.LOW_MEM_BUILD === "1";

const nextConfig: NextConfig = {
  output: lowMem ? undefined : "standalone",
  serverExternalPackages: ["better-sqlite3", "googleapis"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  agentRules: false,
  images: {
    unoptimized: true,
  },
  productionBrowserSourceMaps: false,
  typescript: {
    // LXC builds skip tsc so webpack and typecheck are not in RAM at once.
    ignoreBuildErrors: lowMem,
  },
  experimental: lowMem
    ? {
        cpus: 1,
        workerThreads: false,
        webpackBuildWorker: false,
        webpackMemoryOptimizations: true,
        parallelServerBuildTraces: false,
        parallelServerCompiles: false,
      }
    : undefined,
};

export default nextConfig;
