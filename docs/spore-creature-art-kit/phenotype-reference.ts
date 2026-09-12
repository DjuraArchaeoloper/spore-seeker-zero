/**
 * SPORE genome -> phenotype contract v1
 *
 * Source of truth for the visual mapping.
 * Genome is exactly 16 bytes. Phenotype is always derived; never persisted.
 */

export type CreatureFamily =
  | "void-drifter"
  | "crystal-bloom"
  | "nebula-spine"
  | "silk-ray";

export type CoreMode = "compact" | "tall" | "wide" | "full";
export type AppendageMode = "wing" | "veil" | "filament" | "spine";
export type SurfaceMode = "native" | "mirror-x" | "ghost-double" | "radial-echo";

export const BODY_FAMILY_BUCKETS: readonly CreatureFamily[] = [
  "void-drifter",
  "crystal-bloom",
  "nebula-spine",
  "silk-ray",
] as const;

const CORE_MODES: readonly CoreMode[] = ["compact", "tall", "wide", "full"] as const;
const APPENDAGE_MODES: readonly AppendageMode[] = ["wing", "veil", "filament", "spine"] as const;
const SURFACE_MODES: readonly SurfaceMode[] = ["native", "mirror-x", "ghost-double", "radial-echo"] as const;

// 73 is odd, therefore multiplication by 73 modulo 256 is bijective.
// This decorrelates adjacent byte values without introducing randomness.
export const mix8 = (x: number): number => ((x & 0xff) * 73 + 41) & 0xff;
const unit = (x: number): number => mix8(x) / 255;
const signed = (x: number): number => unit(x) * 2 - 1;
const local64 = (x: number): number => (mix8(x) & 63) / 63;
const altUnit = (x: number, salt: number): number => mix8((x ^ salt) & 0xff) / 255;

export function deriveSporePhenotype(genome: Uint8Array) {
  if (genome.length !== 16) {
    throw new Error(`SPORE genome must be exactly 16 bytes; received ${genome.length}`);
  }

  const g = [...genome];

  // 0 — BODY FORM
  const familyBucket = mix8(g[0]) >> 6;
  const family = BODY_FAMILY_BUCKETS[familyBucket];
  const formLocal = local64(g[0]);

  // 1 — BODY PROPORTION
  const bodyProportionU = unit(g[1]);

  // 2 — MEMBRANE SHAPE
  const membraneU = unit(g[2]);

  // 3 — MEMBRANE DENSITY
  const densityU = unit(g[3]);

  // 4 — PIGMENT
  const pigmentU = unit(g[4]);

  // 5 — BIOLUMINESCENCE
  const bioU = unit(g[5]);

  // 6 — NUCLEUS / INTERNAL CORE
  const coreMixed = mix8(g[6]);
  const coreMode = CORE_MODES[coreMixed >> 6];
  const coreFine = local64(g[6]);
  const corePreset = {
    compact: [0.84, 0.84],
    tall:    [0.78, 1.12],
    wide:    [1.12, 0.80],
    full:    [1.03, 1.03],
  }[coreMode];

  // 7 — SENSORY NODES
  const sensoryMixed = mix8(g[7]);

  // 8 — APPENDAGE FAMILY
  const appendageMixed = mix8(g[8]);
  const appendageMode = APPENDAGE_MODES[appendageMixed >> 6];
  const appendagePreset = {
    wing:     { finOpacityMul: 1.00, tendrilOpacityMul: 0.45, finScaleXMul: 1.08, finScaleYMul: 1.00 },
    veil:     { finOpacityMul: 0.90, tendrilOpacityMul: 0.75, finScaleXMul: 1.00, finScaleYMul: 1.08 },
    filament: { finOpacityMul: 0.58, tendrilOpacityMul: 1.00, finScaleXMul: 0.96, finScaleYMul: 1.03 },
    spine:    { finOpacityMul: 0.76, tendrilOpacityMul: 0.72, finScaleXMul: 0.92, finScaleYMul: 1.06 },
  }[appendageMode];

  // 9 — APPENDAGE EXPRESSION
  const appendageExpressionU = unit(g[9]);

  // 10 — SURFACE PATTERN
  const surfaceMode = SURFACE_MODES[mix8(g[10]) >> 6];

  // 11 — SURFACE DENSITY
  const surfaceDensityU = unit(g[11]);

  // 12 — INTERNAL FILAMENTS
  const filamentU = unit(g[12]);

  // 13 — EXTERNAL HALO
  const haloU = unit(g[13]);

  // 14 — MOTION / PULSE
  const motionU = unit(g[14]);

  // 15 — ASYMMETRY
  const asymS = signed(g[15]);

  return {
    family,

    body: {
      // BODY FORM has a large family effect plus a small within-family form warp.
      formScaleX: 0.94 + 0.12 * formLocal,
      formScaleY: 1.03 - 0.06 * formLocal,

      // BODY PROPORTION transforms all biological layers together.
      proportionScaleX: 0.86 + 0.30 * bodyProportionU,
      proportionScaleY: 1.14 - 0.24 * bodyProportionU,

      opacity: 0.70 + 0.26 * densityU,
    },

    membrane: {
      scaleX: 0.88 + 0.28 * membraneU,
      scaleY: 1.08 - 0.16 * membraneU,
      opposingRotationDeg: 7.0 * signed(g[2]),
      opacity: 0.56 + 0.38 * densityU,
    },

    pigment: {
      hueShiftDeg: -24 + 48 * pigmentU,
      saturation: 0.90 + 0.20 * pigmentU,
    },

    bioluminescence: {
      glowOpacity: 0.20 + 0.72 * bioU,
      glowScale: 1.00 + 0.07 * bioU,
      coreBrightness: 0.85 + 0.35 * bioU,
    },

    core: {
      mode: coreMode,
      scaleX: corePreset[0] * (0.94 + 0.12 * coreFine),
      scaleY: corePreset[1] * (0.94 + 0.12 * coreFine),
      rotationDeg: 8.0 * signed(g[6]),
      opacity: 0.76 + 0.24 * altUnit(g[6], 0x91),
    },

    sensoryNodes: {
      count: 2 + (sensoryMixed % 7), // 2..8
      radiusPxAt1024: 1.4 + 2.6 * altUnit(g[7], 0xa7),
      opacity: 0.35 + 0.55 * altUnit(g[7], 0x5d),
      seed: ((g[7] << 8) | mix8(g[7] ^ 0xc3)) >>> 0,
      // Positions come from the selected family's fixed sensoryAnchors.
      // Render the first `count` anchors; do not invent per-frame randomness.
    },

    appendages: {
      mode: appendageMode,
      ...appendagePreset,
      expressionScale: 0.84 + 0.34 * appendageExpressionU,
      expressionTendrilOpacityMul: 0.55 + 0.55 * appendageExpressionU,
      expressionMotionMul: 0.70 + 0.60 * appendageExpressionU,
    },

    surface: {
      mode: surfaceMode,
      opacity: 0.18 + 0.70 * surfaceDensityU,
      contrast: 0.86 + 0.42 * surfaceDensityU,
    },

    internalFilaments: {
      opacity: 0.12 + 0.48 * filamentU,
      scale: 0.96 + 0.06 * filamentU,
      hueOffsetDeg: 10.0 * signed(g[12]),
    },

    halo: {
      opacity: 0.08 + 0.62 * haloU,
      scale: 1.00 + 0.11 * haloU,
      blurPxAt1024: 6 + 16 * haloU,
    },

    motion: {
      periodMs: Math.round(5400 - 3300 * motionU), // 5400..2100
      pulseScaleAmplitude: 0.006 + 0.024 * motionU,
      finWaveDeg: 0.6 + 3.0 * motionU,
      tendrilDriftPxAt1024: 2 + 8 * motionU,
    },

    asymmetry: {
      sideScaleDelta: 0.055 * asymS,
      sideRotationDeg: 3.5 * asymS,
      coreOffsetPxAt1024: 8.0 * asymS,
    },
  } as const;
}
