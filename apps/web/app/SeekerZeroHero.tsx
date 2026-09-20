import type { CSSProperties } from "react";
import {
  createOrganismRenderModel,
  ORGANISM_RUNTIME_CANVAS,
  SEEKER_ZERO_GENOME,
  type OrganismRenderTransform,
  type SensoryNodeRenderPlan,
  type SurfaceMode
} from "@spore/shared";
import { SEEKER_ZERO_CREATURE_WEB_ASSETS, type WebImageAsset } from "@spore/shared/web-assets";

const model = createOrganismRenderModel(SEEKER_ZERO_GENOME, ORGANISM_RUNTIME_CANVAS.width);
const plan = model.plan;
const layers = SEEKER_ZERO_CREATURE_WEB_ASSETS.layers;
const moustache = SEEKER_ZERO_CREATURE_WEB_ASSETS.moustache;

export function SeekerZeroHero() {
  return (
    <figure className="seekerZeroFigure">
      <div className="organismLight" aria-hidden="true" />
      <div
        className="organismComposite"
        role="img"
        aria-label="Seeker Zero, the first SPØR organism"
      >
        <div
          className="organismBiology"
          style={{ transform: cssTransform(plan.biologicalTransform) }}
        >
          <CreatureImage
            asset={layers.glow}
            className="creatureLayer creatureGlow creatureHalo"
            style={{
              opacity: format(plan.haloOpacity),
              transform: cssTransform(plan.haloTransform)
            }}
          />
          <CreatureImage
            asset={layers.glow}
            className="creatureLayer creatureGlow"
            style={{
              opacity: format(plan.glowOpacity),
              transform: cssTransform(plan.glowTransform)
            }}
          />
          <div className="baseAnatomy" style={{ opacity: format(plan.baseAnatomyOpacity) }}>
            <CreatureImage asset={layers.fins} className="creatureLayer" />
            <CreatureImage
              asset={layers.fins}
              className="creatureLayer finAccent"
              style={{
                opacity: format(plan.finAccentOpacity),
                transform: cssTransform([
                  { scaleX: plan.finAccentScaleX },
                  { scaleY: plan.finAccentScaleY },
                  { rotate: plan.finAccentRotation }
                ])
              }}
            />
            <CreatureImage asset={layers.body} className="creatureLayer" />
          </div>
          <CreatureImage
            asset={layers.tendrils}
            className="creatureLayer"
            style={{
              opacity: format(plan.tendrilOpacity),
              transform: cssTransform([{ scale: plan.tendrilScale }])
            }}
          />
          <CreatureImage
            asset={layers.core}
            className="creatureLayer creatureCore"
            style={{
              opacity: format(plan.coreOpacity),
              transform: cssTransform(plan.coreTransform)
            }}
          />
          <SurfaceLayers surfaceMode={model.phenotype.surface.mode} />
          <SensoryNodes nodes={plan.sensoryNodes} />
          {model.showMoustache ? <Moustache /> : null}
        </div>
      </div>
      <figcaption>ORGANISM #000000</figcaption>
    </figure>
  );
}

function SurfaceLayers({ surfaceMode }: { surfaceMode: SurfaceMode }) {
  const internal = (
    <CreatureImage
      asset={layers.surface}
      className="creatureLayer surfaceFilaments"
      style={{
        opacity: format(plan.internalFilamentOpacity),
        transform: cssTransform(plan.internalFilamentTransform)
      }}
    />
  );

  if (surfaceMode === "mirror-x") {
    return (
      <>
        {internal}
        <CreatureImage
          asset={layers.surface}
          className="creatureLayer creatureSurface"
          style={{
            opacity: format(plan.surfaceOpacity),
            transform: cssTransform([{ scaleX: -1 }])
          }}
        />
      </>
    );
  }

  if (surfaceMode === "ghost-double") {
    return (
      <>
        {internal}
        <CreatureImage
          asset={layers.surface}
          className="creatureLayer creatureSurface"
          style={{ opacity: format(plan.surfaceOpacity * 0.86) }}
        />
        <CreatureImage
          asset={layers.surface}
          className="creatureLayer creatureSurface"
          style={{
            opacity: format(plan.surfaceOpacity * 0.12),
            transform: cssTransform([
              { translateX: plan.size * 0.004 },
              { translateY: -plan.size * 0.003 },
              { scale: 1.004 }
            ])
          }}
        />
      </>
    );
  }

  if (surfaceMode === "radial-echo") {
    return (
      <>
        {internal}
        {[-1, 0, 1].map((turn) => (
          <CreatureImage
            key={turn}
            asset={layers.surface}
            className="creatureLayer creatureSurface"
            style={{
              opacity: format(plan.surfaceOpacity * (turn === 0 ? 0.84 : 0.08)),
              transform: cssTransform([
                { rotate: turn * 0.026 },
                { scale: turn === 0 ? 1 : 1.003 }
              ])
            }}
          />
        ))}
      </>
    );
  }

  return (
    <>
      {internal}
      <CreatureImage
        asset={layers.surface}
        className="creatureLayer creatureSurface"
        style={{ opacity: format(plan.surfaceOpacity) }}
      />
    </>
  );
}

function SensoryNodes({ nodes }: { nodes: SensoryNodeRenderPlan[] }) {
  return (
    <div className="sensoryNodes" aria-hidden="true">
      {nodes.map((node, index) => {
        const radius = (node.radius / plan.size) * 100;

        return (
          <span
            key={`sensory-node-${index}`}
            style={{
              "--node-color": model.colorPlan.nodeColor,
              "--node-opacity": format(node.opacity),
              "--node-size": `${format(radius * 2)}%`,
              left: `${format((node.x / plan.size) * 100)}%`,
              top: `${format((node.y / plan.size) * 100)}%`
            } as CSSProperties}
          />
        );
      })}
    </div>
  );
}

function Moustache() {
  const width = plan.moustache.width;
  const height = width * (moustache.height / moustache.width);

  return (
    <CreatureImage
      asset={moustache}
      className="creatureMoustache"
      style={{
        height: `${format((height / plan.size) * 100)}%`,
        left: `${format(((plan.moustache.centerX - width * 0.5) / plan.size) * 100)}%`,
        opacity: "0.92",
        top: `${format(((plan.moustache.centerY - height * 0.5) / plan.size) * 100)}%`,
        transform: cssTransform([{ rotate: plan.moustache.rotation }]),
        width: `${format((width / plan.size) * 100)}%`
      }}
    />
  );
}

function CreatureImage({
  asset,
  className,
  style
}: {
  asset: WebImageAsset;
  className: string;
  style?: CSSProperties;
}) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className={className}
      decoding="async"
      draggable={false}
      height={asset.height}
      src={asset.src}
      style={style}
      width={asset.width}
    />
  );
}

function cssTransform(transforms: OrganismRenderTransform[]) {
  return transforms.map(cssTransformPart).join(" ");
}

function cssTransformPart(transform: OrganismRenderTransform) {
  if ("translateX" in transform) {
    return `translateX(${format((transform.translateX / plan.size) * 100)}%)`;
  }
  if ("translateY" in transform) {
    return `translateY(${format((transform.translateY / plan.size) * 100)}%)`;
  }
  if ("scale" in transform) {
    return `scale(${format(transform.scale)})`;
  }
  if ("scaleX" in transform) {
    return `scaleX(${format(transform.scaleX)})`;
  }
  if ("scaleY" in transform) {
    return `scaleY(${format(transform.scaleY)})`;
  }

  return `rotate(${format((transform.rotate * 180) / Math.PI)}deg)`;
}

function format(value: number | string) {
  if (typeof value === "string") {
    return value;
  }

  if (Math.abs(value) < 0.000001) {
    return "0";
  }

  return Number(value.toFixed(5)).toString();
}
