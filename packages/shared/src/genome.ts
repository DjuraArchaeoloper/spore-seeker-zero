export const GENOME_BYTE_LENGTH = 16;

export const SEEKER_ZERO_GENOME = [
  0x53, 0x50, 0x4f, 0x52, 0x45, 0x00, 0x00, 0x00, 0x53, 0x45, 0x45, 0x4b, 0x45,
  0x52, 0x00, 0x00
] as const;

export const SEEKER_ZERO_GENOME_HEX = "53504f52450000005345454b45520000";

export type GenomeBytes = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];

export type GenomeInput = string | ArrayLike<number>;

export type CreatureFamily =
  | "silk-ray"
  | "void-drifter"
  | "crystal-bloom"
  | "nebula-spine"
  | "pearl-medusa"
  | "prism-spine"
  | "astral-chrysalis"
  | "nova-urchin"
  | "celestial-queen"
  | "ribbon-leviathan";

export type MorphologyProfile = Readonly<{
  bodyForm: number;
  proportion: number;
  membrane: number;
  appendageFamily: number;
  appendageExpression: number;
  asymmetry: number;
}>;

export type CoreMode = "compact" | "tall" | "wide" | "full";
export type AppendageMode = "wing" | "veil" | "filament" | "spine";
export type SurfaceMode = "native" | "mirror-x" | "ghost-double" | "radial-echo";

export type GenomeGene = {
  index: number;
  key:
    | "bodyForm"
    | "bodyProportion"
    | "membraneShape"
    | "membraneDensity"
    | "pigment"
    | "bioluminescence"
    | "nucleus"
    | "sensoryNodes"
    | "appendageFamily"
    | "appendageExpression"
    | "surfacePattern"
    | "surfaceDensity"
    | "internalFilaments"
    | "externalHalo"
    | "motionPulse"
    | "asymmetry";
  name: string;
  mutationLabel: string;
};

export type MutationDescription =
  | {
      geneIndex: number;
      gene: GenomeGene;
      label: string;
    }
  | {
      geneIndex: null;
      gene: null;
      label: string;
    };

const HEX_GENOME_PATTERN = /^[0-9a-fA-F]{32}$/;

type BodyFamilySlot = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const BODY_FAMILY_BY_SLOT: Record<BodyFamilySlot, CreatureFamily> = {
  0: "void-drifter",
  1: "crystal-bloom",
  2: "nebula-spine",
  3: "celestial-queen",
  4: "pearl-medusa",
  5: "prism-spine",
  6: "astral-chrysalis",
  7: "nova-urchin",
  8: "silk-ray",
  9: "ribbon-leviathan"
} as const;

export const BODY_FAMILY_SLOTS: readonly CreatureFamily[] = [
  BODY_FAMILY_BY_SLOT[0],
  BODY_FAMILY_BY_SLOT[1],
  BODY_FAMILY_BY_SLOT[2],
  BODY_FAMILY_BY_SLOT[3],
  BODY_FAMILY_BY_SLOT[4],
  BODY_FAMILY_BY_SLOT[5],
  BODY_FAMILY_BY_SLOT[6],
  BODY_FAMILY_BY_SLOT[7],
  BODY_FAMILY_BY_SLOT[8],
  BODY_FAMILY_BY_SLOT[9]
] as const;

export const STRUCTURAL_GENE_INDEXES = [0, 1, 2, 8, 9, 15] as const;

const MORPHOLOGY_PROFILE_KEYS = [
  "bodyForm",
  "proportion",
  "membrane",
  "appendageFamily",
  "appendageExpression",
  "asymmetry"
] as const satisfies readonly (keyof MorphologyProfile)[];

const MORPHOLOGY_DISTANCE_EPSILON = 1e-12;

const MORPHOLOGY_DISTANCE_WEIGHTS = {
  bodyForm: 1.12,
  proportion: 1.0,
  membrane: 0.9,
  appendageFamily: 0.88,
  appendageExpression: 0.66,
  asymmetry: 0.56
} as const satisfies MorphologyProfile;

export const MORPHOLOGY_PROFILE_BY_FAMILY = {
  "void-drifter": {
    bodyForm: 0.92,
    proportion: 0.62,
    membrane: 0.82,
    appendageFamily: 0.76,
    appendageExpression: 0.74,
    asymmetry: 0.34
  },
  "crystal-bloom": {
    bodyForm: 0.71,
    proportion: 0.74,
    membrane: 0.66,
    appendageFamily: 0.84,
    appendageExpression: 0.68,
    asymmetry: 0.18
  },
  "nebula-spine": {
    bodyForm: 0.7,
    proportion: 0.28,
    membrane: 0.35,
    appendageFamily: 0.92,
    appendageExpression: 0.88,
    asymmetry: 0.78
  },
  "celestial-queen": {
    bodyForm: 0.42,
    proportion: 0.76,
    membrane: 0.92,
    appendageFamily: 0.38,
    appendageExpression: 0.72,
    asymmetry: 0.18
  },
  "pearl-medusa": {
    bodyForm: 0.55,
    proportion: 0.55,
    membrane: 0.84,
    appendageFamily: 0.28,
    appendageExpression: 0.66,
    asymmetry: 0.26
  },
  "prism-spine": {
    bodyForm: 0.28,
    proportion: 0.48,
    membrane: 0.32,
    appendageFamily: 0.18,
    appendageExpression: 0.56,
    asymmetry: 0.44
  },
  "astral-chrysalis": {
    bodyForm: 0.35,
    proportion: 0.9,
    membrane: 0.48,
    appendageFamily: 0.45,
    appendageExpression: 0.38,
    asymmetry: 0.12
  },
  "nova-urchin": {
    bodyForm: 0.16,
    proportion: 0.42,
    membrane: 0.22,
    appendageFamily: 0.12,
    appendageExpression: 0.42,
    asymmetry: 0.52
  },
  "silk-ray": {
    bodyForm: 0.83,
    proportion: 0.98,
    membrane: 0.69,
    appendageFamily: 0.83,
    appendageExpression: 0.84,
    asymmetry: 0.16
  },
  "ribbon-leviathan": {
    bodyForm: 0.78,
    proportion: 0.18,
    membrane: 0.56,
    appendageFamily: 0.88,
    appendageExpression: 0.82,
    asymmetry: 0.92
  }
} as const satisfies Record<CreatureFamily, MorphologyProfile>;

const CORE_MODES: readonly CoreMode[] = ["compact", "tall", "wide", "full"] as const;
const APPENDAGE_MODES: readonly AppendageMode[] = ["wing", "veil", "filament", "spine"] as const;
const SURFACE_MODES: readonly SurfaceMode[] = ["native", "mirror-x", "ghost-double", "radial-echo"] as const;

export const GENOME_GENES: readonly GenomeGene[] = [
  { index: 0, key: "bodyForm", name: "BODY FORM", mutationLabel: "Body form changed" },
  { index: 1, key: "bodyProportion", name: "BODY PROPORTION", mutationLabel: "Proportion shifted" },
  { index: 2, key: "membraneShape", name: "MEMBRANE SHAPE", mutationLabel: "Membrane changed" },
  { index: 3, key: "membraneDensity", name: "MEMBRANE DENSITY", mutationLabel: "Membrane refined" },
  { index: 4, key: "pigment", name: "PIGMENT", mutationLabel: "Pigment shifted" },
  {
    index: 5,
    key: "bioluminescence",
    name: "BIOLUMINESCENCE",
    mutationLabel: "Inner light changed"
  },
  { index: 6, key: "nucleus", name: "NUCLEUS", mutationLabel: "Nucleus reformed" },
  {
    index: 7,
    key: "sensoryNodes",
    name: "SENSORY NODES",
    mutationLabel: "New sensory nodes"
  },
  {
    index: 8,
    key: "appendageFamily",
    name: "APPENDAGE FAMILY",
    mutationLabel: "Appendages changed"
  },
  {
    index: 9,
    key: "appendageExpression",
    name: "APPENDAGE EXPRESSION",
    mutationLabel: "Appendages expressed"
  },
  {
    index: 10,
    key: "surfacePattern",
    name: "SURFACE PATTERN",
    mutationLabel: "Surface pattern changed"
  },
  {
    index: 11,
    key: "surfaceDensity",
    name: "SURFACE DENSITY",
    mutationLabel: "Surface density changed"
  },
  {
    index: 12,
    key: "internalFilaments",
    name: "INTERNAL FILAMENTS",
    mutationLabel: "Filaments changed"
  },
  { index: 13, key: "externalHalo", name: "EXTERNAL HALO", mutationLabel: "Halo shifted" },
  {
    index: 14,
    key: "motionPulse",
    name: "MOTION / PULSE",
    mutationLabel: "Pulse rhythm changed"
  },
  { index: 15, key: "asymmetry", name: "ASYMMETRY", mutationLabel: "Asymmetry shifted" }
] as const;

export class GenomeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenomeValidationError";
  }
}

export function parseGenomeHex(hex: string): GenomeBytes {
  if (!HEX_GENOME_PATTERN.test(hex)) {
    throw new GenomeValidationError("Genome hex must contain exactly 32 hexadecimal characters.");
  }

  const bytes = Array.from({ length: GENOME_BYTE_LENGTH }, (_, index) =>
    Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  );

  return validateGenomeBytes(bytes);
}

export function validateGenomeBytes(bytes: ArrayLike<number>): GenomeBytes {
  if (bytes.length !== GENOME_BYTE_LENGTH) {
    throw new GenomeValidationError("Genome must contain exactly 16 bytes.");
  }

  const normalized = Array.from(bytes, (byte) => {
    if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
      throw new GenomeValidationError("Genome bytes must be integers from 0 to 255.");
    }

    return byte;
  });

  return normalized as unknown as GenomeBytes;
}

export function genomeToHex(genome: ArrayLike<number>): string {
  return validateGenomeBytes(genome)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeGenomeInput(input: GenomeInput): GenomeBytes {
  return typeof input === "string" ? parseGenomeHex(input) : validateGenomeBytes(input);
}

export function morphologyFromGenome(input: GenomeInput): MorphologyProfile {
  return deriveMorphologyProfile(normalizeGenomeInput(input));
}

function deriveMorphologyProfile(genome: ArrayLike<number>): MorphologyProfile {
  return {
    bodyForm: unit(genome[0]),
    proportion: unit(genome[1]),
    membrane: unit(genome[2]),
    appendageFamily: unit(genome[8]),
    appendageExpression: unit(genome[9]),
    asymmetry: unit(genome[15])
  };
}

export function morphologyDistanceSquared(left: MorphologyProfile, right: MorphologyProfile): number {
  return MORPHOLOGY_PROFILE_KEYS.reduce((sum, key) => {
    const delta = left[key] - right[key];

    return sum + delta * delta * MORPHOLOGY_DISTANCE_WEIGHTS[key];
  }, 0);
}

export function resolveCreatureFamilyFromMorphology(morphology: MorphologyProfile): CreatureFamily {
  let bestFamily: CreatureFamily | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const family of Object.keys(MORPHOLOGY_PROFILE_BY_FAMILY) as CreatureFamily[]) {
    const distance = morphologyDistanceSquared(morphology, MORPHOLOGY_PROFILE_BY_FAMILY[family]);
    const isBetter =
      distance < bestDistance - MORPHOLOGY_DISTANCE_EPSILON ||
      (Math.abs(distance - bestDistance) <= MORPHOLOGY_DISTANCE_EPSILON &&
        (bestFamily === null || family < bestFamily));

    if (isBetter) {
      bestFamily = family;
      bestDistance = distance;
    }
  }

  if (!bestFamily) {
    throw new Error("No SPØR morphology profiles are available.");
  }

  return bestFamily;
}

export function resolveCreatureFamily(input: GenomeInput): CreatureFamily {
  const genome = normalizeGenomeInput(input);

  return resolveCreatureFamilyFromMorphology(deriveMorphologyProfile(genome));
}

export function phenotypeFromGenome(input: GenomeInput): OrganismPhenotype {
  const genome = normalizeGenomeInput(input);

  return deriveSporePhenotype(Uint8Array.from(genome));
}

export function deriveSporePhenotype(genome: Uint8Array) {
  if (genome.length !== 16) {
    throw new Error(`SPØR genome must be exactly 16 bytes; received ${genome.length}`);
  }

  const g = [...genome];

  const morphology = deriveMorphologyProfile(genome);
  const family = resolveCreatureFamilyFromMorphology(morphology);
  const formU = unit(g[0]);

  const bodyProportionU = unit(g[1]);
  const membraneU = unit(g[2]);
  const densityU = unit(g[3]);
  const pigmentU = unit(g[4]);
  const bioU = g[5] / 255;
  const coreMixed = mix8(g[6]);
  const coreMode = CORE_MODES[coreMixed >> 6];
  const coreFine = local64(g[6]);
  const corePreset = {
    compact: [0.84, 0.84],
    tall: [0.78, 1.12],
    wide: [1.12, 0.8],
    full: [1.03, 1.03]
  }[coreMode];
  const sensoryMixed = mix8(g[7]);
  const sensoryFine = local64(g[7]);
  const sensorySeed = ((g[7] << 8) | mix8(g[7] ^ 0xc3)) >>> 0;
  const appendageMixed = mix8(g[8]);
  const appendageMode = APPENDAGE_MODES[appendageMixed >> 6];
  const appendageFine = (appendageMixed & 63) / 63;
  const appendageSigned = appendageFine * 2 - 1;
  const appendagePreset = {
    wing: { finOpacityMul: 1.0, tendrilOpacityMul: 0.45, finScaleXMul: 1.08, finScaleYMul: 1.0 },
    veil: { finOpacityMul: 0.9, tendrilOpacityMul: 0.75, finScaleXMul: 1.0, finScaleYMul: 1.08 },
    filament: { finOpacityMul: 0.58, tendrilOpacityMul: 1.0, finScaleXMul: 0.96, finScaleYMul: 1.03 },
    spine: { finOpacityMul: 0.76, tendrilOpacityMul: 0.72, finScaleXMul: 0.92, finScaleYMul: 1.06 }
  }[appendageMode];
  const appendageExpressionU = unit(g[9]);
  const surfaceMixed = mix8(g[10]);
  const surfaceMode = SURFACE_MODES[surfaceMixed >> 6];
  const surfaceFine = (surfaceMixed & 63) / 63;
  const surfaceDensityU = unit(g[11]);
  const filamentU = unit(g[12]);
  const haloU = unit(g[13]);
  const motionU = unit(g[14]);
  const restPoseU = g[14] / 255;
  const asymS = signed(g[15]);
  const asymMagnitude = Math.abs(asymS);
  const sideScaleDelta = 0.055 * asymS;

  return {
    family,
    morphology,

    body: {
      formScaleX: 0.94 + 0.12 * formU,
      formScaleY: 1.03 - 0.06 * formU,
      proportionScaleX: 0.86 + 0.3 * bodyProportionU,
      proportionScaleY: 1.14 - 0.24 * bodyProportionU,
      opacity: 0.7 + 0.26 * densityU
    },

    membrane: {
      scaleX: 0.88 + 0.28 * membraneU,
      scaleY: 1.08 - 0.16 * membraneU,
      primaryScaleX: 0.82 + 0.36 * membraneU,
      primaryScaleY: 1.12 - 0.22 * membraneU,
      opposingRotationDeg: 7.0 * signed(g[2]),
      leftRotationDeg: -8.0 * signed(g[2]),
      rightRotationDeg: 8.0 * signed(g[2]),
      edgeCurl: 0.16 + 0.68 * local64(g[2]),
      tension: 0.28 + 0.56 * altUnit(g[2], 0x2d),
      opacity: 0.56 + 0.38 * densityU
    },

    pigment: {
      hueShiftDeg: -24 + 48 * pigmentU,
      saturation: 0.9 + 0.2 * pigmentU
    },

    bioluminescence: {
      glowOpacity: 0.31576470588235295 + 0.82 * bioU,
      glowScale: 1.0112549019607844 + 0.28 * bioU,
      coreBrightness: 0.9062745098039215 + 0.68 * bioU,
      coreEmission: 1 + 0.32 * bioU,
      filamentIllumination: 1 + 1.5 * bioU,
      membraneEdgeEmission: 0.28 * bioU
    },

    core: {
      mode: coreMode,
      scaleX: corePreset[0] * (0.94 + 0.12 * coreFine),
      scaleY: corePreset[1] * (0.94 + 0.12 * coreFine),
      rotationDeg: 8.0 * signed(g[6]),
      opacity: 0.76 + 0.24 * altUnit(g[6], 0x91)
    },

    sensoryNodes: {
      count: 2 + (sensoryMixed % 7),
      radiusPxAt1024: 1.4 + 2.6 * altUnit(g[7], 0xa7),
      opacity: 0.35 + 0.55 * altUnit(g[7], 0x5d),
      seed: sensorySeed,
      anchorJitterPxAt1024: 1.5 + 5.5 * sensoryFine,
      distributionTwistDeg: -12 + 24 * altUnit(g[7], 0x71),
      depthBias: altUnit(g[7], 0x39)
    },

    appendages: {
      mode: appendageMode,
      finOpacityMul: appendagePreset.finOpacityMul * (0.92 + 0.16 * appendageFine),
      tendrilOpacityMul: appendagePreset.tendrilOpacityMul * (0.88 + 0.24 * appendageFine),
      finScaleXMul: appendagePreset.finScaleXMul * (0.94 + 0.12 * appendageFine),
      finScaleYMul: appendagePreset.finScaleYMul * (1.06 - 0.12 * appendageFine),
      familyDetail: appendageFine,
      spread: 0.82 + 0.36 * appendageFine,
      orientationDeg: 12 * appendageSigned,
      attachmentOffsetPxAt1024: 9 * altSigned(g[8], 0x5a),
      expressionScale: 0.84 + 0.34 * appendageExpressionU,
      expressionTendrilOpacityMul: 0.55 + 0.55 * appendageExpressionU,
      motionCoupling: 0.7 + 0.6 * appendageExpressionU,
      extensionBias: -0.12 + 0.24 * appendageExpressionU,
      curlDeg: -9 + 18 * altUnit(g[9], 0x36)
    },

    surface: {
      mode: surfaceMode,
      patternDetail: surfaceFine,
      rotationDeg: -9 + 18 * surfaceFine,
      echoOffsetPxAt1024: 2 + 8 * surfaceFine,
      detailScale: 0.96 + 0.1 * surfaceFine,
      phase: altUnit(g[10], 0x64),
      opacity: 0.18 + 0.7 * surfaceDensityU,
      contrast: 0.86 + 0.42 * surfaceDensityU
    },

    internalFilaments: {
      opacity: 0.12 + 0.48 * filamentU,
      scale: 0.96 + 0.06 * filamentU,
      hueOffsetDeg: 10.0 * signed(g[12]),
      strandSpread: 0.72 + 0.56 * filamentU,
      strandLength: 0.84 + 0.32 * altUnit(g[12], 0xb4),
      weaveRotationDeg: 14 * altSigned(g[12], 0x28)
    },

    halo: {
      opacity: 0.08 + 0.62 * haloU,
      scale: 1.0 + 0.11 * haloU,
      blurPxAt1024: 6 + 16 * haloU,
      ringScaleX: 0.92 + 0.16 * altUnit(g[13], 0x44),
      ringScaleY: 0.94 + 0.18 * altUnit(g[13], 0x88),
      offsetPxAt1024: 10 * altSigned(g[13], 0x19),
      texturePhase: altUnit(g[13], 0xd2)
    },

    motion: {
      periodMs: Math.round(5400 - 3300 * motionU),
      pulseScaleAmplitude: 0.006 + 0.024 * motionU,
      finWaveDeg: 0.6 + 3.0 * motionU,
      tendrilDriftPxAt1024: 2 + 8 * motionU,
      restPoseRotationDeg: -2.5 + 7.0 * restPoseU,
      restPoseScaleX: 1 + 0.07 * restPoseU,
      restPoseScaleY: 1 - 0.055 * restPoseU,
      restPoseOffsetPxAt1024: 12 * restPoseU
    },

    asymmetry: {
      sideScaleDelta,
      leftScale: 1 + sideScaleDelta,
      rightScale: 1 - sideScaleDelta,
      sideRotationDeg: 3.5 * asymS,
      coreOffsetPxAt1024: 8.0 * asymS,
      membraneSkewDeg: 5.5 * asymS,
      appendageOffsetPxAt1024: 9.0 * asymS,
      intensity: asymMagnitude
    }
  } as const;
}

export type OrganismPhenotype = ReturnType<typeof deriveSporePhenotype>;

export function describeMutation(
  parentGenome: GenomeInput,
  childGenome: GenomeInput
): MutationDescription {
  const parent =
    typeof parentGenome === "string" ? parseGenomeHex(parentGenome) : validateGenomeBytes(parentGenome);
  const child =
    typeof childGenome === "string" ? parseGenomeHex(childGenome) : validateGenomeBytes(childGenome);
  const changedIndexes = parent
    .map((byte, index) => (byte === child[index] ? -1 : index))
    .filter((index) => index >= 0);

  if (changedIndexes.length !== 1) {
    return {
      geneIndex: null,
      gene: null,
      label: changedIndexes.length === 0 ? "No mutation detected" : "Multiple genes changed"
    };
  }

  const changedIndex = changedIndexes[0];
  const gene = GENOME_GENES[changedIndex];

  return {
    geneIndex: gene.index,
    gene,
    label: gene.mutationLabel
  };
}

export const mix8 = (x: number): number => ((x & 0xff) * 73 + 41) & 0xff;

const unit = (x: number): number => mix8(x) / 255;
const signed = (x: number): number => unit(x) * 2 - 1;
const local64 = (x: number): number => (mix8(x) & 63) / 63;
const altUnit = (x: number, salt: number): number => mix8((x ^ salt) & 0xff) / 255;
const altSigned = (x: number, salt: number): number => altUnit(x, salt) * 2 - 1;
