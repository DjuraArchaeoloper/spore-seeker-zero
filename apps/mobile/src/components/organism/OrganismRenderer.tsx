import { type ReactElement, useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  StyleSheet,
  type StyleProp,
  type ViewStyle
} from "react-native";
import {
  Blur,
  BlurMask,
  Canvas,
  Circle,
  ColorMatrix,
  drawAsPicture,
  Group,
  Image,
  Skia,
  useImage,
  vec,
  type SkImage,
  type Transforms3d
} from "@shopify/react-native-skia";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";
import {
  createOrganismColorPlan,
  createOrganismRenderCacheKey,
  createOrganismRenderPlan,
  createPresenceGlowPlan,
  genomeToHex,
  phenotypeFromGenome,
  validateGenomeBytes,
  type GenomeInput,
  type OrganismPoint,
  type OrganismRenderPlan,
  type OrganismRenderTransform,
  type SensoryNodeRenderPlan
} from "@spore/shared";

import {
  ORGANISM_RUNTIME_CANVAS,
  SPORE_CREATURE_FAMILIES,
  SPORE_MOUSTACHE_ASSET,
  type CreatureLayerAssets
} from "../../../assets/organisms/registry";
import { SHOW_MOUSTACHE } from "../../config/organism";

type OrganismRendererProps = {
  genome: GenomeInput;
  size?: number;
  animated?: boolean;
  onStillImageReady?: () => void;
  style?: StyleProp<ViewStyle>;
};

type CreatureImages = Record<keyof CreatureLayerAssets, SkImage | null>;
type LoadedCreatureImages = Record<keyof CreatureLayerAssets, SkImage>;
type SkiaTransform = Transforms3d;
type RenderPlan = OrganismRenderPlan;

const TWO_PI = Math.PI * 2;
const IDLE_DRIFT_X_AMPLITUDE_MULTIPLIER = 1.0;
const IDLE_DRIFT_Y_AMPLITUDE_MULTIPLIER = 1.5;
const IDLE_DRIFT_X_PERIOD_MULTIPLIER = 1.18;
const IDLE_DRIFT_Y_PERIOD_MULTIPLIER = 1.07;
const IDLE_BREATH_PERIOD_MULTIPLIER = 1.42;
const IDLE_SWAY_PERIOD_MULTIPLIER = 1.31;
const IDLE_DRIFT_X_PHASE = 0.17;
const IDLE_DRIFT_Y_PHASE = 0.41;
const IDLE_BREATH_PHASE = 0.29;
const IDLE_SWAY_PHASE = 0.63;
const IDLE_BREATH_SCALE_X_MULTIPLIER = 0.86;
const IDLE_BREATH_SCALE_MIN_AMPLITUDE = 0.005;
const IDLE_BREATH_SCALE_MAX_AMPLITUDE = 0.01;
const IDLE_SWAY_MIN_DEG = 0.5;
const IDLE_SWAY_MAX_DEG = 0.8;
const IDLE_OPACITY_BASE = 0.996;
const IDLE_OPACITY_LIFT = 0.004;
const MOTION_PULSE_MIN_AMPLITUDE = 0.006;
const MOTION_PULSE_RANGE = 0.024;
const FLATTENED_CREATURE_ART_WIDTH = ORGANISM_RUNTIME_CANVAS.width;
const FLATTENED_CREATURE_ART_HEIGHT = ORGANISM_RUNTIME_CANVAS.height;
const FLATTENED_CREATURE_CACHE_MAX = 12;

const flattenedCreatureImageCache = new Map<string, SkImage>();
const flattenedCreatureCompositionQueue = new Map<string, Promise<SkImage | null>>();

export function OrganismRenderer(props: OrganismRendererProps) {
  return SHOW_MOUSTACHE ? (
    <OrganismRendererWithMoustache {...props} />
  ) : (
    <OrganismRendererCore {...props} includeMoustache={false} moustacheImage={null} />
  );
}

function OrganismRendererWithMoustache(props: OrganismRendererProps) {
  const moustacheImage = useImage(SPORE_MOUSTACHE_ASSET);

  return <OrganismRendererCore {...props} includeMoustache moustacheImage={moustacheImage} />;
}

function OrganismRendererCore({
  animated = true,
  genome,
  onStillImageReady,
  size = 440,
  style,
  includeMoustache,
  moustacheImage
}: OrganismRendererProps & {
  includeMoustache: boolean;
  moustacheImage: SkImage | null;
}) {
  const rendererSize = sanitizeSize(size);
  const genomeKey = useMemo(() => normalizeGenomeKey(genome), [genome]);
  const phenotype = useMemo(() => phenotypeFromGenome(genomeKey), [genomeKey]);
  const family = phenotype.family;
  const familyDefinition = SPORE_CREATURE_FAMILIES[family];
  const images = useSelectedFamilyImages(familyDefinition.assets);
  const displayRenderPlan = useMemo(
    () => createOrganismRenderPlan(phenotype, familyDefinition, rendererSize),
    [phenotype, familyDefinition, rendererSize]
  );
  const artRenderPlan = useMemo(
    () => createOrganismRenderPlan(phenotype, familyDefinition, FLATTENED_CREATURE_ART_WIDTH),
    [phenotype, familyDefinition]
  );
  const {
    colorMatrix,
    coreMatrix,
    filamentMatrix,
    glowMatrix,
    nodeColor,
    surfaceMatrix
  } = useMemo(() => createOrganismColorPlan(phenotype), [phenotype]);
  const cacheKey = useMemo(() => createOrganismRenderCacheKey(genomeKey), [genomeKey]);
  const flattenedImage = useFlattenedOrganismImage({
    artRenderPlan,
    cacheKey,
    colorMatrix,
    coreMatrix,
    filamentMatrix,
    glowMatrix,
    images,
    includeMoustache,
    moustacheImage,
    nodeColor,
    surfaceMatrix
  });
  const reduceMotion = useReduceMotion();
  const motionEnabled = animated && !reduceMotion;
  const driftXPhase = useSharedValue(IDLE_DRIFT_X_PHASE);
  const driftYPhase = useSharedValue(IDLE_DRIFT_Y_PHASE);
  const breathPhase = useSharedValue(IDLE_BREATH_PHASE);
  const swayPhase = useSharedValue(IDLE_SWAY_PHASE);
  const { rootFloatPx, rootSwayRad } = displayRenderPlan;
  const pulseScaleAmplitude = phenotype.motion.pulseScaleAmplitude;
  const motionIntensity = clamp(
    (pulseScaleAmplitude - MOTION_PULSE_MIN_AMPLITUDE) / MOTION_PULSE_RANGE,
    0,
    1
  );
  const breathScaleAmplitude =
    IDLE_BREATH_SCALE_MIN_AMPLITUDE +
    (IDLE_BREATH_SCALE_MAX_AMPLITUDE - IDLE_BREATH_SCALE_MIN_AMPLITUDE) * motionIntensity;
  const swayAmplitudeRad = degToRad(
    IDLE_SWAY_MIN_DEG + (IDLE_SWAY_MAX_DEG - IDLE_SWAY_MIN_DEG) * motionIntensity
  );

  useEffect(() => {
    if (flattenedImage) {
      onStillImageReady?.();
    }
  }, [flattenedImage, onStillImageReady]);

  useEffect(() => {
    cancelAnimation(driftXPhase);
    cancelAnimation(driftYPhase);
    cancelAnimation(breathPhase);
    cancelAnimation(swayPhase);

    if (!motionEnabled) {
      driftXPhase.value = IDLE_DRIFT_X_PHASE;
      driftYPhase.value = IDLE_DRIFT_Y_PHASE;
      breathPhase.value = IDLE_BREATH_PHASE;
      swayPhase.value = IDLE_SWAY_PHASE;
      return;
    }

    driftXPhase.value = IDLE_DRIFT_X_PHASE;
    driftYPhase.value = IDLE_DRIFT_Y_PHASE;
    breathPhase.value = IDLE_BREATH_PHASE;
    swayPhase.value = IDLE_SWAY_PHASE;
    driftXPhase.value = createIdlePhaseLoop(
      IDLE_DRIFT_X_PHASE,
      phenotype.motion.periodMs * IDLE_DRIFT_X_PERIOD_MULTIPLIER
    );
    driftYPhase.value = createIdlePhaseLoop(
      IDLE_DRIFT_Y_PHASE,
      phenotype.motion.periodMs * IDLE_DRIFT_Y_PERIOD_MULTIPLIER
    );
    breathPhase.value = createIdlePhaseLoop(
      IDLE_BREATH_PHASE,
      phenotype.motion.periodMs * IDLE_BREATH_PERIOD_MULTIPLIER
    );
    swayPhase.value = createIdlePhaseLoop(
      IDLE_SWAY_PHASE,
      phenotype.motion.periodMs * IDLE_SWAY_PERIOD_MULTIPLIER
    );

    return () => {
      cancelAnimation(driftXPhase);
      cancelAnimation(driftYPhase);
      cancelAnimation(breathPhase);
      cancelAnimation(swayPhase);
    };
  }, [breathPhase, driftXPhase, driftYPhase, motionEnabled, phenotype.motion.periodMs, swayPhase]);

  const organismMotion = useAnimatedStyle(() => {
    const driftXWave = motionEnabled ? Math.sin(driftXPhase.value * TWO_PI) : 0;
    const driftYWave = motionEnabled ? Math.sin(driftYPhase.value * TWO_PI) : 0;
    const breathWave = motionEnabled ? Math.sin(breathPhase.value * TWO_PI) : 0;
    const swayWave = motionEnabled ? Math.sin(swayPhase.value * TWO_PI) : 0;
    const breathScaleX = 1 + breathWave * breathScaleAmplitude * IDLE_BREATH_SCALE_X_MULTIPLIER;
    const breathScaleY = 1 + breathWave * breathScaleAmplitude;

    return {
      opacity: IDLE_OPACITY_BASE + Math.max(0, breathWave) * IDLE_OPACITY_LIFT,
      transform: [
        { translateX: driftXWave * rootFloatPx * IDLE_DRIFT_X_AMPLITUDE_MULTIPLIER },
        { translateY: driftYWave * rootFloatPx * IDLE_DRIFT_Y_AMPLITUDE_MULTIPLIER },
        { rotate: `${swayWave * Math.min(rootSwayRad, swayAmplitudeRad)}rad` },
        { scaleX: breathScaleX },
        { scaleY: breathScaleY }
      ]
    };
  }, [breathScaleAmplitude, motionEnabled, rootFloatPx, rootSwayRad, swayAmplitudeRad]);

  return (
    <Animated.View
      style={[
        {
          height: rendererSize,
          width: rendererSize
        },
        organismMotion,
        style
      ]}
    >
      {flattenedImage ? (
        <Canvas
          style={[
            styles.canvas,
            {
              height: rendererSize,
              width: rendererSize
            }
          ]}
        >
          <PresenceGlow size={rendererSize} />
          <Image fit="fill" height={rendererSize} image={flattenedImage} width={rendererSize} x={0} y={0} />
        </Canvas>
      ) : null}
    </Animated.View>
  );
}

function FlattenedOrganismComposite({
  colorMatrix,
  coreMatrix,
  filamentMatrix,
  glowMatrix,
  images,
  includeMoustache,
  moustacheImage,
  nodeColor,
  plan,
  surfaceMatrix
}: {
  colorMatrix: number[];
  coreMatrix: number[];
  filamentMatrix: number[];
  glowMatrix: number[];
  images: LoadedCreatureImages;
  includeMoustache: boolean;
  moustacheImage: SkImage | null;
  nodeColor: string;
  plan: RenderPlan;
  surfaceMatrix: number[];
}) {
  return (
    <Group origin={toSkiaPoint(plan.center)} transform={toSkiaTransforms(plan.biologicalTransform)}>
      <ImageLayer
        blendMode="screen"
        blur={plan.haloBlur}
        image={images.glow}
        matrix={glowMatrix}
        opacity={plan.haloOpacity}
        origin={plan.center}
        size={FLATTENED_CREATURE_ART_WIDTH}
        transform={plan.haloTransform}
      />
      <ImageLayer
        blendMode="screen"
        image={images.glow}
        matrix={glowMatrix}
        opacity={plan.glowOpacity}
        origin={plan.center}
        size={FLATTENED_CREATURE_ART_WIDTH}
        transform={plan.glowTransform}
      />
      <BaseAnatomyLayer
        bodyImage={images.body}
        colorMatrix={colorMatrix}
        finAccentTransform={createStaticFinAccentTransform(plan)}
        finsImage={images.fins}
        plan={plan}
        size={FLATTENED_CREATURE_ART_WIDTH}
      />
      <ImageLayer
        image={images.tendrils}
        matrix={colorMatrix}
        opacity={plan.tendrilOpacity}
        origin={plan.center}
        size={FLATTENED_CREATURE_ART_WIDTH}
        transform={plan.tendrilTransform}
      />
      <ImageLayer
        blendMode="screen"
        image={images.core}
        matrix={coreMatrix}
        opacity={plan.coreOpacity}
        origin={plan.center}
        size={FLATTENED_CREATURE_ART_WIDTH}
        transform={plan.coreTransform}
      />
      <SurfaceLayer
        image={images.surface}
        filamentMatrix={filamentMatrix}
        plan={plan}
        size={FLATTENED_CREATURE_ART_WIDTH}
        surfaceMatrix={surfaceMatrix}
      />
      <SensoryNodes color={nodeColor} nodes={plan.sensoryNodes} />
      {includeMoustache ? <Moustache image={moustacheImage} plan={plan} /> : null}
    </Group>
  );
}

function useFlattenedOrganismImage({
  artRenderPlan,
  cacheKey,
  colorMatrix,
  coreMatrix,
  filamentMatrix,
  glowMatrix,
  images,
  includeMoustache,
  moustacheImage,
  nodeColor,
  surfaceMatrix
}: {
  artRenderPlan: RenderPlan;
  cacheKey: string;
  colorMatrix: number[];
  coreMatrix: number[];
  filamentMatrix: number[];
  glowMatrix: number[];
  images: CreatureImages;
  includeMoustache: boolean;
  moustacheImage: SkImage | null;
  nodeColor: string;
  surfaceMatrix: number[];
}) {
  const [entry, setEntry] = useState<{ cacheKey: string; image: SkImage } | null>(() => {
    const cachedImage = getFlattenedCreatureFromCache(cacheKey);

    return cachedImage ? { cacheKey, image: cachedImage } : null;
  });

  useEffect(() => {
    let cancelled = false;
    const cachedImage = getFlattenedCreatureFromCache(cacheKey);

    if (cachedImage) {
      setEntry({ cacheKey, image: cachedImage });
      return () => {
        cancelled = true;
      };
    }

    const loadedImages = getLoadedCreatureImages(images);

    if (!loadedImages || (includeMoustache && !moustacheImage)) {
      setEntry((current) => (current?.cacheKey === cacheKey ? null : current));
      return () => {
        cancelled = true;
      };
    }

    setEntry((current) => (current?.cacheKey === cacheKey ? current : null));

    const compositeElement = (
      <FlattenedOrganismComposite
        colorMatrix={colorMatrix}
        coreMatrix={coreMatrix}
        filamentMatrix={filamentMatrix}
        glowMatrix={glowMatrix}
        images={loadedImages}
        includeMoustache={includeMoustache}
        moustacheImage={moustacheImage}
        nodeColor={nodeColor}
        plan={artRenderPlan}
        surfaceMatrix={surfaceMatrix}
      />
    );

    void composeFlattenedCreature(cacheKey, compositeElement)
      .then((image) => {
        if (cancelled || !image) {
          return;
        }

        cacheFlattenedCreature(cacheKey, image);
        setEntry({ cacheKey, image });
      })
      .catch(() => {
        if (!cancelled) {
          setEntry((current) => (current?.cacheKey === cacheKey ? null : current));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    artRenderPlan,
    cacheKey,
    colorMatrix,
    coreMatrix,
    filamentMatrix,
    glowMatrix,
    images.body,
    images.core,
    images.fins,
    images.glow,
    images.surface,
    images.tendrils,
    includeMoustache,
    moustacheImage,
    nodeColor,
    surfaceMatrix
  ]);

  return entry?.cacheKey === cacheKey ? entry.image : null;
}

async function renderFlattenedOrganismImage(element: ReactElement) {
  const bounds = Skia.XYWHRect(
    0,
    0,
    FLATTENED_CREATURE_ART_WIDTH,
    FLATTENED_CREATURE_ART_HEIGHT
  );
  const picture = await drawAsPicture(element, bounds);
  const surface = Skia.Surface.MakeOffscreen(
    FLATTENED_CREATURE_ART_WIDTH,
    FLATTENED_CREATURE_ART_HEIGHT
  );

  if (!surface) {
    picture.dispose();
    return null;
  }

  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color("transparent"));
  canvas.drawPicture(picture);
  surface.flush();
  picture.dispose();

  const snapshot = surface.makeImageSnapshot(bounds);

  return snapshot.makeNonTextureImage() ?? snapshot;
}

function getLoadedCreatureImages(images: CreatureImages): LoadedCreatureImages | null {
  const { body, core, fins, glow, surface, tendrils } = images;

  if (!body || !core || !fins || !glow || !surface || !tendrils) {
    return null;
  }

  return {
    body,
    core,
    fins,
    glow,
    surface,
    tendrils
  };
}

function createStaticFinAccentTransform(plan: RenderPlan): OrganismRenderTransform[] {
  return [
    { scaleX: plan.finAccentScaleX },
    { scaleY: plan.finAccentScaleY },
    { rotate: plan.finAccentRotation }
  ];
}

function getFlattenedCreatureFromCache(cacheKey: string) {
  const image = flattenedCreatureImageCache.get(cacheKey) ?? null;

  if (!image) {
    return null;
  }

  flattenedCreatureImageCache.delete(cacheKey);
  flattenedCreatureImageCache.set(cacheKey, image);

  return image;
}

function cacheFlattenedCreature(cacheKey: string, image: SkImage) {
  if (flattenedCreatureImageCache.has(cacheKey)) {
    flattenedCreatureImageCache.delete(cacheKey);
  }

  flattenedCreatureImageCache.set(cacheKey, image);

  while (flattenedCreatureImageCache.size > FLATTENED_CREATURE_CACHE_MAX) {
    const oldestKey = flattenedCreatureImageCache.keys().next().value;

    if (!oldestKey) {
      return;
    }

    flattenedCreatureImageCache.delete(oldestKey);
  }
}

function composeFlattenedCreature(cacheKey: string, element: ReactElement) {
  const existingPromise = flattenedCreatureCompositionQueue.get(cacheKey);

  if (existingPromise) {
    return existingPromise;
  }

  const compositionPromise = renderFlattenedOrganismImage(element).finally(() => {
    flattenedCreatureCompositionQueue.delete(cacheKey);
  });

  flattenedCreatureCompositionQueue.set(cacheKey, compositionPromise);

  return compositionPromise;
}

function createIdlePhaseLoop(startPhase: number, durationMs: number) {
  const duration = Number.isFinite(durationMs) ? Math.max(1, Math.round(durationMs)) : 3000;

  return withRepeat(
    withSequence(
      withTiming(startPhase + 1, {
        duration,
        easing: Easing.linear
      }),
      withTiming(startPhase, {
        duration: 1,
        easing: Easing.linear
      })
    ),
    -1
  );
}

function PresenceGlow({ size }: { size: number }) {
  const plan = useMemo(() => createPresenceGlowPlan(size), [size]);
  const center = toSkiaPoint(plan.center);

  return (
    <>
      <Group
        origin={center}
        transform={toSkiaTransforms(plan.atmosphere.transform)}
      >
        <Circle
          color={plan.atmosphere.color}
          cx={plan.atmosphere.cx}
          cy={plan.atmosphere.cy}
          r={plan.atmosphere.radius}
        >
          <BlurMask blur={plan.atmosphere.blur} style="normal" />
        </Circle>
      </Group>
      <Group origin={center} transform={toSkiaTransforms(plan.core.transform)}>
        <Circle
          color={plan.core.color}
          cx={plan.core.cx}
          cy={plan.core.cy}
          r={plan.core.radius}
        >
          <BlurMask blur={plan.core.blur} style="normal" />
        </Circle>
      </Group>
    </>
  );
}

function BaseAnatomyLayer({
  bodyImage,
  colorMatrix,
  finAccentTransform,
  finsImage,
  plan,
  size
}: {
  bodyImage: SkImage | null;
  colorMatrix: number[];
  finAccentTransform: OrganismRenderTransform[];
  finsImage: SkImage | null;
  plan: RenderPlan;
  size: number;
}) {
  if (!bodyImage && !finsImage) {
    return null;
  }

  return (
    <Group opacity={plan.baseAnatomyOpacity}>
      <ColorMatrix matrix={colorMatrix} />
      {finsImage ? (
        <Group origin={toSkiaPoint(plan.center)} transform={toSkiaTransforms(plan.finTransform)}>
          <Image fit="fill" height={size} image={finsImage} width={size} x={0} y={0} />
        </Group>
      ) : null}
      {finsImage && plan.finAccentOpacity > 0 ? (
        <Group
          opacity={plan.finAccentOpacity}
          origin={toSkiaPoint(plan.center)}
          transform={toSkiaTransforms([...plan.finTransform, ...finAccentTransform])}
        >
          <Image fit="fill" height={size} image={finsImage} width={size} x={0} y={0} />
        </Group>
      ) : null}
      {bodyImage ? (
        <Group origin={toSkiaPoint(plan.center)} transform={toSkiaTransforms(plan.bodyTransform)}>
          <Image fit="fill" height={size} image={bodyImage} width={size} x={0} y={0} />
        </Group>
      ) : null}
    </Group>
  );
}

function SurfaceLayer({
  filamentMatrix,
  image,
  plan,
  size,
  surfaceMatrix
}: {
  filamentMatrix: number[];
  image: SkImage | null;
  plan: RenderPlan;
  size: number;
  surfaceMatrix: number[];
}) {
  if (!image) {
    return null;
  }

  return (
    <>
      <ImageLayer
        blendMode="screen"
        image={image}
        matrix={filamentMatrix}
        opacity={plan.internalFilamentOpacity}
        origin={plan.center}
        size={size}
        transform={plan.internalFilamentTransform}
      />
      {plan.surfaceLayers.map((layer, index) => (
        <ImageLayer
          key={`surface-layer-${index}`}
          image={image}
          matrix={surfaceMatrix}
          opacity={layer.opacity}
          origin={plan.center}
          size={size}
          transform={layer.transform}
        />
      ))}
    </>
  );
}

function SensoryNodes({ color, nodes }: { color: string; nodes: SensoryNodeRenderPlan[] }) {
  return (
    <>
      {nodes.map((node, index) => (
        <Group key={`sensory-node-${index}`}>
          <Circle cx={node.x} cy={node.y} r={node.radius * 1.65} color={color} opacity={node.opacity * 0.08}>
            <BlurMask blur={node.radius * 0.75} style="normal" />
          </Circle>
          <Circle cx={node.x} cy={node.y} r={node.radius} color={color} opacity={node.opacity} />
        </Group>
      ))}
    </>
  );
}

function Moustache({ image, plan }: { image: SkImage | null; plan: RenderPlan }) {
  if (!image) {
    return null;
  }

  const sourceWidth = image.width();
  const sourceHeight = image.height();
  const width = plan.moustache.width;
  const height = sourceWidth > 0 ? width * (sourceHeight / sourceWidth) : width * 0.35;
  const x = plan.moustache.centerX - width * 0.5;
  const y = plan.moustache.centerY - height * 0.5;

  return (
    <Group
      opacity={0.92}
      origin={vec(plan.moustache.centerX, plan.moustache.centerY)}
      transform={[{ rotate: plan.moustache.rotation }]}
    >
      <Image fit="fill" height={height} image={image} width={width} x={x} y={y} />
    </Group>
  );
}

function ImageLayer({
  blendMode,
  blur,
  image,
  matrix,
  opacity,
  origin,
  size,
  transform
}: {
  blendMode?: "screen" | "srcOver";
  blur?: number;
  image: SkImage | null;
  matrix?: number[];
  opacity: number;
  origin?: OrganismPoint | ReturnType<typeof vec>;
  size: number;
  transform?: OrganismRenderTransform[] | SkiaTransform;
}) {
  const clampedOpacity = clamp(opacity, 0, 1);

  if (!image || clampedOpacity <= 0) {
    return null;
  }

  return (
    <Group
      blendMode={blendMode}
      opacity={clampedOpacity}
      origin={toSkiaOrigin(origin)}
      transform={transform ? toSkiaTransforms(transform) : undefined}
    >
      {blur && blur > 0 ? <Blur blur={blur} mode="decal" /> : null}
      {matrix ? <ColorMatrix matrix={matrix} /> : null}
      <Image fit="fill" height={size} image={image} width={size} x={0} y={0} />
    </Group>
  );
}

function toSkiaPoint(point: OrganismPoint) {
  return vec(point.x, point.y);
}

function toSkiaOrigin(origin: OrganismPoint | ReturnType<typeof vec> | undefined) {
  if (!origin) {
    return undefined;
  }

  return "x" in origin && "y" in origin ? vec(origin.x, origin.y) : origin;
}

function toSkiaTransforms(transform: OrganismRenderTransform[] | SkiaTransform): Transforms3d {
  return transform as Transforms3d;
}

function useSelectedFamilyImages(assets: CreatureLayerAssets): CreatureImages {
  return {
    body: useImage(assets.body),
    fins: useImage(assets.fins),
    core: useImage(assets.core),
    tendrils: useImage(assets.tendrils),
    surface: useImage(assets.surface),
    glow: useImage(assets.glow)
  };
}

function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) {
        setReduceMotion(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}

function normalizeGenomeKey(genome: GenomeInput) {
  return typeof genome === "string" ? genome.toLowerCase() : genomeToHex(validateGenomeBytes(genome));
}

function sanitizeSize(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 320;
  }

  return clamp(value, 160, 640);
}

function degToRad(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const styles = StyleSheet.create({
  canvas: {
    backgroundColor: "transparent"
  }
});
