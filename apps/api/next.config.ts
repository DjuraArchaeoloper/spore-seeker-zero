import path from "node:path";
import type { NextConfig } from "next";

const sporeCoreWasmPkg = "../../packages/spore-core-wasm/**/*";

const nextConfig: NextConfig = {
  transpilePackages: ["@spore/shared"],

  // Keep wasm-bindgen's Node loader + .wasm as a native Node package.
  serverExternalPackages: ["@spore/core-wasm"],

  // The API app lives under apps/api, while the local WASM package
  // lives at packages/spore-core-wasm.
  outputFileTracingRoot: path.join(process.cwd(), "../.."),

  outputFileTracingIncludes: {
    "/api/nft/[organismNumber]/image": [
      "../../packages/shared/assets/fonts/**/*",
      "../../packages/shared/assets/organisms/**/*"
    ],

    // Ship the complete external workspace package, including its
    // package.json, Node loader, generated JS and .wasm binary.
    "/api/**/*": [sporeCoreWasmPkg]
  }
};

export default nextConfig;