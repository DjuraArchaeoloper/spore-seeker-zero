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

export type SurfaceRenderLayerPlan = {
  opacity: number;
  transform: OrganismRenderTransform[];
};

export type OrganismRenderPlan = {
  size: number;
  center: OrganismPoint;
  biologicalTransform: OrganismRenderTransform[];
  bodyTransform: OrganismRenderTransform[];
  baseAnatomyOpacity: number;
  finTransform: OrganismRenderTransform[];
  finAccentOpacity: number;
  finAccentScaleX: number;
  finAccentScaleY: number;
  finAccentRotation: number;
  glowTransform: OrganismRenderTransform[];
  haloTransform: OrganismRenderTransform[];
  tendrilOpacity: number;
  tendrilTransform: OrganismRenderTransform[];
  rootFloatPx: number;
  rootSwayRad: number;
  coreTransform: OrganismRenderTransform[];
  coreOpacity: number;
  surfaceOpacity: number;
  surfaceLayers: SurfaceRenderLayerPlan[];
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

export const SPORE_ORGANISM_RENDERER_REVISION = "shared-organism-renderer-v2-expression-v1";
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
const FIN_ACCENT_TRANSFORM_MULTIPLIER = 0.24;
const HALO_BLUR_MULTIPLIER = 0.5;
const HALO_OPACITY_MULTIPLIER = 0.5;
const GLOW_OPACITY_MULTIPLIER = 0.58;
const INTERNAL_FILAMENT_OPACITY_MULTIPLIER = 0.34;
const MOUSTACHE_VISUAL_SCALE = 0.75;
const ROOT_FLOAT_BASE_PX_AT_1024 = 4;
const ROOT_FLOAT_MOTION_PX_MULTIPLIER = 0.34;
const PIGMENT_HUE_RENDER_MULTIPLIER = 1.32;
const PIGMENT_SATURATION_RENDER_MULTIPLIER = 1.25;
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
  const restPoseScaleX = 1 + (phenotype.motion.restPoseScaleX - 1) * 2.8;
  const restPoseScaleY = 1 + (phenotype.motion.restPoseScaleY - 1) * 2.8;
  const biologicalScaleX =
    phenotype.body.formScaleX * phenotype.body.proportionScaleX * restPoseScaleX;
  const biologicalScaleY =
    phenotype.body.formScaleY * phenotype.body.proportionScaleY * restPoseScaleY;
  const staticPoseTranslateX = phenotype.motion.restPoseOffsetPxAt1024 * 0.55 * scale;
  const staticPoseRotation = degToRad(phenotype.motion.restPoseRotationDeg * 0.42);
  const bodyScaleX = 1 + (phenotype.body.formScaleX - 1) * 1.45 + phenotype.asymmetry.sideScaleDelta * 0.18;
  const bodyScaleY = 1 + (phenotype.body.formScaleY - 1) * 1.35;
  const bodyRotation = degToRad(phenotype.asymmetry.sideRotationDeg * 0.18);
  const appendageScale = phenotype.appendages.expressionScale * (1 + phenotype.appendages.extensionBias * 0.35);
  const appendageMotionCoupling = phenotype.appendages.motionCoupling;
  const membraneTensionScaleX = 0.96 + phenotype.membrane.tension * 0.09;
  const membraneCurlScaleY = 1 + (phenotype.membrane.edgeCurl - 0.5) * 0.08;
  const finScaleX =
    phenotype.membrane.primaryScaleX *
    phenotype.appendages.finScaleXMul *
    appendageScale *
    phenotype.appendages.spread *
    membraneTensionScaleX;
  const finScaleY =
    phenotype.membrane.primaryScaleY *
    phenotype.appendages.finScaleYMul *
    appendageScale *
    membraneCurlScaleY;
  const sideRotation = phenotype.asymmetry.sideRotationDeg;
  const opposingRotation = phenotype.membrane.opposingRotationDeg;
  const membraneRotationDeg =
    opposingRotation * 0.45 +
    phenotype.appendages.orientationDeg * 0.35 +
    phenotype.asymmetry.membraneSkewDeg * 0.3;
  const finTranslateX =
    (phenotype.appendages.attachmentOffsetPxAt1024 + phenotype.asymmetry.appendageOffsetPxAt1024 * 0.55) *
    scale;
  const primaryFinOpacity = phenotype.membrane.opacity * phenotype.appendages.finOpacityMul;
  const tendrilOpacity =
    phenotype.appendages.tendrilOpacityMul * phenotype.appendages.expressionTendrilOpacityMul;
  const tendrilScale = appendageScale * (0.96 + phenotype.appendages.familyDetail * 0.1);
  const tendrilRotationDeg =
    phenotype.appendages.orientationDeg * 0.38 +
    phenotype.appendages.curlDeg * 0.34 +
    phenotype.asymmetry.sideRotationDeg * 0.28;
  const tendrilTranslateX =
    (phenotype.appendages.attachmentOffsetPxAt1024 * 0.65 +
      phenotype.asymmetry.appendageOffsetPxAt1024 * 0.75) *
    scale;
  const moustache = registration.moustache;
  const sensoryNodes = createSensoryNodePlan(registration, phenotype, size, scale);

  return {
    size,
    center: {
      x: size * 0.5,
      y: size * 0.5
    },
    biologicalTransform: [
      { translateY: size * ART_FRAME_Y_OFFSET_RATIO },
      { translateX: staticPoseTranslateX },
      { scale: ART_FRAME_SCALE },
      { rotate: staticPoseRotation },
      { scaleX: biologicalScaleX },
      { scaleY: biologicalScaleY }
    ],
    bodyTransform: [
      { translateX: phenotype.asymmetry.appendageOffsetPxAt1024 * 0.08 * scale },
      { scaleX: bodyScaleX },
      { scaleY: bodyScaleY },
      { rotate: bodyRotation }
    ],
    baseAnatomyOpacity: clamp((phenotype.body.opacity + phenotype.membrane.opacity) * 0.53, 0.62, 0.98),
    finTransform: [
      { translateX: finTranslateX },
      { scaleX: finScaleX },
      { scaleY: finScaleY },
      { rotate: degToRad(membraneRotationDeg) }
    ],
    finAccentOpacity: clamp(primaryFinOpacity * (0.15 + phenotype.membrane.edgeCurl * 0.05), 0.055, 0.22),
    finAccentScaleX:
      1 +
      (finScaleX - 1) * FIN_ACCENT_TRANSFORM_MULTIPLIER +
      (phenotype.membrane.edgeCurl - 0.5) * 0.08,
    finAccentScaleY:
      1 +
      (finScaleY - 1) * FIN_ACCENT_TRANSFORM_MULTIPLIER -
      (phenotype.membrane.tension - 0.5) * 0.06,
    finAccentRotation: degToRad(
      (phenotype.membrane.rightRotationDeg - phenotype.membrane.leftRotationDeg) * 0.16 +
        sideRotation * 0.45 +
        phenotype.appendages.curlDeg * 0.14
    ),
    glowTransform: [
      { scale: 1 + (phenotype.bioluminescence.glowScale - 1) * 0.74 },
      { scaleY: 1 + (phenotype.motion.restPoseScaleY - 1) * 1.0 }
    ],
    haloTransform: [
      { translateX: phenotype.halo.offsetPxAt1024 * scale * 0.48 },
      { scale: 1 + (phenotype.halo.scale - 1) * 0.62 },
      { scaleX: phenotype.halo.ringScaleX },
      { scaleY: phenotype.halo.ringScaleY },
      { rotate: degToRad((phenotype.halo.texturePhase - 0.5) * 6) }
    ],
    tendrilOpacity: clamp(tendrilOpacity, 0.08, 1),
    tendrilTransform: [
      { translateX: tendrilTranslateX },
      { scaleX: tendrilScale * (0.94 + phenotype.appendages.spread * 0.12) },
      { scaleY: tendrilScale * (1 + phenotype.appendages.extensionBias * 0.6) },
      { rotate: degToRad(tendrilRotationDeg) }
    ],
    rootFloatPx:
      (ROOT_FLOAT_BASE_PX_AT_1024 +
        phenotype.motion.tendrilDriftPxAt1024 *
          ROOT_FLOAT_MOTION_PX_MULTIPLIER *
          appendageMotionCoupling) *
      scale,
    rootSwayRad: degToRad(0.45 + phenotype.motion.finWaveDeg * 0.26 * appendageMotionCoupling),
    coreTransform: [
      { translateX: (phenotype.asymmetry.coreOffsetPxAt1024 + phenotype.motion.restPoseOffsetPxAt1024 * 0.35) * scale },
      { scaleX: phenotype.core.scaleX * (1 + phenotype.asymmetry.sideScaleDelta * 0.16) },
      { scaleY: phenotype.core.scaleY },
      { rotate: degToRad(phenotype.core.rotationDeg + phenotype.asymmetry.sideRotationDeg * 0.28) }
    ],
    coreOpacity: phenotype.core.opacity,
    surfaceOpacity: clamp(phenotype.surface.opacity * 1.05, 0.18, 0.9),
    surfaceLayers: createSurfaceLayers(phenotype, scale),
    internalFilamentOpacity: clamp(
      phenotype.internalFilaments.opacity * INTERNAL_FILAMENT_OPACITY_MULTIPLIER,
      0.035,
      0.24
    ),
    internalFilamentTransform: [
      { rotate: degToRad(phenotype.internalFilaments.weaveRotationDeg) },
      { scaleX: phenotype.internalFilaments.scale * phenotype.internalFilaments.strandSpread },
      { scaleY: phenotype.internalFilaments.scale * phenotype.internalFilaments.strandLength }
    ],
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

function createSensoryNodePlan(
  registration: CreatureFamilyArtDefinition,
  phenotype: OrganismPhenotype,
  size: number,
  scale: number
): SensoryNodeRenderPlan[] {
  const count = Math.min(phenotype.sensoryNodes.count, registration.sensoryAnchors.length);
  const twist = degToRad(phenotype.sensoryNodes.distributionTwistDeg);
  const cos = Math.cos(twist);
  const sin = Math.sin(twist);
  const center = size * 0.5;
  const jitter = phenotype.sensoryNodes.anchorJitterPxAt1024 * scale;

  return registration.sensoryAnchors.slice(0, count).map(([anchorX, anchorY], index) => {
    const localX = (anchorX - 0.5) * size;
    const localY = (anchorY - 0.5) * size;
    const rotatedX = localX * cos - localY * sin;
    const rotatedY = localX * sin + localY * cos;
    const depth = clamp(0.9 + (anchorY - 0.5) * phenotype.sensoryNodes.depthBias * 0.48, 0.74, 1.18);
    const jitterX = seededSigned(phenotype.sensoryNodes.seed, index * 2 + 11) * jitter;
    const jitterY = seededSigned(phenotype.sensoryNodes.seed, index * 2 + 23) * jitter;
    const radiusJitter = 0.9 + seededUnit(phenotype.sensoryNodes.seed, index + 37) * 0.24;

    return {
      x: center + rotatedX + jitterX,
      y: center + rotatedY + jitterY,
      radius: phenotype.sensoryNodes.radiusPxAt1024 * scale * depth * radiusJitter,
      opacity: clamp(phenotype.sensoryNodes.opacity * (0.84 + depth * 0.18), 0.12, 0.96)
    };
  });
}

function createSurfaceLayers(phenotype: OrganismPhenotype, scale: number): SurfaceRenderLayerPlan[] {
  const opacity = clamp(phenotype.surface.opacity * 1.05, 0.18, 0.9);
  const echoOffset = phenotype.surface.echoOffsetPxAt1024 * scale;
  const phaseAngle = phenotype.surface.phase * Math.PI * 2;
  const phaseX = Math.cos(phaseAngle) * echoOffset * 0.28;
  const phaseY = Math.sin(phaseAngle) * echoOffset * 0.2;
  const baseTransform: OrganismRenderTransform[] = [
    { translateX: phaseX },
    { translateY: phaseY },
    { rotate: degToRad(phenotype.surface.rotationDeg * 0.58) },
    { scale: phenotype.surface.detailScale }
  ];

  if (phenotype.surface.mode === "native") {
    return [
      {
        opacity,
        transform: baseTransform
      }
    ];
  }

  if (phenotype.surface.mode === "mirror-x") {
    return [
      {
        opacity,
        transform: [...baseTransform, { scaleX: -1 }]
      }
    ];
  }

  if (phenotype.surface.mode === "ghost-double") {
    return [
      {
        opacity: opacity * 0.82,
        transform: baseTransform
      },
      {
        opacity: opacity * 0.22,
        transform: [
          { translateX: phaseX + Math.cos(phaseAngle + Math.PI * 0.34) * echoOffset },
          { translateY: phaseY + Math.sin(phaseAngle + Math.PI * 0.34) * echoOffset * 0.78 },
          { rotate: degToRad(phenotype.surface.rotationDeg * 0.72) },
          { scale: 1.006 + phenotype.surface.patternDetail * 0.012 }
        ]
      }
    ];
  }

  return [-1, 0, 1].map((turn) => ({
    opacity: opacity * (turn === 0 ? 0.78 : 0.13),
    transform: [
      { translateX: phaseX + turn * echoOffset * 0.42 },
      { translateY: phaseY - turn * echoOffset * 0.18 },
      { rotate: degToRad(phenotype.surface.rotationDeg * 0.44 + turn * (2.4 + phenotype.surface.patternDetail * 3.2)) },
      { scale: turn === 0 ? phenotype.surface.detailScale : 1.004 + phenotype.surface.patternDetail * 0.01 }
    ]
  }));
}

export function createOrganismColorPlan(phenotype: OrganismPhenotype): OrganismColorPlan {
  const renderedHueShift = phenotype.pigment.hueShiftDeg * PIGMENT_HUE_RENDER_MULTIPLIER;
  const renderedSaturation = clamp(
    1 + (phenotype.pigment.saturation - 1) * PIGMENT_SATURATION_RENDER_MULTIPLIER,
    0.84,
    1.18
  );
  const colorMatrix = createHueSaturationMatrix(
    renderedHueShift,
    renderedSaturation
  );
  const glowMatrix = multiplyColorMatrices(
    createBrightnessMatrix(1.04 + (phenotype.bioluminescence.coreBrightness - 1) * 0.42),
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
      renderedHueShift + phenotype.internalFilaments.hueOffsetDeg * 1.2,
      renderedSaturation
    ),
    createContrastMatrix(0.94)
  );
  const nodeColor = hslToRgba(205 + renderedHueShift * 0.45, 0.74, 0.72, 1);

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

function seededUnit(seed: number, salt: number) {
  let value = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  value ^= value >>> 16;

  return value / 0xffffffff;
}

function seededSigned(seed: number, salt: number) {
  return seededUnit(seed, salt) * 2 - 1;
}

function degToRad(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
