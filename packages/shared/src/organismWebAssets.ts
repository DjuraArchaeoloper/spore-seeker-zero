import silkRayBody from "../assets/organisms/silk-ray/body.png";
import silkRayCore from "../assets/organisms/silk-ray/core.png";
import silkRayFins from "../assets/organisms/silk-ray/fins.png";
import silkRayGlow from "../assets/organisms/silk-ray/glow.png";
import silkRaySurface from "../assets/organisms/silk-ray/surface.png";
import silkRayTendrils from "../assets/organisms/silk-ray/tendrils.png";
import moustache from "../assets/organisms/shared/moustache_01.png";
import { resolveCreatureFamily, SEEKER_ZERO_GENOME, type CreatureLayer } from "./genome";

export type WebImageAsset = {
  src: string;
  width: number;
  height: number;
  blurDataURL?: string;
};

const seekerZeroFamily = resolveCreatureFamily(SEEKER_ZERO_GENOME);

if (seekerZeroFamily !== "silk-ray") {
  throw new Error("Seeker Zero web assets must match the canonical shared genome family.");
}

export const SEEKER_ZERO_CREATURE_WEB_ASSETS = {
  family: seekerZeroFamily,
  layers: {
    body: silkRayBody,
    fins: silkRayFins,
    core: silkRayCore,
    tendrils: silkRayTendrils,
    surface: silkRaySurface,
    glow: silkRayGlow
  } satisfies Record<CreatureLayer, WebImageAsset>,
  moustache
} as const;
