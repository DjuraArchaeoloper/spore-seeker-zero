"use strict";

const fs = require("fs");
const path = require("path");

function resolvePkgEntry() {
  const candidates = [
    // Vercel / Next workspace execution from apps/api.
    path.resolve(
      process.cwd(),
      "../../packages/spore-core-wasm/pkg/spore_core_wasm.js",
    ),

    // Monorepo-root execution.
    path.resolve(
      process.cwd(),
      "packages/spore-core-wasm/pkg/spore_core_wasm.js",
    ),

    // Direct package execution / local fallback.
    path.join(__dirname, "pkg", "spore_core_wasm.js"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

const pkgEntry = resolvePkgEntry();

if (!pkgEntry) {
  throw new Error(
    "@spore/core-wasm runtime files are missing. Production deploys must ship packages/spore-core-wasm/pkg/.",
  );
}

module.exports = require(pkgEntry);
