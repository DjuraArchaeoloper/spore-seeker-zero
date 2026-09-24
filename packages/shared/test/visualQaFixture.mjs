import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import {
  BODY_FAMILY_SLOTS,
  MORPHOLOGY_PROFILE_BY_FAMILY,
  SEEKER_ZERO_GENOME,
  genomeToHex,
  mix8,
  resolveCreatureFamily
} from "../src/genome.ts";
import { createOrganismRenderModel } from "../src/organismRenderPlan.ts";

const require = createRequire(import.meta.url);
const core = require("../../../packages/spore-core-wasm");

const OUTPUT_DIR = path.resolve("packages/shared/test/.generated/visual-qa");
const ASSET_ROOT = path.resolve("packages/shared/assets/organisms");
const assetDataUriCache = new Map();
const CARD_SIZE = 260;
const CARD_BODY_SIZE = 214;
const CARD_PADDING = 14;
const CARD_LABEL_HEIGHT = 54;
const CARD_WIDTH = CARD_SIZE;
const CARD_HEIGHT = CARD_SIZE + CARD_LABEL_HEIGHT;
const SHEET_GAP = 18;
const SHEET_BACKGROUND = "#05070a";
const CARD_BACKGROUND = "#081116";
const CARD_STROKE = "rgba(181, 238, 226, 0.2)";
const LABEL_PRIMARY = "#e8f5f2";
const LABEL_SECONDARY = "#8aa4aa";
const ENABLE_SVG_FILTERS = false;

const STRUCTURAL_GENE_BY_PROFILE_KEY = {
  bodyForm: 0,
  proportion: 1,
  membrane: 2,
  appendageFamily: 8,
  appendageExpression: 9,
  asymmetry: 15
};

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const fixtures = {
    genes: geneMutationFixtures(),
    families: familyFixtures(),
    seekerChildren: seekerChildFixtures(),
    lineages: lineageFixtures(),
    transitions: transitionFixtures()
  };

  const outputs = [
    await renderSheet("gene-mutations", fixtures.genes, 4),
    await renderSheet("all-families", fixtures.families, 5),
    await renderSheet("seeker-zero-real-children", fixtures.seekerChildren, 4),
    await renderSheet("lineages", fixtures.lineages, 4),
    await renderSheet("family-transitions", fixtures.transitions, 4)
  ];
  const summaryPath = path.join(OUTPUT_DIR, "summary.json");
  const htmlPath = path.join(OUTPUT_DIR, "index.html");

  await writeFile(
    summaryPath,
    `${JSON.stringify(
      Object.fromEntries(
        Object.entries(fixtures).map(([key, items]) => [
          key,
          items.map((item) => ({
            label: item.label,
            sublabel: item.sublabel,
            family: item.model.family.id,
            genome: item.genomeHex
          }))
        ])
      ),
      null,
      2
    )}\n`
  );
  await writeFile(
    htmlPath,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>SPØR Evolution V2 Visual QA</title>
  <style>
    body { margin: 0; padding: 24px; background: ${SHEET_BACKGROUND}; color: ${LABEL_PRIMARY}; font-family: Arial, sans-serif; }
    h1 { font-size: 20px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; }
    h2 { color: ${LABEL_SECONDARY}; font-size: 13px; font-weight: 500; letter-spacing: 0.12em; margin: 28px 0 10px; text-transform: uppercase; }
    img { display: block; max-width: 100%; height: auto; border: 1px solid ${CARD_STROKE}; }
  </style>
</head>
<body>
  <h1>SPØR Evolution V2 Visual QA</h1>
  ${outputs
    .map(
      (output) => `<h2>${escapeHtml(output.title)}</h2>
  <img src="${path.basename(output.path)}" alt="${escapeHtml(output.title)}">`
    )
    .join("\n  ")}
</body>
</html>
`
  );

  console.log(JSON.stringify({ outputDir: OUTPUT_DIR, htmlPath, summaryPath, sheets: outputs }, null, 2));
}

function geneMutationFixtures() {
  return Array.from({ length: 16 }, (_, gene) => {
    const child = withGene(SEEKER_ZERO_GENOME, gene, representativeMutationValue(SEEKER_ZERO_GENOME[gene], gene));

    return pairFixture(`Gene ${gene}`, `parent → ${geneName(gene)}`, SEEKER_ZERO_GENOME, child);
  }).flat();
}

function familyFixtures() {
  return BODY_FAMILY_SLOTS.map((family) => {
    const genome = genomeNearProfile(MORPHOLOGY_PROFILE_BY_FAMILY[family]);

    return organismFixture(family, genomeToHex(genome), genome);
  });
}

function seekerChildFixtures() {
  const parent = Array.from(SEEKER_ZERO_GENOME);
  const children = [];

  for (let index = 0; children.length < 12 && index < 512; index += 1) {
    const child = mutateChildGenome(parent, index, 1, index + 1);
    const changedGene = child.findIndex((value, gene) => value !== parent[gene]);

    children.push(
      organismFixture(
        `Child ${index + 1}`,
        `gene ${changedGene}: ${resolveCreatureFamily(parent)} → ${resolveCreatureFamily(child)}`,
        child
      )
    );
  }

  return [organismFixture("Seeker Zero", "parent", parent), ...children];
}

function lineageFixtures() {
  const output = [];

  for (let line = 0; line < 4; line += 1) {
    let genome = Array.from(SEEKER_ZERO_GENOME);
    output.push(organismFixture(`Line ${line + 1}.0`, resolveCreatureFamily(genome), genome));

    for (let generation = 1; generation <= 5; generation += 1) {
      genome = mutateChildGenome(genome, line + 100, generation, line * 1000 + generation);
      output.push(organismFixture(`Line ${line + 1}.${generation}`, resolveCreatureFamily(genome), genome));
    }
  }

  return output;
}

function transitionFixtures() {
  const pairs = [];
  const queue = [Array.from(SEEKER_ZERO_GENOME)];
  const seen = new Set([genomeToHex(SEEKER_ZERO_GENOME)]);

  for (let index = 0; pairs.length < 8 && index < queue.length && index < 256; index += 1) {
    const parent = queue[index];
    const parentFamily = resolveCreatureFamily(parent);

    for (let attempt = 0; attempt < 64 && pairs.length < 8; attempt += 1) {
      const child = mutateChildGenome(parent, index * 1000 + attempt, attempt + 1, index * 10000 + attempt + 1);
      const childHex = genomeToHex(child);

      if (!seen.has(childHex)) {
        queue.push(child);
        seen.add(childHex);
      }

      const childFamily = resolveCreatureFamily(child);
      if (childFamily !== parentFamily) {
        const changedGene = child.findIndex((value, gene) => value !== parent[gene]);
        pairs.push(
          pairFixture(
            `Transition ${pairs.length + 1}`,
            `gene ${changedGene}: ${parentFamily} → ${childFamily}`,
            parent,
            child
          )
        );
      }
    }
  }

  return pairs.flat();
}

function pairFixture(label, sublabel, parentGenome, childGenome) {
  return [
    organismFixture(`${label} parent`, resolveCreatureFamily(parentGenome), parentGenome),
    organismFixture(`${label} child`, sublabel, childGenome)
  ];
}

function organismFixture(label, sublabel, genome) {
  const genomeHex = genomeToHex(genome);

  return {
    genomeHex,
    label,
    model: createOrganismRenderModel(genome, CARD_BODY_SIZE),
    sublabel
  };
}

async function renderSheet(name, fixtures, columns) {
  const rows = Math.ceil(fixtures.length / columns);
  const width = columns * CARD_WIDTH + (columns + 1) * SHEET_GAP;
  const height = rows * CARD_HEIGHT + (rows + 1) * SHEET_GAP;
  const body = fixtures
    .map((fixture, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = SHEET_GAP + column * (CARD_WIDTH + SHEET_GAP);
      const y = SHEET_GAP + row * (CARD_HEIGHT + SHEET_GAP);

      return cardSvg(fixture, x, y, `${name}-${index}`);
    })
    .join("\n");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${SHEET_BACKGROUND}"/>
  ${body}
</svg>`;
  const svgPath = path.join(OUTPUT_DIR, `${name}.svg`);
  const pngPath = path.join(OUTPUT_DIR, `${name}.png`);

  await writeFile(svgPath, svg);
  await sharp(Buffer.from(svg)).png().toFile(pngPath);

  return { path: pngPath, title: name };
}

function cardSvg(fixture, x, y, idPrefix) {
  const innerX = x + CARD_PADDING;
  const innerY = y + CARD_PADDING;
  const labelY = y + CARD_SIZE + 18;

  return `<g>
    <rect x="${x}" y="${y}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="8" fill="${CARD_BACKGROUND}" stroke="${CARD_STROKE}"/>
    ${organismSvg(fixture.model, innerX, innerY, idPrefix)}
    <text x="${innerX}" y="${labelY}" fill="${LABEL_PRIMARY}" font-family="Arial, sans-serif" font-size="12" letter-spacing="1.3">${escapeHtml(
      fixture.label
    )}</text>
    <text x="${innerX}" y="${labelY + 17}" fill="${LABEL_SECONDARY}" font-family="Arial, sans-serif" font-size="10">${escapeHtml(
      fixture.sublabel
    )}</text>
    <text x="${innerX}" y="${labelY + 33}" fill="${LABEL_SECONDARY}" font-family="Arial, sans-serif" font-size="8" letter-spacing="0.8">${fixture.genomeHex.toUpperCase()}</text>
  </g>`;
}

function organismSvg(model, x, y, idPrefix) {
  const size = CARD_BODY_SIZE;
  const assets = {
    body: assetDataUri(model.family.layers.body),
    core: assetDataUri(model.family.layers.core),
    fins: assetDataUri(model.family.layers.fins),
    glow: assetDataUri(model.family.layers.glow),
    surface: assetDataUri(model.family.layers.surface),
    tendrils: assetDataUri(model.family.layers.tendrils)
  };
  const colors = model.colorPlan;
  const plan = model.plan;
  const presenceGlow = model.presenceGlow;

  return `<g transform="translate(${x} ${y})">
    <defs>
      ${colorFilter(`${idPrefix}-color`, colors.colorMatrix)}
      ${colorFilter(`${idPrefix}-glow`, colors.glowMatrix)}
      ${colorFilter(`${idPrefix}-core`, colors.coreMatrix)}
      ${colorFilter(`${idPrefix}-surface`, colors.surfaceMatrix)}
      ${colorFilter(`${idPrefix}-filament`, colors.filamentMatrix)}
      ${colorFilter(`${idPrefix}-halo`, colors.glowMatrix, plan.haloBlur)}
      ${blurFilter(`${idPrefix}-presence-atmosphere`, presenceGlow.atmosphere.blur)}
      ${blurFilter(`${idPrefix}-presence-core`, presenceGlow.core.blur)}
      ${plan.sensoryNodes.map((node, index) => blurFilter(`${idPrefix}-sensory-${index}`, node.radius * 0.75)).join("\n      ")}
    </defs>
    <rect width="${size}" height="${size}" rx="6" fill="#05090c"/>
    ${presenceGlowSvg(presenceGlow, idPrefix)}
    <g ${transformAttribute(plan.biologicalTransform, plan.center)}>
      ${imageLayer({
        blendMode: "screen",
        filterId: `${idPrefix}-halo`,
        href: assets.glow,
        opacity: plan.haloOpacity,
        origin: plan.center,
        size,
        transform: plan.haloTransform
      })}
      ${imageLayer({
        blendMode: "screen",
        filterId: `${idPrefix}-glow`,
        href: assets.glow,
        opacity: plan.glowOpacity,
        origin: plan.center,
        size,
        transform: plan.glowTransform
      })}
      <g opacity="${format(plan.baseAnatomyOpacity)}" filter="url(#${idPrefix}-color)">
        <g ${transformAttribute(plan.finTransform, plan.center)}>${image(assets.fins, size)}</g>
        <g opacity="${format(plan.finAccentOpacity)}" ${transformAttribute(
          [...plan.finTransform, { scaleX: plan.finAccentScaleX }, { scaleY: plan.finAccentScaleY }, { rotate: plan.finAccentRotation }],
          plan.center
        )}>${image(assets.fins, size)}</g>
        <g ${transformAttribute(plan.bodyTransform, plan.center)}>${image(assets.body, size)}</g>
      </g>
      ${imageLayer({
        filterId: `${idPrefix}-color`,
        href: assets.tendrils,
        opacity: plan.tendrilOpacity,
        origin: plan.center,
        size,
        transform: plan.tendrilTransform
      })}
      ${imageLayer({
        blendMode: "screen",
        filterId: `${idPrefix}-core`,
        href: assets.core,
        opacity: plan.coreOpacity,
        origin: plan.center,
        size,
        transform: plan.coreTransform
      })}
      ${surfaceSvg(assets.surface, plan, idPrefix, size)}
      ${sensoryNodesSvg(plan, colors.nodeColor, idPrefix)}
    </g>
  </g>`;
}

function surfaceSvg(href, plan, idPrefix, size) {
  const internal = imageLayer({
    blendMode: "screen",
    filterId: `${idPrefix}-filament`,
    href,
    opacity: plan.internalFilamentOpacity,
    origin: plan.center,
    size,
    transform: plan.internalFilamentTransform
  });
  const surface = plan.surfaceLayers
    .map((layer) =>
      imageLayer({
        filterId: `${idPrefix}-surface`,
        href,
        opacity: layer.opacity,
        origin: plan.center,
        size,
        transform: layer.transform
      })
    )
    .join("\n");

  return `${internal}\n${surface}`;
}

function presenceGlowSvg(plan, idPrefix) {
  return `<g ${transformAttribute(plan.atmosphere.transform, plan.center)}>
    <circle cx="${format(plan.atmosphere.cx)}" cy="${format(plan.atmosphere.cy)}" r="${format(
      plan.atmosphere.radius
    )}" fill="${plan.atmosphere.color}"${filterAttribute(`${idPrefix}-presence-atmosphere`)}/>
  </g>
  <g ${transformAttribute(plan.core.transform, plan.center)}>
    <circle cx="${format(plan.core.cx)}" cy="${format(plan.core.cy)}" r="${format(
      plan.core.radius
    )}" fill="${plan.core.color}"${filterAttribute(`${idPrefix}-presence-core`)}/>
  </g>`;
}

function sensoryNodesSvg(plan, color, idPrefix) {
  return plan.sensoryNodes
    .map(
      (node, index) => `<g>
      <circle cx="${format(node.x)}" cy="${format(node.y)}" r="${format(
        node.radius * 1.65
      )}" fill="${color}" opacity="${format(node.opacity * 0.08)}"${filterAttribute(`${idPrefix}-sensory-${index}`)}/>
      <circle cx="${format(node.x)}" cy="${format(node.y)}" r="${format(node.radius)}" fill="${color}" opacity="${format(
        node.opacity
      )}"/>
    </g>`
    )
    .join("\n");
}

function imageLayer({ blendMode, filterId, href, opacity, origin, size, transform }) {
  if (opacity <= 0) {
    return "";
  }

  return `<g opacity="${format(clamp(opacity, 0, 1))}"${blendMode ? ` style="mix-blend-mode:${blendMode}"` : ""}${
    filterId && ENABLE_SVG_FILTERS ? ` filter="url(#${filterId})"` : ""
  } ${transformAttribute(transform, origin)}>
    ${image(href, size)}
  </g>`;
}

function filterAttribute(id) {
  return ENABLE_SVG_FILTERS ? ` filter="url(#${id})"` : "";
}

function image(href, size) {
  return `<image href="${href}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="none"/>`;
}

function colorFilter(id, matrix, blur) {
  const input = blur && blur > 0 ? "blurred" : "SourceGraphic";
  const extent = CARD_BODY_SIZE * 6;

  return `<filter id="${id}"${
    blur && blur > 0
      ? ` filterUnits="userSpaceOnUse" x="-${extent}" y="-${extent}" width="${extent * 2}" height="${extent * 2}"`
      : ""
  } color-interpolation-filters="sRGB">
      ${blur && blur > 0 ? `<feGaussianBlur in="SourceGraphic" stdDeviation="${format(blur)}" result="blurred"/>` : ""}
      <feColorMatrix in="${input}" type="matrix" values="${matrix.map(format).join(" ")}"/>
    </filter>`;
}

function blurFilter(id, blur) {
  const extent = CARD_BODY_SIZE * 6;

  return `<filter id="${id}" filterUnits="userSpaceOnUse" x="-${extent}" y="-${extent}" width="${
    extent * 2
  }" height="${extent * 2}">
      <feGaussianBlur in="SourceGraphic" stdDeviation="${format(blur)}"/>
    </filter>`;
}

function transformAttribute(transforms, origin) {
  if (!transforms || transforms.length === 0) {
    return "";
  }

  const transform = transforms.map(svgTransform).join(" ");
  const value = origin
    ? `translate(${format(origin.x)} ${format(origin.y)}) ${transform} translate(${format(-origin.x)} ${format(
        -origin.y
      )})`
    : transform;

  return `transform="${value}"`;
}

function svgTransform(transform) {
  if ("translateX" in transform) {
    return `translate(${format(transform.translateX)} 0)`;
  }
  if ("translateY" in transform) {
    return `translate(0 ${format(transform.translateY)})`;
  }
  if ("scale" in transform) {
    return `scale(${format(transform.scale)})`;
  }
  if ("scaleX" in transform) {
    return `scale(${format(transform.scaleX)} 1)`;
  }
  if ("scaleY" in transform) {
    return `scale(1 ${format(transform.scaleY)})`;
  }

  return `rotate(${format((transform.rotate * 180) / Math.PI)})`;
}

function assetDataUri(relativePath) {
  const resolved = path.resolve(ASSET_ROOT, relativePath);
  const cached = assetDataUriCache.get(resolved);

  if (cached) {
    return cached;
  }

  const dataUri = `data:image/png;base64,${readFileSync(resolved).toString("base64")}`;

  assetDataUriCache.set(resolved, dataUri);

  return dataUri;
}

function genomeNearProfile(profile) {
  const genome = Array.from(SEEKER_ZERO_GENOME);

  for (const [key, index] of Object.entries(STRUCTURAL_GENE_BY_PROFILE_KEY)) {
    genome[index] = byteClosestToUnit(profile[key]);
  }

  return genome;
}

function byteClosestToUnit(target) {
  let bestByte = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let byte = 0; byte <= 255; byte += 1) {
    const distance = Math.abs(mix8(byte) / 255 - target);

    if (distance < bestDistance) {
      bestByte = byte;
      bestDistance = distance;
    }
  }

  return bestByte;
}

function mutateChildGenome(parentGenome, line, generation, childNumber) {
  return Array.from(
    core.mutate_child_genome(
      Uint8Array.from(parentGenome),
      deterministicBytes(line * 1009 + generation * 17),
      deterministicBytes(line * 1877 + generation * 31),
      BigInt(childNumber),
      BigInt(500000 + line * 97 + generation * 13),
      BigInt(1800000000 + line * 53 + generation * 7)
    )
  );
}

function deterministicBytes(seed) {
  return Uint8Array.from({ length: 32 }, (_, index) => (seed * 73 + index * 41 + 17) & 0xff);
}

function withGene(genome, index, value) {
  const nextGenome = Array.from(genome);
  nextGenome[index] = value;

  return nextGenome;
}

function representativeMutationValue(currentValue, gene) {
  const value = (currentValue + 137 + gene * 11) & 0xff;

  return value === currentValue ? (value + 1) & 0xff : value;
}

function geneName(gene) {
  return [
    "body form",
    "body proportion",
    "membrane shape",
    "membrane density",
    "pigment",
    "bioluminescence",
    "nucleus",
    "sensory nodes",
    "appendage family",
    "appendage expression",
    "surface pattern",
    "surface density",
    "internal filaments",
    "external halo",
    "motion / pulse",
    "asymmetry"
  ][gene];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function format(value) {
  if (Math.abs(value) < 0.000001) {
    return "0";
  }

  return Number(value.toFixed(6)).toString();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

await main();
