import path from "node:path";
import type { NextConfig } from "next";

const sporeCoreWasmPkg = "../../packages/spore-core-wasm/pkg/**/*";

const nextConfig: NextConfig = {
  // Pages Router dependencies must be bundled into the server function.
  bundlePagesRouterDependencies: true,
  transpilePackages: ["@spore/shared", "@spore/core-wasm"],

  // Trace files from the monorepo root.
  outputFileTracingRoot: path.join(process.cwd(), "../.."),

  outputFileTracingIncludes: {
    "/api/nft/[organismNumber]/image": [
      "../../packages/shared/assets/fonts/**/*",
      "../../packages/shared/assets/organisms/**/*",
    ],

    // wasm-pack --target nodejs loads this binary from disk at runtime.
    "/api/**/*": [sporeCoreWasmPkg],
  },
};

export default nextConfig;
