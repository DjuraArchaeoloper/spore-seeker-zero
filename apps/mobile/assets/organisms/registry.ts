import type { CreatureFamily } from "@spore/shared";

export type CreatureLayer = "body" | "fins" | "core" | "tendrils" | "surface" | "glow";
type CreatureRenderLayer = CreatureLayer | "sensoryNodes" | "moustache";
type CreatureAssetSource = number;
type PointPair = readonly [number, number];

export type CreatureLayerAssets = Record<CreatureLayer, CreatureAssetSource>;

export type CreatureFamilyDefinition = {
  id: CreatureFamily;
  assets: CreatureLayerAssets;
  moustache: {
    center: PointPair;
    width: number;
    rotationDeg: number;
  };
  sensoryAnchors: readonly PointPair[];
};

export const ORGANISM_RUNTIME_CANVAS = {
  width: 1024,
  height: 1024
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

export const SPORE_MOUSTACHE_ASSET = require("./shared/moustache_01.png") as CreatureAssetSource;

// Art registration is separate from genome bucket assignment. Do not derive
// BODY FORM mapping from this object's length or key order.
export const SPORE_CREATURE_FAMILIES = {
  "void-drifter": {
    id: "void-drifter",
    assets: {
      body: require("./void-drifter/body.png"),
      fins: require("./void-drifter/fins.png"),
      core: require("./void-drifter/core.png"),
      tendrils: require("./void-drifter/tendrils.png"),
      surface: require("./void-drifter/surface.png"),
      glow: require("./void-drifter/glow.png")
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
    assets: {
      body: require("./crystal-bloom/body.png"),
      fins: require("./crystal-bloom/fins.png"),
      core: require("./crystal-bloom/core.png"),
      tendrils: require("./crystal-bloom/tendrils.png"),
      surface: require("./crystal-bloom/surface.png"),
      glow: require("./crystal-bloom/glow.png")
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
    assets: {
      body: require("./nebula-spine/body.png"),
      fins: require("./nebula-spine/fins.png"),
      core: require("./nebula-spine/core.png"),
      tendrils: require("./nebula-spine/tendrils.png"),
      surface: require("./nebula-spine/surface.png"),
      glow: require("./nebula-spine/glow.png")
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
    assets: {
      body: require("./silk-ray/body.png"),
      fins: require("./silk-ray/fins.png"),
      core: require("./silk-ray/core.png"),
      tendrils: require("./silk-ray/tendrils.png"),
      surface: require("./silk-ray/surface.png"),
      glow: require("./silk-ray/glow.png")
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
    assets: {
      body: require("./pearl-medusa/body.png"),
      fins: require("./pearl-medusa/fins.png"),
      core: require("./pearl-medusa/core.png"),
      tendrils: require("./pearl-medusa/tendrils.png"),
      surface: require("./pearl-medusa/surface.png"),
      glow: require("./pearl-medusa/glow.png")
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
    assets: {
      body: require("./prism-spine/body.png"),
      fins: require("./prism-spine/fins.png"),
      core: require("./prism-spine/core.png"),
      tendrils: require("./prism-spine/tendrils.png"),
      surface: require("./prism-spine/surface.png"),
      glow: require("./prism-spine/glow.png")
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
    assets: {
      body: require("./astral-chrysalis/body.png"),
      fins: require("./astral-chrysalis/fins.png"),
      core: require("./astral-chrysalis/core.png"),
      tendrils: require("./astral-chrysalis/tendrils.png"),
      surface: require("./astral-chrysalis/surface.png"),
      glow: require("./astral-chrysalis/glow.png")
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
    assets: {
      body: require("./nova-urchin/body.png"),
      fins: require("./nova-urchin/fins.png"),
      core: require("./nova-urchin/core.png"),
      tendrils: require("./nova-urchin/tendrils.png"),
      surface: require("./nova-urchin/surface.png"),
      glow: require("./nova-urchin/glow.png")
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
    assets: {
      body: require("./celestial-queen/body.png"),
      fins: require("./celestial-queen/fins.png"),
      core: require("./celestial-queen/core.png"),
      tendrils: require("./celestial-queen/tendrils.png"),
      surface: require("./celestial-queen/surface.png"),
      glow: require("./celestial-queen/glow.png")
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
    assets: {
      body: require("./ribbon-leviathan/body.png"),
      fins: require("./ribbon-leviathan/fins.png"),
      core: require("./ribbon-leviathan/core.png"),
      tendrils: require("./ribbon-leviathan/tendrils.png"),
      surface: require("./ribbon-leviathan/surface.png"),
      glow: require("./ribbon-leviathan/glow.png")
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
} as const satisfies Record<CreatureFamily, CreatureFamilyDefinition>;
