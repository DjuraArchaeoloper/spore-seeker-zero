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

export type OrganismPhenotype = {
  genome: GenomeBytes;
  seed: number;
  body: {
    family: "ovoid" | "bell" | "spindle" | "manta" | "medusa" | "amoeboid";
    widthScale: number;
    heightScale: number;
    massBias: number;
  };
  membrane: {
    lobing: number;
    undulation: number;
    irregularity: number;
    opacity: number;
    thickness: number;
    edgeOpacity: number;
  };
  pigment: {
    family: string;
    base: string;
    deep: string;
    light: string;
  };
  luminescence: {
    strength: number;
    spread: number;
    secondary: string;
  };
  nucleus: {
    form: "core" | "split" | "ring" | "cluster";
    count: number;
    arrangement: number;
    scale: number;
  };
  sensoryNodes: {
    count: number;
    radius: number;
    placement: number;
    glow: number;
  };
  appendages: {
    family: "cilia" | "tendrils" | "spines" | "fins" | "filamentBundles";
    count: number;
    length: number;
    curvature: number;
    spread: number;
    thickness: number;
  };
  surface: {
    pattern: "cells" | "speckles" | "striations" | "mottling" | "fineVeins";
    density: number;
    scale: number;
    opacity: number;
  };
  filaments: {
    count: number;
    complexity: number;
    opacity: number;
    curve: number;
  };
  halo: {
    particles: number;
    spread: number;
    opacity: number;
  };
  motion: {
    breatheDurationMs: number;
    breatheAmplitude: number;
    pulseDurationMs: number;
    pulseStrength: number;
    driftAmplitude: number;
  };
  asymmetry: {
    centerOffsetX: number;
    centerOffsetY: number;
    rotationDeg: number;
    lobeBias: number;
  };
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
const BODY_FAMILIES = ["ovoid", "bell", "spindle", "manta", "medusa", "amoeboid"] as const;
const NUCLEUS_FORMS = ["core", "split", "ring", "cluster"] as const;
const APPENDAGE_FAMILIES = [
  "cilia",
  "tendrils",
  "spines",
  "fins",
  "filamentBundles"
] as const;
const SURFACE_PATTERNS = ["cells", "speckles", "striations", "mottling", "fineVeins"] as const;

const PIGMENTS = [
  { family: "pale violet", base: "#9389b6", deep: "#20192f", light: "#ded8ff" },
  { family: "cold blue", base: "#789dc7", deep: "#0a1726", light: "#d4eaff" },
  { family: "smoked teal", base: "#6fa89d", deep: "#102722", light: "#c9eee5" },
  { family: "muted cyan", base: "#7eb9bd", deep: "#10272c", light: "#d3f6f3" },
  { family: "pearl tissue", base: "#bcb7aa", deep: "#2a2823", light: "#f4ead9" },
  { family: "abyss blue", base: "#7893c4", deep: "#081521", light: "#d7e8ff" },
  { family: "ghost rose", base: "#ae8998", deep: "#302129", light: "#efd1dc" },
  { family: "mineral green", base: "#8eb296", deep: "#18281d", light: "#d5ead7" }
] as const;

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

export function phenotypeFromGenome(input: GenomeInput): OrganismPhenotype {
  const genome = typeof input === "string" ? parseGenomeHex(input) : validateGenomeBytes(input);
  const pigment = PIGMENTS[genome[4] % PIGMENTS.length];
  const seed = seedFromGenome(genome);
  const densityUnit = unit(genome[11]);

  return {
    genome,
    seed,
    body: {
      family: BODY_FAMILIES[genome[0] % BODY_FAMILIES.length],
      widthScale: range(genome[1], 0.82, 1.24),
      heightScale: range(255 - genome[1], 0.9, 1.28),
      massBias: range(genome[1], -0.14, 0.16)
    },
    membrane: {
      lobing: range(genome[2], 0.02, 0.18),
      undulation: range((genome[2] * 7) % 256, 0.015, 0.12),
      irregularity: range((genome[2] * 13) % 256, 0.01, 0.085),
      opacity: range(genome[3], 0.28, 0.52),
      thickness: range(255 - genome[3], 1.2, 3.8),
      edgeOpacity: range(genome[3], 0.24, 0.58)
    },
    pigment: { ...pigment },
    luminescence: {
      strength: range(genome[5], 0.16, 0.58),
      spread: range(255 - genome[5], 0.22, 0.48),
      secondary: PIGMENTS[(genome[4] + 2 + (genome[5] % 3)) % PIGMENTS.length].light
    },
    nucleus: {
      form: NUCLEUS_FORMS[genome[6] % NUCLEUS_FORMS.length],
      count: 1 + (genome[6] % 3),
      arrangement: unit((genome[6] * 29) % 256),
      scale: range(genome[6], 0.72, 1.18)
    },
    sensoryNodes: {
      count: genome[7] < 36 ? 0 : 3 + (genome[7] % 7),
      radius: range(genome[7], 2.2, 4.6),
      placement: unit((genome[7] * 17) % 256),
      glow: range(255 - genome[7], 0.2, 0.62)
    },
    appendages: {
      family: APPENDAGE_FAMILIES[genome[8] % APPENDAGE_FAMILIES.length],
      count: 6 + (genome[9] % 13),
      length: range(genome[9], 0.12, 0.34),
      curvature: range((genome[9] * 11) % 256, -0.48, 0.48),
      spread: range(255 - genome[9], 0.36, 0.86),
      thickness: range(genome[9], 0.8, 2.4)
    },
    surface: {
      pattern: SURFACE_PATTERNS[genome[10] % SURFACE_PATTERNS.length],
      density: range(genome[11], 0.18, 0.76),
      scale: range(255 - genome[10], 0.7, 1.45),
      opacity: range(genome[11], 0.09, 0.28)
    },
    filaments: {
      count: 4 + Math.round(densityUnit * 10),
      complexity: range(genome[12], 0.18, 0.72),
      opacity: range(255 - genome[12], 0.14, 0.34),
      curve: range((genome[12] * 19) % 256, -0.32, 0.32)
    },
    halo: {
      particles: 5 + (genome[13] % 16),
      spread: range(genome[13], 0.52, 0.92),
      opacity: range(255 - genome[13], 0.08, 0.22)
    },
    motion: {
      breatheDurationMs: Math.round(range(genome[14], 3600, 6800)),
      breatheAmplitude: range(255 - genome[14], 0.012, 0.038),
      pulseDurationMs: Math.round(range((genome[14] * 5) % 256, 1800, 3600)),
      pulseStrength: range(genome[14], 0.025, 0.085),
      driftAmplitude: range(255 - genome[14], 0.6, 2.4)
    },
    asymmetry: {
      centerOffsetX: range(genome[15], -0.045, 0.045),
      centerOffsetY: range((genome[15] * 23) % 256, -0.03, 0.035),
      rotationDeg: range(genome[15], -7, 7),
      lobeBias: range((genome[15] * 31) % 256, -0.11, 0.11)
    }
  };
}

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

export function visualUnit(seed: number, salt: number): number {
  let value = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;

  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  value ^= value >>> 16;

  return value / 0xffffffff;
}

function seedFromGenome(genome: GenomeBytes) {
  let hash = 0x811c9dc5;

  for (const byte of genome) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash >>> 0;
}

function range(byte: number, min: number, max: number) {
  return min + unit(byte) * (max - min);
}

function unit(byte: number) {
  return byte / 255;
}
