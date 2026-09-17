import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import * as opentype from "opentype.js";
import sharp from "sharp";
import {
  createOrganismRenderModel,
  parseGenomeHex,
  SPORE_NFT_IMAGE_SIZE,
  type OrganismColorPlan,
  type OrganismPoint,
  type OrganismRenderPlan,
  type OrganismRenderTransform,
  type PresenceGlowPlan,
  type SurfaceMode
} from "@spore/shared";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const IMAGE_BACKGROUND = "#05070a";
const FILTER_EXTENT = SPORE_NFT_IMAGE_SIZE * 1.5;
const CARD_FONT_FILE = "Michroma_400Regular.ttf";
const CARD_TEXT = {
  primary: "#f7fbfb",
  secondary: "#b8ced3",
  tertiary: "#87a1a8",
  accent: "#b5eee2"
} as const;
const dataUriCache = new Map<string, string>();
let cardFontCache: opentype.Font | null = null;

export type NftOrganismImageIdentity = {
  generation: number;
  organismNumber: string;
};

export async function renderOrganismPng(genomeHex: string, identity: NftOrganismImageIdentity) {
  const genome = parseGenomeHex(genomeHex);
  const model = createOrganismRenderModel(genome, SPORE_NFT_IMAGE_SIZE);
  const assets = {
    body: getSharedAssetDataUri(model.family.layers.body),
    core: getSharedAssetDataUri(model.family.layers.core),
    fins: getSharedAssetDataUri(model.family.layers.fins),
    glow: getSharedAssetDataUri(model.family.layers.glow),
    moustache: model.showMoustache ? getSharedAssetDataUri(model.moustacheAssetPath) : null,
    surface: getSharedAssetDataUri(model.family.layers.surface),
    tendrils: getSharedAssetDataUri(model.family.layers.tendrils)
  };
  const moustacheMetadata = model.showMoustache
    ? await sharp(resolveSharedAssetPath(model.moustacheAssetPath)).metadata()
    : null;
  const moustacheAspect =
    moustacheMetadata?.width && moustacheMetadata.height
      ? moustacheMetadata.height / moustacheMetadata.width
      : 0.35;
  const svg = renderOrganismSvg({
    assets,
    colors: model.colorPlan,
    genomeHex,
    identity,
    moustacheAspect,
    plan: model.plan,
    presenceGlow: model.presenceGlow,
    showMoustache: model.showMoustache,
    surfaceMode: model.phenotype.surface.mode
  });

  return sharp(Buffer.from(svg)).png().toBuffer();
}

function renderOrganismSvg({
  assets,
  colors,
  genomeHex,
  identity,
  moustacheAspect,
  plan,
  presenceGlow,
  showMoustache,
  surfaceMode
}: {
  assets: Record<"body" | "core" | "fins" | "glow" | "surface" | "tendrils", string> & {
    moustache: string | null;
  };
  colors: OrganismColorPlan;
  genomeHex: string;
  identity: NftOrganismImageIdentity;
  moustacheAspect: number;
  plan: OrganismRenderPlan;
  presenceGlow: PresenceGlowPlan;
  showMoustache: boolean;
  surfaceMode: SurfaceMode;
}) {
  const size = SPORE_NFT_IMAGE_SIZE;
  const card = createCardIdentity(identity, genomeHex);

  return `<svg xmlns="${SVG_NAMESPACE}" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img">
  <defs>
    <radialGradient id="cardAura" cx="50%" cy="42%" r="62%">
      <stop offset="0%" stop-color="#173a3c" stop-opacity="0.36"/>
      <stop offset="48%" stop-color="#081318" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${IMAGE_BACKGROUND}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="lowerQuiet" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#020607" stop-opacity="0"/>
      <stop offset="58%" stop-color="#020607" stop-opacity="0.46"/>
      <stop offset="100%" stop-color="#020607" stop-opacity="0.86"/>
    </linearGradient>
    ${colorFilter("color", colors.colorMatrix)}
    ${colorFilter("glow", colors.glowMatrix)}
    ${colorFilter("core", colors.coreMatrix)}
    ${colorFilter("surface", colors.surfaceMatrix)}
    ${colorFilter("filament", colors.filamentMatrix)}
    ${colorFilter("haloGlow", colors.glowMatrix, plan.haloBlur)}
    ${blurFilter("presenceAtmosphere", presenceGlow.atmosphere.blur)}
    ${blurFilter("presenceCore", presenceGlow.core.blur)}
    ${plan.sensoryNodes
      .map((node, index) => blurFilter(`sensory-${index}`, node.radius * 0.75))
      .join("\n    ")}
  </defs>
  <rect width="${size}" height="${size}" fill="${IMAGE_BACKGROUND}"/>
  <rect width="${size}" height="${size}" fill="url(#cardAura)"/>
  <circle cx="600" cy="500" r="430" fill="${CARD_TEXT.accent}" opacity="0.025" filter="url(#presenceAtmosphere)"/>
  <g transform="translate(600 532) scale(0.84) translate(-600 -600)">
    ${organismArtworkSvg({
      assets,
      colors,
      moustacheAspect,
      plan,
      presenceGlow,
      showMoustache,
      size,
      surfaceMode
    })}
  </g>
  <rect x="0" y="820" width="${size}" height="380" fill="url(#lowerQuiet)"/>
  <rect x="54" y="54" width="1092" height="1092" fill="none" stroke="${CARD_TEXT.accent}" stroke-opacity="0.18" stroke-width="1"/>
  <path d="M84 146 H168" stroke="${CARD_TEXT.accent}" stroke-opacity="0.32" stroke-width="1"/>
  ${textPathSvg({ fill: CARD_TEXT.primary, fontSize: 34, letterSpacing: 8, text: "SPØR", x: 84, y: 111 })}
  ${textPathSvg({
    fill: CARD_TEXT.tertiary,
    fontSize: 13,
    letterSpacing: 3.8,
    text: "SPECIMEN BIRTH RECORD",
    x: 86,
    y: 179
  })}
  ${textPathSvg({ fill: CARD_TEXT.primary, fontSize: 45, letterSpacing: 1.2, text: card.displayName, x: 84, y: 990 })}
  ${textPathSvg({
    fill: CARD_TEXT.secondary,
    fontSize: 17,
    letterSpacing: 4,
    text: card.organismLabel,
    x: 86,
    y: 1037
  })}
  ${textPathSvg({
    fill: CARD_TEXT.tertiary,
    fontSize: 14,
    letterSpacing: 3.6,
    text: card.generationLabel,
    x: 86,
    y: 1074
  })}
  ${textPathSvg({ fill: CARD_TEXT.tertiary, fontSize: 13, letterSpacing: 2.2, text: "GENOME", x: 86, y: 1124 })}
  ${textPathSvg({ fill: CARD_TEXT.secondary, fontSize: 16, letterSpacing: 1.8, text: card.genome, x: 204, y: 1124 })}
</svg>`;
}

function organismArtworkSvg({
  assets,
  colors,
  moustacheAspect,
  plan,
  presenceGlow,
  showMoustache,
  size,
  surfaceMode
}: {
  assets: Record<"body" | "core" | "fins" | "glow" | "surface" | "tendrils", string> & {
    moustache: string | null;
  };
  colors: OrganismColorPlan;
  moustacheAspect: number;
  plan: OrganismRenderPlan;
  presenceGlow: PresenceGlowPlan;
  showMoustache: boolean;
  size: number;
  surfaceMode: SurfaceMode;
}) {
  return `${presenceGlowSvg(presenceGlow)}
  <g ${transformAttribute(plan.biologicalTransform, plan.center)}>
    ${imageLayer({
      blendMode: "screen",
      filterId: "haloGlow",
      href: assets.glow,
      opacity: plan.haloOpacity,
      origin: plan.center,
      size,
      transform: plan.haloTransform
    })}
    ${imageLayer({
      blendMode: "screen",
      filterId: "glow",
      href: assets.glow,
      opacity: plan.glowOpacity,
      origin: plan.center,
      size,
      transform: plan.glowTransform
    })}
    <g opacity="${format(plan.baseAnatomyOpacity)}" filter="url(#color)">
      ${image(assets.fins, size)}
      <g opacity="${format(plan.finAccentOpacity)}" ${transformAttribute(
        [
          { scaleX: plan.finAccentScaleX },
          { scaleY: plan.finAccentScaleY },
          { rotate: plan.finAccentRotation }
        ],
        plan.center
      )}>
        ${image(assets.fins, size)}
      </g>
      ${image(assets.body, size)}
    </g>
    ${imageLayer({
      filterId: "color",
      href: assets.tendrils,
      opacity: plan.tendrilOpacity,
      origin: plan.center,
      size,
      transform: [{ scale: plan.tendrilScale }]
    })}
    ${imageLayer({
      blendMode: "screen",
      filterId: "core",
      href: assets.core,
      opacity: plan.coreOpacity,
      origin: plan.center,
      size,
      transform: plan.coreTransform
    })}
    ${surfaceSvg({ href: assets.surface, plan, size, surfaceMode })}
    ${sensoryNodesSvg(plan.sensoryNodes, colors.nodeColor)}
    ${showMoustache && assets.moustache ? moustacheSvg(assets.moustache, plan, moustacheAspect) : ""}
  </g>`;
}

function presenceGlowSvg(plan: PresenceGlowPlan) {
  return `<g ${transformAttribute(plan.atmosphere.transform, plan.center)}>
    <circle cx="${format(plan.atmosphere.cx)}" cy="${format(plan.atmosphere.cy)}" r="${format(
      plan.atmosphere.radius
    )}" fill="${plan.atmosphere.color}" filter="url(#presenceAtmosphere)"/>
  </g>
  <g ${transformAttribute(plan.core.transform, plan.center)}>
    <circle cx="${format(plan.core.cx)}" cy="${format(plan.core.cy)}" r="${format(
      plan.core.radius
    )}" fill="${plan.core.color}" filter="url(#presenceCore)"/>
  </g>`;
}

function surfaceSvg({
  href,
  plan,
  size,
  surfaceMode
}: {
  href: string;
  plan: OrganismRenderPlan;
  size: number;
  surfaceMode: SurfaceMode;
}) {
  const internal = imageLayer({
    blendMode: "screen",
    filterId: "filament",
    href,
    opacity: plan.internalFilamentOpacity,
    origin: plan.center,
    size,
    transform: plan.internalFilamentTransform
  });

  if (surfaceMode === "native") {
    return `${internal}
    ${imageLayer({ filterId: "surface", href, opacity: plan.surfaceOpacity, size })}`;
  }

  if (surfaceMode === "mirror-x") {
    return `${internal}
    ${imageLayer({
      filterId: "surface",
      href,
      opacity: plan.surfaceOpacity,
      origin: plan.center,
      size,
      transform: [{ scaleX: -1 }]
    })}`;
  }

  if (surfaceMode === "ghost-double") {
    return `${internal}
    ${imageLayer({ filterId: "surface", href, opacity: plan.surfaceOpacity * 0.86, size })}
    ${imageLayer({
      filterId: "surface",
      href,
      opacity: plan.surfaceOpacity * 0.12,
      origin: plan.center,
      size,
      transform: [
        { translateX: size * 0.004 },
        { translateY: -size * 0.003 },
        { scale: 1.004 }
      ]
    })}`;
  }

  return `${internal}
    ${[-1, 0, 1]
      .map((turn) =>
        imageLayer({
          filterId: "surface",
          href,
          opacity: plan.surfaceOpacity * (turn === 0 ? 0.84 : 0.08),
          origin: plan.center,
          size,
          transform: [{ rotate: turn * 0.026 }, { scale: turn === 0 ? 1 : 1.003 }]
        })
      )
      .join("\n    ")}`;
}

function sensoryNodesSvg(nodes: OrganismRenderPlan["sensoryNodes"], color: string) {
  return nodes
    .map(
      (node, index) => `<g>
      <circle cx="${format(node.x)}" cy="${format(node.y)}" r="${format(
        node.radius * 1.65
      )}" fill="${color}" opacity="${format(node.opacity * 0.08)}" filter="url(#sensory-${index})"/>
      <circle cx="${format(node.x)}" cy="${format(node.y)}" r="${format(node.radius)}" fill="${color}" opacity="${format(
        node.opacity
      )}"/>
    </g>`
    )
    .join("\n    ");
}

function moustacheSvg(href: string, plan: OrganismRenderPlan, aspect: number) {
  const width = plan.moustache.width;
  const height = width * aspect;
  const x = plan.moustache.centerX - width * 0.5;
  const y = plan.moustache.centerY - height * 0.5;

  return `<g opacity="0.92" ${transformAttribute([{ rotate: plan.moustache.rotation }], {
    x: plan.moustache.centerX,
    y: plan.moustache.centerY
  })}>
    <image href="${href}" x="${format(x)}" y="${format(y)}" width="${format(width)}" height="${format(
      height
    )}" preserveAspectRatio="none"/>
  </g>`;
}

function createCardIdentity(identity: NftOrganismImageIdentity, genomeHex: string) {
  const organismNumber = formatOrganismNumber(identity.organismNumber);
  const generation = Number.isFinite(identity.generation)
    ? Math.max(0, Math.trunc(identity.generation))
    : 0;
  const isSeekerZero = /^0+$/.test(identity.organismNumber);

  return {
    displayName: isSeekerZero ? "Seeker Zero" : "Seekerborne",
    generationLabel: `GENERATION ${generation}`,
    genome: formatGenome(genomeHex),
    organismLabel: `ORGANISM #${organismNumber}`
  };
}

function formatOrganismNumber(organismNumber: string) {
  return (organismNumber.replace(/^0+/, "") || "0").padStart(6, "0");
}

function formatGenome(genomeHex: string) {
  return genomeHex
    .toUpperCase()
    .match(/.{1,8}/g)
    ?.join(" ") ?? genomeHex.toUpperCase();
}

function imageLayer({
  blendMode,
  filterId,
  href,
  opacity,
  origin,
  size,
  transform
}: {
  blendMode?: "screen";
  filterId?: string;
  href: string;
  opacity: number;
  origin?: OrganismPoint;
  size: number;
  transform?: OrganismRenderTransform[];
}) {
  if (opacity <= 0) {
    return "";
  }

  return `<g opacity="${format(clamp(opacity, 0, 1))}"${blendMode ? ` style="mix-blend-mode:${blendMode}"` : ""}${
    filterId ? ` filter="url(#${filterId})"` : ""
  } ${transformAttribute(transform, origin)}>
    ${image(href, size)}
  </g>`;
}

function image(href: string, size: number) {
  return `<image href="${href}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="none"/>`;
}

function colorFilter(id: string, matrix: number[], blur?: number) {
  const input = blur && blur > 0 ? "blurred" : "SourceGraphic";

  return `<filter id="${id}" filterUnits="userSpaceOnUse" x="${-FILTER_EXTENT}" y="${-FILTER_EXTENT}" width="${
    FILTER_EXTENT * 2
  }" height="${FILTER_EXTENT * 2}" color-interpolation-filters="sRGB">
      ${blur && blur > 0 ? `<feGaussianBlur in="SourceGraphic" stdDeviation="${format(blur)}" result="blurred"/>` : ""}
      <feColorMatrix in="${input}" type="matrix" values="${matrix.map(format).join(" ")}"/>
    </filter>`;
}

function blurFilter(id: string, blur: number) {
  return `<filter id="${id}" filterUnits="userSpaceOnUse" x="${-FILTER_EXTENT}" y="${-FILTER_EXTENT}" width="${
    FILTER_EXTENT * 2
  }" height="${FILTER_EXTENT * 2}">
      <feGaussianBlur in="SourceGraphic" stdDeviation="${format(blur)}"/>
    </filter>`;
}

function transformAttribute(transforms?: OrganismRenderTransform[], origin?: OrganismPoint) {
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

function svgTransform(transform: OrganismRenderTransform) {
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

function getSharedAssetDataUri(relativePath: string) {
  const resolvedPath = resolveSharedAssetPath(relativePath);
  const cached = dataUriCache.get(resolvedPath);

  if (cached) {
    return cached;
  }

  const encoded = readFileSync(resolvedPath).toString("base64");
  const dataUri = `data:image/png;base64,${encoded}`;

  dataUriCache.set(resolvedPath, dataUri);

  return dataUri;
}

function resolveSharedAssetPath(relativePath: string) {
  const root = resolveSharedAssetRoot();
  const resolvedPath = path.resolve(root, relativePath);

  if (!resolvedPath.startsWith(root + path.sep)) {
    throw new Error("Invalid organism asset path.");
  }

  return resolvedPath;
}

function resolveSharedFontPath(fileName: string) {
  const root = resolveSharedFontRoot();
  const resolvedPath = path.resolve(root, fileName);

  if (!resolvedPath.startsWith(root + path.sep)) {
    throw new Error("Invalid NFT font path.");
  }

  return resolvedPath;
}

function resolveSharedAssetRoot() {
  const candidates = [
    path.resolve(process.cwd(), "../../packages/shared/assets/organisms"),
    path.resolve(process.cwd(), "packages/shared/assets/organisms")
  ];
  const root = candidates.find((candidate) => existsSync(candidate));

  if (!root) {
    throw new Error("Shared organism assets are unavailable.");
  }

  return root;
}

function resolveSharedFontRoot() {
  const candidates = [
    path.resolve(process.cwd(), "../../packages/shared/assets/fonts"),
    path.resolve(process.cwd(), "packages/shared/assets/fonts")
  ];
  const root = candidates.find((candidate) => existsSync(candidate));

  if (!root) {
    throw new Error("Shared NFT fonts are unavailable.");
  }

  return root;
}

function format(value: number) {
  if (Math.abs(value) < 0.000001) {
    return "0";
  }

  return Number(value.toFixed(6)).toString();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function textPathSvg({
  fill,
  fontSize,
  letterSpacing,
  text,
  x,
  y
}: {
  fill: string;
  fontSize: number;
  letterSpacing: number;
  text: string;
  x: number;
  y: number;
}) {
  return `<path fill="${fill}" d="${textPathData(text, x, y, fontSize, letterSpacing)}"/>`;
}

function textPathData(text: string, x: number, y: number, fontSize: number, letterSpacing: number) {
  const font = getCardFont();
  let cursorX = x;
  const paths: string[] = [];

  for (const character of Array.from(text)) {
    const glyph = font.charToGlyph(character);
    assertGlyphSupported(character, glyph);

    const pathData = glyph.getPath(cursorX, y, fontSize).toPathData(2);
    if (pathData) {
      paths.push(pathData);
    }

    cursorX += glyphAdvance(glyph, font, fontSize) + letterSpacing;
  }

  return paths.join(" ");
}

function getCardFont() {
  if (cardFontCache) {
    return cardFontCache;
  }

  const fontBuffer = readFileSync(resolveSharedFontPath(CARD_FONT_FILE));
  const fontData = fontBuffer.buffer.slice(fontBuffer.byteOffset, fontBuffer.byteOffset + fontBuffer.byteLength);
  cardFontCache = opentype.parse(fontData as ArrayBuffer);

  return cardFontCache;
}

function assertGlyphSupported(character: string, glyph: opentype.Glyph) {
  if (glyph.name === ".notdef" || (glyph.unicode === undefined && character !== " ")) {
    throw new Error(`NFT card font does not support glyph ${JSON.stringify(character)}.`);
  }
}

function glyphAdvance(glyph: opentype.Glyph, font: opentype.Font, fontSize: number) {
  return ((glyph.advanceWidth ?? font.unitsPerEm * 0.5) / font.unitsPerEm) * fontSize;
}
