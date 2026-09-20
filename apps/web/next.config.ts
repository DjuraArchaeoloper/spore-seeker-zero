import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true
  },
  transpilePackages: ["@spore/shared"]
};

export default nextConfig;
