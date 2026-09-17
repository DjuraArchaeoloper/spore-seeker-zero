import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@spore/shared"],
  outputFileTracingIncludes: {
    "/api/nft/[organismNumber]/image": ["../../packages/shared/assets/organisms/**/*"]
  }
};

export default nextConfig;
