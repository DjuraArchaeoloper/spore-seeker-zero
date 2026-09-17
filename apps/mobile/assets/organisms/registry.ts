import {
  SPORE_CREATURE_ART_FAMILIES,
  type CreatureFamily,
  type CreatureFamilyArtDefinition,
  type CreatureLayer
} from "@spore/shared";

export {
  ORGANISM_RUNTIME_CANVAS,
  SPORE_CREATURE_LAYER_ORDER
} from "@spore/shared";

type CreatureAssetSource = number;

export type CreatureLayerAssets = Readonly<Record<CreatureLayer, CreatureAssetSource>>;

export type CreatureFamilyDefinition = CreatureFamilyArtDefinition & {
  assets: CreatureLayerAssets;
};

export const SPORE_MOUSTACHE_ASSET =
  require("../../../../packages/shared/assets/organisms/shared/moustache_01.png") as CreatureAssetSource;

// Metro requires static image paths, so this file remains the mobile-only
// adapter from shared art metadata to bundled React Native asset IDs.
export const SPORE_CREATURE_FAMILIES = {
  "void-drifter": {
    ...SPORE_CREATURE_ART_FAMILIES["void-drifter"],
    assets: {
      body: require("../../../../packages/shared/assets/organisms/void-drifter/body.png"),
      fins: require("../../../../packages/shared/assets/organisms/void-drifter/fins.png"),
      core: require("../../../../packages/shared/assets/organisms/void-drifter/core.png"),
      tendrils: require("../../../../packages/shared/assets/organisms/void-drifter/tendrils.png"),
      surface: require("../../../../packages/shared/assets/organisms/void-drifter/surface.png"),
      glow: require("../../../../packages/shared/assets/organisms/void-drifter/glow.png")
    }
  },
  "crystal-bloom": {
    ...SPORE_CREATURE_ART_FAMILIES["crystal-bloom"],
    assets: {
      body: require("../../../../packages/shared/assets/organisms/crystal-bloom/body.png"),
      fins: require("../../../../packages/shared/assets/organisms/crystal-bloom/fins.png"),
      core: require("../../../../packages/shared/assets/organisms/crystal-bloom/core.png"),
      tendrils: require("../../../../packages/shared/assets/organisms/crystal-bloom/tendrils.png"),
      surface: require("../../../../packages/shared/assets/organisms/crystal-bloom/surface.png"),
      glow: require("../../../../packages/shared/assets/organisms/crystal-bloom/glow.png")
    }
  },
  "nebula-spine": {
    ...SPORE_CREATURE_ART_FAMILIES["nebula-spine"],
    assets: {
      body: require("../../../../packages/shared/assets/organisms/nebula-spine/body.png"),
      fins: require("../../../../packages/shared/assets/organisms/nebula-spine/fins.png"),
      core: require("../../../../packages/shared/assets/organisms/nebula-spine/core.png"),
      tendrils: require("../../../../packages/shared/assets/organisms/nebula-spine/tendrils.png"),
      surface: require("../../../../packages/shared/assets/organisms/nebula-spine/surface.png"),
      glow: require("../../../../packages/shared/assets/organisms/nebula-spine/glow.png")
    }
  },
  "silk-ray": {
    ...SPORE_CREATURE_ART_FAMILIES["silk-ray"],
    assets: {
      body: require("../../../../packages/shared/assets/organisms/silk-ray/body.png"),
      fins: require("../../../../packages/shared/assets/organisms/silk-ray/fins.png"),
      core: require("../../../../packages/shared/assets/organisms/silk-ray/core.png"),
      tendrils: require("../../../../packages/shared/assets/organisms/silk-ray/tendrils.png"),
      surface: require("../../../../packages/shared/assets/organisms/silk-ray/surface.png"),
      glow: require("../../../../packages/shared/assets/organisms/silk-ray/glow.png")
    }
  },
  "pearl-medusa": {
    ...SPORE_CREATURE_ART_FAMILIES["pearl-medusa"],
    assets: {
      body: require("../../../../packages/shared/assets/organisms/pearl-medusa/body.png"),
      fins: require("../../../../packages/shared/assets/organisms/pearl-medusa/fins.png"),
      core: require("../../../../packages/shared/assets/organisms/pearl-medusa/core.png"),
      tendrils: require("../../../../packages/shared/assets/organisms/pearl-medusa/tendrils.png"),
      surface: require("../../../../packages/shared/assets/organisms/pearl-medusa/surface.png"),
      glow: require("../../../../packages/shared/assets/organisms/pearl-medusa/glow.png")
    }
  },
  "prism-spine": {
    ...SPORE_CREATURE_ART_FAMILIES["prism-spine"],
    assets: {
      body: require("../../../../packages/shared/assets/organisms/prism-spine/body.png"),
      fins: require("../../../../packages/shared/assets/organisms/prism-spine/fins.png"),
      core: require("../../../../packages/shared/assets/organisms/prism-spine/core.png"),
      tendrils: require("../../../../packages/shared/assets/organisms/prism-spine/tendrils.png"),
      surface: require("../../../../packages/shared/assets/organisms/prism-spine/surface.png"),
      glow: require("../../../../packages/shared/assets/organisms/prism-spine/glow.png")
    }
  },
  "astral-chrysalis": {
    ...SPORE_CREATURE_ART_FAMILIES["astral-chrysalis"],
    assets: {
      body: require("../../../../packages/shared/assets/organisms/astral-chrysalis/body.png"),
      fins: require("../../../../packages/shared/assets/organisms/astral-chrysalis/fins.png"),
      core: require("../../../../packages/shared/assets/organisms/astral-chrysalis/core.png"),
      tendrils: require("../../../../packages/shared/assets/organisms/astral-chrysalis/tendrils.png"),
      surface: require("../../../../packages/shared/assets/organisms/astral-chrysalis/surface.png"),
      glow: require("../../../../packages/shared/assets/organisms/astral-chrysalis/glow.png")
    }
  },
  "nova-urchin": {
    ...SPORE_CREATURE_ART_FAMILIES["nova-urchin"],
    assets: {
      body: require("../../../../packages/shared/assets/organisms/nova-urchin/body.png"),
      fins: require("../../../../packages/shared/assets/organisms/nova-urchin/fins.png"),
      core: require("../../../../packages/shared/assets/organisms/nova-urchin/core.png"),
      tendrils: require("../../../../packages/shared/assets/organisms/nova-urchin/tendrils.png"),
      surface: require("../../../../packages/shared/assets/organisms/nova-urchin/surface.png"),
      glow: require("../../../../packages/shared/assets/organisms/nova-urchin/glow.png")
    }
  },
  "celestial-queen": {
    ...SPORE_CREATURE_ART_FAMILIES["celestial-queen"],
    assets: {
      body: require("../../../../packages/shared/assets/organisms/celestial-queen/body.png"),
      fins: require("../../../../packages/shared/assets/organisms/celestial-queen/fins.png"),
      core: require("../../../../packages/shared/assets/organisms/celestial-queen/core.png"),
      tendrils: require("../../../../packages/shared/assets/organisms/celestial-queen/tendrils.png"),
      surface: require("../../../../packages/shared/assets/organisms/celestial-queen/surface.png"),
      glow: require("../../../../packages/shared/assets/organisms/celestial-queen/glow.png")
    }
  },
  "ribbon-leviathan": {
    ...SPORE_CREATURE_ART_FAMILIES["ribbon-leviathan"],
    assets: {
      body: require("../../../../packages/shared/assets/organisms/ribbon-leviathan/body.png"),
      fins: require("../../../../packages/shared/assets/organisms/ribbon-leviathan/fins.png"),
      core: require("../../../../packages/shared/assets/organisms/ribbon-leviathan/core.png"),
      tendrils: require("../../../../packages/shared/assets/organisms/ribbon-leviathan/tendrils.png"),
      surface: require("../../../../packages/shared/assets/organisms/ribbon-leviathan/surface.png"),
      glow: require("../../../../packages/shared/assets/organisms/ribbon-leviathan/glow.png")
    }
  }
} as const satisfies Record<CreatureFamily, CreatureFamilyDefinition>;
