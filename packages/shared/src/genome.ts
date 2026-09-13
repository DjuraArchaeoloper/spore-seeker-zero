import { sha256 } from "@noble/hashes/sha256";

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
  | "nebula-spine";

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

export const BODY_FAMILY_BUCKETS: readonly CreatureFamily[] = [
  "silk-ray",
  "void-drifter",
  "crystal-bloom",
  "nebula-spine"
] as const;

const SEEKER_ZERO_FAMILY_INDEX = 0;
const SEEKER_ZERO_FAMILY_OFFSET =
  (SEEKER_ZERO_FAMILY_INDEX -
    (sha256(Uint8Array.from(SEEKER_ZERO_GENOME))[0] % BODY_FAMILY_BUCKETS.length) +
    BODY_FAMILY_BUCKETS.length) %
  BODY_FAMILY_BUCKETS.length;

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

export function resolveCreatureFamily(input: GenomeInput): CreatureFamily {
  const genome = normalizeGenomeInput(input);
  const digest = sha256(Uint8Array.from(genome));
  const rawIndex = digest[0] % BODY_FAMILY_BUCKETS.length;

  return BODY_FAMILY_BUCKETS[(rawIndex + SEEKER_ZERO_FAMILY_OFFSET) % BODY_FAMILY_BUCKETS.length];
}

export function phenotypeFromGenome(input: GenomeInput): OrganismPhenotype {
  const genome = normalizeGenomeInput(input);

  return deriveSporePhenotype(Uint8Array.from(genome));
}

export function deriveSporePhenotype(genome: Uint8Array) {
  if (genome.length !== 16) {
    throw new Error(`SPORE genome must be exactly 16 bytes; received ${genome.length}`);
  }

  const g = [...genome];

  const family = resolveCreatureFamily(genome);
  const formLocal = local64(g[0]);

  const bodyProportionU = unit(g[1]);
  const membraneU = unit(g[2]);
  const densityU = unit(g[3]);
  const pigmentU = unit(g[4]);
  const bioU = unit(g[5]);
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
  const appendageMixed = mix8(g[8]);
  const appendageMode = APPENDAGE_MODES[appendageMixed >> 6];
  const appendagePreset = {
    wing: { finOpacityMul: 1.0, tendrilOpacityMul: 0.45, finScaleXMul: 1.08, finScaleYMul: 1.0 },
    veil: { finOpacityMul: 0.9, tendrilOpacityMul: 0.75, finScaleXMul: 1.0, finScaleYMul: 1.08 },
    filament: { finOpacityMul: 0.58, tendrilOpacityMul: 1.0, finScaleXMul: 0.96, finScaleYMul: 1.03 },
    spine: { finOpacityMul: 0.76, tendrilOpacityMul: 0.72, finScaleXMul: 0.92, finScaleYMul: 1.06 }
  }[appendageMode];
  const appendageExpressionU = unit(g[9]);
  const surfaceMode = SURFACE_MODES[mix8(g[10]) >> 6];
  const surfaceDensityU = unit(g[11]);
  const filamentU = unit(g[12]);
  const haloU = unit(g[13]);
  const motionU = unit(g[14]);
  const asymS = signed(g[15]);

  return {
    family,

    body: {
      formScaleX: 0.94 + 0.12 * formLocal,
      formScaleY: 1.03 - 0.06 * formLocal,
      proportionScaleX: 0.86 + 0.3 * bodyProportionU,
      proportionScaleY: 1.14 - 0.24 * bodyProportionU,
      opacity: 0.7 + 0.26 * densityU
    },

    membrane: {
      scaleX: 0.88 + 0.28 * membraneU,
      scaleY: 1.08 - 0.16 * membraneU,
      opposingRotationDeg: 7.0 * signed(g[2]),
      opacity: 0.56 + 0.38 * densityU
    },

    pigment: {
      hueShiftDeg: -24 + 48 * pigmentU,
      saturation: 0.9 + 0.2 * pigmentU
    },

    bioluminescence: {
      glowOpacity: 0.2 + 0.72 * bioU,
      glowScale: 1.0 + 0.07 * bioU,
      coreBrightness: 0.85 + 0.35 * bioU
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
      seed: ((g[7] << 8) | mix8(g[7] ^ 0xc3)) >>> 0
    },

    appendages: {
      mode: appendageMode,
      ...appendagePreset,
      expressionScale: 0.84 + 0.34 * appendageExpressionU,
      expressionTendrilOpacityMul: 0.55 + 0.55 * appendageExpressionU,
      expressionMotionMul: 0.7 + 0.6 * appendageExpressionU
    },

    surface: {
      mode: surfaceMode,
      opacity: 0.18 + 0.7 * surfaceDensityU,
      contrast: 0.86 + 0.42 * surfaceDensityU
    },

    internalFilaments: {
      opacity: 0.12 + 0.48 * filamentU,
      scale: 0.96 + 0.06 * filamentU,
      hueOffsetDeg: 10.0 * signed(g[12])
    },

    halo: {
      opacity: 0.08 + 0.62 * haloU,
      scale: 1.0 + 0.11 * haloU,
      blurPxAt1024: 6 + 16 * haloU
    },

    motion: {
      periodMs: Math.round(5400 - 3300 * motionU),
      pulseScaleAmplitude: 0.006 + 0.024 * motionU,
      finWaveDeg: 0.6 + 3.0 * motionU,
      tendrilDriftPxAt1024: 2 + 8 * motionU
    },

    asymmetry: {
      sideScaleDelta: 0.055 * asymS,
      sideRotationDeg: 3.5 * asymS,
      coreOffsetPxAt1024: 8.0 * asymS
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
