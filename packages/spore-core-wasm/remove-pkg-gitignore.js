"use strict";

const fs = require("fs");
const path = require("path");

/**
 * Ensure packages/spore-core-wasm/pkg contains the prebuilt Node artifacts.
 * wasm-pack may write under the crate pkg/ depending on out-dir resolution.
 */
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(src, dest);
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

const localPkg = path.join(__dirname, "pkg");
const localEntry = path.join(localPkg, "spore_core_wasm.js");
const cratePkg = path.join(
  __dirname,
  "..",
  "..",
  "crates",
  "spore-core-wasm",
  "pkg"
);
const crateEntry = path.join(cratePkg, "spore_core_wasm.js");

if (!fs.existsSync(localEntry) && fs.existsSync(crateEntry)) {
  copyDir(cratePkg, localPkg);
}

const gitignorePath = path.join(localPkg, ".gitignore");
if (fs.existsSync(gitignorePath)) {
  fs.unlinkSync(gitignorePath);
}

if (!fs.existsSync(path.join(localPkg, "spore_core_wasm.js")) ||
    !fs.existsSync(path.join(localPkg, "spore_core_wasm_bg.wasm"))) {
  console.error(
    "@spore/core-wasm: pkg/ is missing spore_core_wasm.js / spore_core_wasm_bg.wasm after build."
  );
  process.exitCode = 1;
}
