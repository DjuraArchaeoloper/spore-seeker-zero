import type { NextConfig } from "next";

const sporeCoreWasmPkg = "../../packages/spore-core-wasm/pkg/**/*";

const nextConfig: NextConfig = {
  transpilePackages: ["@spore/shared"],
  // Keep wasm-bindgen's Node loader + .wasm out of Turbopack/webpack.
  serverExternalPackages: ["@spore/core-wasm"],
  outputFileTracingIncludes: {
    "/api/nft/[organismNumber]/image": [
      "../../packages/shared/assets/fonts/**/*",
      "../../packages/shared/assets/organisms/**/*"
    ],
    // Include WASM binary for any future spore-core route handlers.
    "/api/**/*": [sporeCoreWasmPkg]
  }
};

export default nextConfig;
