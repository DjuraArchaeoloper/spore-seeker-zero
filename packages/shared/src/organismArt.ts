import type { CreatureFamily } from "./genome";

export type CreatureLayer = "body" | "fins" | "core" | "tendrils" | "surface" | "glow";
export type CreatureRenderLayer = CreatureLayer | "sensoryNodes" | "moustache";
export type PointPair = readonly [number, number];

export type CreatureFamilyArtDefinition = {
  id: CreatureFamily;
  layers: Readonly<Record<CreatureLayer, string>>;
  moustache: {
    center: PointPair;
    width: number;
    rotationDeg: number;
  };
  sensoryAnchors: readonly PointPair[];
};

export const SHOW_MOUSTACHE = true;
export const SPORE_CREATURE_ART_REVISION = 1;

export const ORGANISM_RUNTIME_CANVAS = {
  width: 1024,
  height: 1024
} as const;

export const ORGANISM_SOURCE_CANVAS = {
  width: 2048,
  height: 2048
} as const;

export const SPORE_CREATURE_LAYER_ORDER = [
  "glow",
  "fins",
  "body",
  "tendrils",
  "core",
  "surface",
  "sensoryNodes",
  "moustache"
] as const satisfies readonly CreatureRenderLayer[];

export const SPORE_MOUSTACHE_ASSET_PATH = "shared/moustache_01.png";

export const SPORE_CREATURE_ART_FAMILIES = {
  "void-drifter": {
    id: "void-drifter",
    layers: {
      body: "void-drifter/body.png",
      fins: "void-drifter/fins.png",
      core: "void-drifter/core.png",
      tendrils: "void-drifter/tendrils.png",
      surface: "void-drifter/surface.png",
      glow: "void-drifter/glow.png"
    },
    moustache: {
      center: [0.5, 0.516],
      width: 0.148,
      rotationDeg: 0
    },
    sensoryAnchors: [
      [0.44, 0.39],
      [0.56, 0.39],
      [0.41, 0.47],
      [0.59, 0.47],
      [0.45, 0.55],
      [0.55, 0.55],
      [0.47, 0.31],
      [0.53, 0.31]
    ]
  },
  "crystal-bloom": {
    id: "crystal-bloom",
    layers: {
      body: "crystal-bloom/body.png",
      fins: "crystal-bloom/fins.png",
      core: "crystal-bloom/core.png",
      tendrils: "crystal-bloom/tendrils.png",
      surface: "crystal-bloom/surface.png",
      glow: "crystal-bloom/glow.png"
    },
    moustache: {
      center: [0.5088, 0.4946],
      width: 0.142,
      rotationDeg: 0
    },
    sensoryAnchors: [
      [0.43, 0.41],
      [0.57, 0.41],
      [0.39, 0.49],
      [0.61, 0.49],
      [0.43, 0.58],
      [0.57, 0.58],
      [0.47, 0.34],
      [0.53, 0.34]
    ]
  },
  "nebula-spine": {
    id: "nebula-spine",
    layers: {
      body: "nebula-spine/body.png",
      fins: "nebula-spine/fins.png",
      core: "nebula-spine/core.png",
      tendrils: "nebula-spine/tendrils.png",
      surface: "nebula-spine/surface.png",
      glow: "nebula-spine/glow.png"
    },
    moustache: {
      center: [0.349, 0.458],
      width: 0.145,
      rotationDeg: -5
    },
    sensoryAnchors: [
      [0.35, 0.36],
      [0.39, 0.41],
      [0.43, 0.47],
      [0.47, 0.53],
      [0.51, 0.59],
      [0.55, 0.65],
      [0.42, 0.34],
      [0.58, 0.69]
    ]
  },
  "silk-ray": {
    id: "silk-ray",
    layers: {
      body: "silk-ray/body.png",
      fins: "silk-ray/fins.png",
      core: "silk-ray/core.png",
      tendrils: "silk-ray/tendrils.png",
      surface: "silk-ray/surface.png",
      glow: "silk-ray/glow.png"
    },
    moustache: {
      center: [0.5078, 0.4902],
      width: 0.142,
      rotationDeg: 0
    },
    sensoryAnchors: [
      [0.43, 0.4],
      [0.57, 0.4],
      [0.405, 0.48],
      [0.595, 0.48],
      [0.44, 0.57],
      [0.56, 0.57],
      [0.47, 0.33],
      [0.53, 0.33]
    ]
  },
  "pearl-medusa": {
    id: "pearl-medusa",
    layers: {
      body: "pearl-medusa/body.png",
      fins: "pearl-medusa/fins.png",
      core: "pearl-medusa/core.png",
      tendrils: "pearl-medusa/tendrils.png",
      surface: "pearl-medusa/surface.png",
      glow: "pearl-medusa/glow.png"
    },
    moustache: {
      center: [0.5088, 0.4946],
      width: 0.142,
      rotationDeg: 0
    },
    sensoryAnchors: [
      [0.43, 0.41],
      [0.57, 0.41],
      [0.39, 0.49],
      [0.61, 0.49],
      [0.43, 0.58],
      [0.57, 0.58],
      [0.47, 0.34],
      [0.53, 0.34]
    ]
  },
  "prism-spine": {
    id: "prism-spine",
    layers: {
      body: "prism-spine/body.png",
      fins: "prism-spine/fins.png",
      core: "prism-spine/core.png",
      tendrils: "prism-spine/tendrils.png",
      surface: "prism-spine/surface.png",
      glow: "prism-spine/glow.png"
    },
    moustache: {
      center: [0.5088, 0.4946],
      width: 0.142,
      rotationDeg: 0
    },
    sensoryAnchors: [
      [0.43, 0.41],
      [0.57, 0.41],
      [0.39, 0.49],
      [0.61, 0.49],
      [0.43, 0.58],
      [0.57, 0.58],
      [0.47, 0.34],
      [0.53, 0.34]
    ]
  },
  "astral-chrysalis": {
    id: "astral-chrysalis",
    layers: {
      body: "astral-chrysalis/body.png",
      fins: "astral-chrysalis/fins.png",
      core: "astral-chrysalis/core.png",
      tendrils: "astral-chrysalis/tendrils.png",
      surface: "astral-chrysalis/surface.png",
      glow: "astral-chrysalis/glow.png"
    },
    moustache: {
      center: [0.5088, 0.4946],
      width: 0.142,
      rotationDeg: 0
    },
    sensoryAnchors: [
      [0.43, 0.41],
      [0.57, 0.41],
      [0.39, 0.49],
      [0.61, 0.49],
      [0.43, 0.58],
      [0.57, 0.58],
      [0.47, 0.34],
      [0.53, 0.34]
    ]
  },
  "nova-urchin": {
    id: "nova-urchin",
    layers: {
      body: "nova-urchin/body.png",
      fins: "nova-urchin/fins.png",
      core: "nova-urchin/core.png",
      tendrils: "nova-urchin/tendrils.png",
      surface: "nova-urchin/surface.png",
      glow: "nova-urchin/glow.png"
    },
    moustache: {
      center: [0.5088, 0.4946],
      width: 0.142,
      rotationDeg: 0
    },
    sensoryAnchors: [
      [0.43, 0.41],
      [0.57, 0.41],
      [0.39, 0.49],
      [0.61, 0.49],
      [0.43, 0.58],
      [0.57, 0.58],
      [0.47, 0.34],
      [0.53, 0.34]
    ]
  },
  "celestial-queen": {
    id: "celestial-queen",
    layers: {
      body: "celestial-queen/body.png",
      fins: "celestial-queen/fins.png",
      core: "celestial-queen/core.png",
      tendrils: "celestial-queen/tendrils.png",
      surface: "celestial-queen/surface.png",
      glow: "celestial-queen/glow.png"
    },
    moustache: {
      center: [0.5088, 0.4946],
      width: 0.142,
      rotationDeg: 0
    },
    sensoryAnchors: [
      [0.43, 0.41],
      [0.57, 0.41],
      [0.39, 0.49],
      [0.61, 0.49],
      [0.43, 0.58],
      [0.57, 0.58],
      [0.47, 0.34],
      [0.53, 0.34]
    ]
  },
  "ribbon-leviathan": {
    id: "ribbon-leviathan",
    layers: {
      body: "ribbon-leviathan/body.png",
      fins: "ribbon-leviathan/fins.png",
      core: "ribbon-leviathan/core.png",
      tendrils: "ribbon-leviathan/tendrils.png",
      surface: "ribbon-leviathan/surface.png",
      glow: "ribbon-leviathan/glow.png"
    },
    moustache: {
      center: [0.5088, 0.4946],
      width: 0.142,
      rotationDeg: 0
    },
    sensoryAnchors: [
      [0.43, 0.41],
      [0.57, 0.41],
      [0.39, 0.49],
      [0.61, 0.49],
      [0.43, 0.58],
      [0.57, 0.58],
      [0.47, 0.34],
      [0.53, 0.34]
    ]
  }
} as const satisfies Record<CreatureFamily, CreatureFamilyArtDefinition>;

export const SPORE_CREATURE_ART = {
  version: SPORE_CREATURE_ART_REVISION,
  runtimeCanvas: ORGANISM_RUNTIME_CANVAS,
  sourceCanvas: ORGANISM_SOURCE_CANVAS,
  layerOrderBottomToTop: SPORE_CREATURE_LAYER_ORDER,
  shared: {
    moustache: SPORE_MOUSTACHE_ASSET_PATH
  },
  families: SPORE_CREATURE_ART_FAMILIES
} as const;

export function getCreatureFamilyArt(family: CreatureFamily) {
  return SPORE_CREATURE_ART_FAMILIES[family];
}
