"use strict";

const fs = require("fs");
const path = require("path");

function resolvePkgEntry() {
  const local = path.join(__dirname, "pkg", "spore_core_wasm.js");
  if (fs.existsSync(local)) {
    return local;
  }

  // Monorepo fallback when wasm-pack wrote into the crate pkg/ directory.
  const monorepo = path.join(
    __dirname,
    "..",
    "..",
    "crates",
    "spore-core-wasm",
    "pkg",
    "spore_core_wasm.js"
  );
  if (fs.existsSync(monorepo)) {
    return monorepo;
  }

  return null;
}

const pkgEntry = resolvePkgEntry();

if (!pkgEntry) {
  throw new Error(
    "@spore/core-wasm is not built. From the monorepo root run: npm run build -w @spore/core-wasm (requires Rust, wasm-pack, and rustup target wasm32-unknown-unknown). Production deploys must ship packages/spore-core-wasm/pkg/ prebuilt — Rust is not required at runtime."
  );
}

module.exports = require(pkgEntry);
