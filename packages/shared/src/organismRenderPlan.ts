import { phenotypeFromGenome, type GenomeInput, type OrganismPhenotype } from "./genome";
import {
  getCreatureFamilyArt,
  ORGANISM_RUNTIME_CANVAS,
  SHOW_MOUSTACHE,
  SPORE_CREATURE_ART_REVISION,
  SPORE_CREATURE_LAYER_ORDER,
  SPORE_MOUSTACHE_ASSET_PATH,
  type CreatureFamilyArtDefinition
} from "./organismArt";

export type OrganismPoint = {
  x: number;
  y: number;
};

export type OrganismRenderTransform =
  | { translateX: number }
  | { translateY: number }
  | { scale: number }
  | { scaleX: number }
  | { scaleY: number }
  | { rotate: number };

export type SensoryNodeRenderPlan = {
  x: number;
  y: number;
  radius: number;
  opacity: number;
};

export type OrganismRenderPlan = {
  size: number;
  center: OrganismPoint;
  biologicalTransform: OrganismRenderTransform[];
  baseAnatomyOpacity: number;
  finAccentOpacity: number;
  finAccentScaleX: number;
  finAccentScaleY: number;
  finAccentRotation: number;
  glowTransform: OrganismRenderTransform[];
  haloTransform: OrganismRenderTransform[];
  tendrilOpacity: number;
  tendrilScale: number;
  rootFloatPx: number;
  rootSwayRad: number;
  coreTransform: OrganismRenderTransform[];
  coreOpacity: number;
  surfaceOpacity: number;
  internalFilamentOpacity: number;
  internalFilamentTransform: OrganismRenderTransform[];
  haloBlur: number;
  haloOpacity: number;
  glowOpacity: number;
  sensoryNodes: SensoryNodeRenderPlan[];
  moustache: {
    centerX: number;
    centerY: number;
    width: number;
    rotation: number;
  };
};

export type OrganismColorPlan = {
  colorMatrix: number[];
  glowMatrix: number[];
  coreMatrix: number[];
  surfaceMatrix: number[];
  filamentMatrix: number[];
  nodeColor: string;
};

export type PresenceGlowPlan = {
  center: OrganismPoint;
  core: {
    color: string;
    cx: number;
    cy: number;
    radius: number;
    blur: number;
    transform: OrganismRenderTransform[];
  };
  atmosphere: {
    color: string;
    cx: number;
    cy: number;
    radius: number;
    blur: number;
    transform: OrganismRenderTransform[];
  };
};

export const SPORE_ORGANISM_RENDERER_REVISION = "shared-organism-renderer-v1-family-map-v2";
export const SPORE_NFT_IMAGE_SIZE = 1200;

export type OrganismRenderModel = {
  artRevision: typeof SPORE_CREATURE_ART_REVISION;
  colorPlan: OrganismColorPlan;
  family: CreatureFamilyArtDefinition;
  layerOrder: typeof SPORE_CREATURE_LAYER_ORDER;
  moustacheAssetPath: typeof SPORE_MOUSTACHE_ASSET_PATH;
  phenotype: OrganismPhenotype;
  plan: OrganismRenderPlan;
  presenceGlow: PresenceGlowPlan;
  rendererRevision: typeof SPORE_ORGANISM_RENDERER_REVISION;
  showMoustache: typeof SHOW_MOUSTACHE;
};

const ART_FRAME_SCALE = 0.88;
const ART_FRAME_Y_OFFSET_RATIO = -0.034;
const FIN_ACCENT_TRANSFORM_MULTIPLIER = 0.16;
const HALO_BLUR_MULTIPLIER = 0.28;
const HALO_OPACITY_MULTIPLIER = 0.24;
const GLOW_OPACITY_MULTIPLIER = 0.46;
const INTERNAL_FILAMENT_OPACITY_MULTIPLIER = 0.22;
const MOUSTACHE_VISUAL_SCALE = 0.75;
const ROOT_FLOAT_BASE_PX_AT_1024 = 4;
const ROOT_FLOAT_MOTION_PX_MULTIPLIER = 0.34;
const PRESENCE_GLOW_CENTER_Y_RATIO = 0.48;
const PRESENCE_GLOW_CORE_RADIUS_RATIO = 0.2;
const PRESENCE_GLOW_CORE_BLUR_RATIO = 0.11;
const PRESENCE_GLOW_CORE_SCALE_Y = 1.26;
const PRESENCE_GLOW_ATMOSPHERE_RADIUS_RATIO = 0.36;
const PRESENCE_GLOW_ATMOSPHERE_BLUR_RATIO = 0.18;
const PRESENCE_GLOW_ATMOSPHERE_SCALE_X = 0.92;
const PRESENCE_GLOW_ATMOSPHERE_SCALE_Y = 0.88;
const PRESENCE_GLOW_CORE_COLOR = "rgba(134, 224, 255, 0.24)";
const PRESENCE_GLOW_ATMOSPHERE_COLOR = "rgba(177, 154, 255, 0.105)";

export function createOrganismRenderModel(
  genome: GenomeInput,
  size: number = ORGANISM_RUNTIME_CANVAS.width
): OrganismRenderModel {
  const phenotype = phenotypeFromGenome(genome);
  const family = getCreatureFamilyArt(phenotype.family);

  return {
    artRevision: SPORE_CREATURE_ART_REVISION,
    colorPlan: createOrganismColorPlan(phenotype),
    family,
    layerOrder: SPORE_CREATURE_LAYER_ORDER,
    moustacheAssetPath: SPORE_MOUSTACHE_ASSET_PATH,
    phenotype,
    plan: createOrganismRenderPlan(phenotype, family, size),
    presenceGlow: createPresenceGlowPlan(size),
    rendererRevision: SPORE_ORGANISM_RENDERER_REVISION,
    showMoustache: SHOW_MOUSTACHE
  };
}

export function createOrganismRenderPlan(
  phenotype: OrganismPhenotype,
  registration: CreatureFamilyArtDefinition,
  size: number = ORGANISM_RUNTIME_CANVAS.width
): OrganismRenderPlan {
  const scale = size / ORGANISM_RUNTIME_CANVAS.width;
  const biologicalScaleX = phenotype.body.formScaleX * phenotype.body.proportionScaleX;
  const biologicalScaleY = phenotype.body.formScaleY * phenotype.body.proportionScaleY;
  const appendageScale = phenotype.appendages.expressionScale;
  const finScaleX =
    phenotype.membrane.scaleX * phenotype.appendages.finScaleXMul * appendageScale;
  const finScaleY =
    phenotype.membrane.scaleY * phenotype.appendages.finScaleYMul * appendageScale;
  const sideRotation = phenotype.asymmetry.sideRotationDeg;
  const opposingRotation = phenotype.membrane.opposingRotationDeg;
  const primaryFinOpacity = phenotype.membrane.opacity * phenotype.appendages.finOpacityMul;
  const tendrilOpacity =
    phenotype.appendages.tendrilOpacityMul * phenotype.appendages.expressionTendrilOpacityMul;
  const moustache = registration.moustache;
  const sensoryNodes = registration.sensoryAnchors
    .slice(0, phenotype.sensoryNodes.count)
    .map(([x, y]) => ({
      x: x * size,
      y: y * size,
      radius: phenotype.sensoryNodes.radiusPxAt1024 * scale,
      opacity: phenotype.sensoryNodes.opacity
    }));

  return {
    size,
    center: {
      x: size * 0.5,
      y: size * 0.5
    },
    biologicalTransform: [
      { translateY: size * ART_FRAME_Y_OFFSET_RATIO },
      { scale: ART_FRAME_SCALE },
      { scaleX: biologicalScaleX },
      { scaleY: biologicalScaleY }
    ],
    baseAnatomyOpacity: clamp((phenotype.body.opacity + phenotype.membrane.opacity) * 0.5, 0.58, 0.96),
    finAccentOpacity: clamp(primaryFinOpacity * 0.13, 0.04, 0.14),
    finAccentScaleX: 1 + (finScaleX - 1) * FIN_ACCENT_TRANSFORM_MULTIPLIER,
    finAccentScaleY: 1 + (finScaleY - 1) * FIN_ACCENT_TRANSFORM_MULTIPLIER,
    finAccentRotation: degToRad((opposingRotation + sideRotation) * FIN_ACCENT_TRANSFORM_MULTIPLIER),
    glowTransform: [{ scale: 1 + (phenotype.bioluminescence.glowScale - 1) * 0.48 }],
    haloTransform: [{ scale: 1 + (phenotype.halo.scale - 1) * 0.32 }],
    tendrilOpacity: clamp(tendrilOpacity, 0.08, 1),
    tendrilScale: appendageScale,
    rootFloatPx:
      (ROOT_FLOAT_BASE_PX_AT_1024 +
        phenotype.motion.tendrilDriftPxAt1024 * ROOT_FLOAT_MOTION_PX_MULTIPLIER) *
      scale,
    rootSwayRad: degToRad(0.45 + phenotype.motion.finWaveDeg * 0.26),
    coreTransform: [
      { translateX: phenotype.asymmetry.coreOffsetPxAt1024 * scale },
      { scaleX: phenotype.core.scaleX },
      { scaleY: phenotype.core.scaleY },
      { rotate: degToRad(phenotype.core.rotationDeg) }
    ],
    coreOpacity: phenotype.core.opacity,
    surfaceOpacity: phenotype.surface.opacity,
    internalFilamentOpacity: phenotype.internalFilaments.opacity * INTERNAL_FILAMENT_OPACITY_MULTIPLIER,
    internalFilamentTransform: [{ scale: phenotype.internalFilaments.scale }],
    haloBlur: phenotype.halo.blurPxAt1024 * scale * HALO_BLUR_MULTIPLIER,
    haloOpacity: phenotype.halo.opacity * HALO_OPACITY_MULTIPLIER,
    glowOpacity: phenotype.bioluminescence.glowOpacity * GLOW_OPACITY_MULTIPLIER,
    sensoryNodes,
    moustache: {
      centerX: moustache.center[0] * size,
      centerY: moustache.center[1] * size,
      width: moustache.width * size * MOUSTACHE_VISUAL_SCALE,
      rotation: degToRad(moustache.rotationDeg)
    }
  };
}

export function createOrganismColorPlan(phenotype: OrganismPhenotype): OrganismColorPlan {
  const colorMatrix = createHueSaturationMatrix(
    phenotype.pigment.hueShiftDeg,
    phenotype.pigment.saturation
  );
  const glowMatrix = multiplyColorMatrices(
    createBrightnessMatrix(1.04 + (phenotype.bioluminescence.coreBrightness - 1) * 0.28),
    colorMatrix
  );
  const coreMatrix = multiplyColorMatrices(
    createBrightnessMatrix(phenotype.bioluminescence.coreBrightness),
    colorMatrix
  );
  const surfaceMatrix = multiplyColorMatrices(
    createContrastMatrix(phenotype.surface.contrast),
    colorMatrix
  );
  const filamentMatrix = multiplyColorMatrices(
    createHueSaturationMatrix(
      phenotype.pigment.hueShiftDeg + phenotype.internalFilaments.hueOffsetDeg,
      phenotype.pigment.saturation
    ),
    createContrastMatrix(0.94)
  );
  const nodeColor = hslToRgba(205 + phenotype.pigment.hueShiftDeg * 0.45, 0.74, 0.72, 1);

  return {
    colorMatrix,
    glowMatrix,
    coreMatrix,
    surfaceMatrix,
    filamentMatrix,
    nodeColor
  };
}

export function createPresenceGlowPlan(size: number): PresenceGlowPlan {
  const center = {
    x: size * 0.5,
    y: size * 0.5
  };
  const glowCenterY = size * PRESENCE_GLOW_CENTER_Y_RATIO;

  return {
    center,
    core: {
      color: PRESENCE_GLOW_CORE_COLOR,
      cx: size * 0.5,
      cy: glowCenterY,
      radius: size * PRESENCE_GLOW_CORE_RADIUS_RATIO,
      blur: size * PRESENCE_GLOW_CORE_BLUR_RATIO,
      transform: [{ scaleY: PRESENCE_GLOW_CORE_SCALE_Y }]
    },
    atmosphere: {
      color: PRESENCE_GLOW_ATMOSPHERE_COLOR,
      cx: size * 0.5,
      cy: glowCenterY,
      radius: size * PRESENCE_GLOW_ATMOSPHERE_RADIUS_RATIO,
      blur: size * PRESENCE_GLOW_ATMOSPHERE_BLUR_RATIO,
      transform: [
        { scaleX: PRESENCE_GLOW_ATMOSPHERE_SCALE_X },
        { scaleY: PRESENCE_GLOW_ATMOSPHERE_SCALE_Y }
      ]
    }
  };
}

export function createOrganismRenderCacheKey(normalizedGenome: string) {
  return [
    `art=${SPORE_CREATURE_ART_REVISION}`,
    `renderer=${SPORE_ORGANISM_RENDERER_REVISION}`,
    `genome=${normalizedGenome}`,
    `resolution=${ORGANISM_RUNTIME_CANVAS.width}x${ORGANISM_RUNTIME_CANVAS.height}`,
    `moustache=${SHOW_MOUSTACHE ? "on" : "off"}`
  ].join("|");
}

function createHueSaturationMatrix(hueShiftDeg: number, saturation: number) {
  return multiplyColorMatrices(createHueRotationMatrix(hueShiftDeg), createSaturationMatrix(saturation));
}

function createHueRotationMatrix(degrees: number) {
  const radians = degToRad(degrees);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const lumR = 0.213;
  const lumG = 0.715;
  const lumB = 0.072;

  return [
    lumR + cos * (1 - lumR) + sin * -lumR,
    lumG + cos * -lumG + sin * -lumG,
    lumB + cos * -lumB + sin * (1 - lumB),
    0,
    0,
    lumR + cos * -lumR + sin * 0.143,
    lumG + cos * (1 - lumG) + sin * 0.14,
    lumB + cos * -lumB + sin * -0.283,
    0,
    0,
    lumR + cos * -lumR + sin * -(1 - lumR),
    lumG + cos * -lumG + sin * lumG,
    lumB + cos * (1 - lumB) + sin * lumB,
    0,
    0,
    0,
    0,
    0,
    1,
    0
  ];
}

function createSaturationMatrix(saturation: number) {
  const s = clamp(saturation, 0, 2);
  const lumR = 0.213;
  const lumG = 0.715;
  const lumB = 0.072;

  return [
    lumR + (1 - lumR) * s,
    lumG - lumG * s,
    lumB - lumB * s,
    0,
    0,
    lumR - lumR * s,
    lumG + (1 - lumG) * s,
    lumB - lumB * s,
    0,
    0,
    lumR - lumR * s,
    lumG - lumG * s,
    lumB + (1 - lumB) * s,
    0,
    0,
    0,
    0,
    0,
    1,
    0
  ];
}

function createBrightnessMatrix(brightness: number) {
  const b = clamp(brightness, 0, 1.4);

  return [
    b,
    0,
    0,
    0,
    0,
    0,
    b,
    0,
    0,
    0,
    0,
    0,
    b,
    0,
    0,
    0,
    0,
    0,
    1,
    0
  ];
}

function createContrastMatrix(contrast: number) {
  const c = clamp(contrast, 0, 1.6);
  const offset = 0.5 * (1 - c);

  return [
    c,
    0,
    0,
    0,
    offset,
    0,
    c,
    0,
    0,
    offset,
    0,
    0,
    c,
    0,
    offset,
    0,
    0,
    0,
    1,
    0
  ];
}

function multiplyColorMatrices(outer: number[], inner: number[]) {
  const result = Array.from({ length: 20 }, () => 0);

  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const offset = col === 4 ? outer[row * 5 + 4] : 0;

      result[row * 5 + col] =
        outer[row * 5] * inner[col] +
        outer[row * 5 + 1] * inner[5 + col] +
        outer[row * 5 + 2] * inner[10 + col] +
        outer[row * 5 + 3] * inner[15 + col] +
        offset;
    }
  }

  return result;
}

function hslToRgba(hue: number, saturation: number, lightness: number, alpha: number) {
  const h = (((hue % 360) + 360) % 360) / 360;
  const s = clamp(saturation, 0, 1);
  const l = clamp(lightness, 0, 1);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const red = hueToRgb(p, q, h + 1 / 3);
  const green = hueToRgb(p, q, h);
  const blue = hueToRgb(p, q, h - 1 / 3);

  return `rgba(${Math.round(red * 255)}, ${Math.round(green * 255)}, ${Math.round(
    blue * 255
  )}, ${clamp(alpha, 0, 1).toFixed(3)})`;
}

function hueToRgb(p: number, q: number, t: number) {
  let localT = t;

  if (localT < 0) {
    localT += 1;
  }

  if (localT > 1) {
    localT -= 1;
  }

  if (localT < 1 / 6) {
    return p + (q - p) * 6 * localT;
  }

  if (localT < 1 / 2) {
    return q;
  }

  if (localT < 2 / 3) {
    return p + (q - p) * (2 / 3 - localT) * 6;
  }

  return p;
}

function degToRad(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
