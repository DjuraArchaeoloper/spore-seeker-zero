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
  genomeToHex,
  phenotypeFromGenome,
  validateGenomeBytes,
  type GenomeInput,
  type OrganismPhenotype
} from "@spore/shared";

import {
  ORGANISM_RUNTIME_CANVAS,
  SPORE_CREATURE_FAMILIES,
  SPORE_MOUSTACHE_ASSET,
  type CreatureFamilyDefinition,
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

type SensoryNode = {
  x: number;
  y: number;
  radius: number;
  opacity: number;
};

type RenderPlan = {
  center: ReturnType<typeof vec>;
  biologicalTransform: Transforms3d;
  baseAnatomyOpacity: number;
  finAccentOpacity: number;
  finAccentScaleX: number;
  finAccentScaleY: number;
  finAccentRotation: number;
  glowTransform: Transforms3d;
  haloTransform: Transforms3d;
  tendrilOpacity: number;
  tendrilScale: number;
  rootFloatPx: number;
  rootSwayRad: number;
  coreTransform: Transforms3d;
  coreOpacity: number;
  surfaceOpacity: number;
  internalFilamentOpacity: number;
  internalFilamentTransform: Transforms3d;
  haloBlur: number;
  haloOpacity: number;
  glowOpacity: number;
  sensoryNodes: SensoryNode[];
  moustache: {
    centerX: number;
    centerY: number;
    width: number;
    rotation: number;
  };
};

const TWO_PI = Math.PI * 2;
const ART_FRAME_SCALE = 0.88;
const ART_FRAME_Y_OFFSET_RATIO = -0.034;
const FIN_ACCENT_TRANSFORM_MULTIPLIER = 0.16;
const HALO_BLUR_MULTIPLIER = 0.28;
const HALO_OPACITY_MULTIPLIER = 0.24;
const GLOW_OPACITY_MULTIPLIER = 0.46;
const INTERNAL_FILAMENT_OPACITY_MULTIPLIER = 0.22;
const MOUSTACHE_VISUAL_SCALE = 0.75;
const ROOT_FLOAT_BASE_PX_AT_1024 = 4;
const ROOT_FLOAT_MOTION_PX_MULTIPLIER = 0.34;
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
const PRESENCE_GLOW_CENTER_Y_RATIO = 0.48;
const PRESENCE_GLOW_CORE_RADIUS_RATIO = 0.28;
const PRESENCE_GLOW_CORE_BLUR_RATIO = 0.11;
const PRESENCE_GLOW_CORE_SCALE_Y = 1.26;
const PRESENCE_GLOW_ATMOSPHERE_RADIUS_RATIO = 0.42;
const PRESENCE_GLOW_ATMOSPHERE_BLUR_RATIO = 0.18;
const PRESENCE_GLOW_ATMOSPHERE_SCALE_X = 0.92;
const PRESENCE_GLOW_ATMOSPHERE_SCALE_Y = 0.88;
const PRESENCE_GLOW_CORE_COLOR = "rgba(134, 224, 255, 0.24)";
const PRESENCE_GLOW_ATMOSPHERE_COLOR = "rgba(177, 154, 255, 0.105)";
const FLATTENED_CREATURE_ART_REVISION = "flattened-organism-v3-family-map-v2";
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
    () => createRenderPlan(phenotype, familyDefinition, rendererSize),
    [phenotype, familyDefinition, rendererSize]
  );
  const artRenderPlan = useMemo(
    () => createRenderPlan(phenotype, familyDefinition, FLATTENED_CREATURE_ART_WIDTH),
    [phenotype, familyDefinition]
  );
  const colorMatrix = useMemo(
    () => createHueSaturationMatrix(phenotype.pigment.hueShiftDeg, phenotype.pigment.saturation),
    [phenotype.pigment.hueShiftDeg, phenotype.pigment.saturation]
  );
  const glowMatrix = useMemo(
    () =>
      multiplyColorMatrices(
        createBrightnessMatrix(1.04 + (phenotype.bioluminescence.coreBrightness - 1) * 0.28),
        colorMatrix
      ),
    [colorMatrix, phenotype.bioluminescence.coreBrightness]
  );
  const coreMatrix = useMemo(
    () => multiplyColorMatrices(createBrightnessMatrix(phenotype.bioluminescence.coreBrightness), colorMatrix),
    [colorMatrix, phenotype.bioluminescence.coreBrightness]
  );
  const surfaceMatrix = useMemo(
    () => multiplyColorMatrices(createContrastMatrix(phenotype.surface.contrast), colorMatrix),
    [colorMatrix, phenotype.surface.contrast]
  );
  const filamentMatrix = useMemo(
    () =>
      multiplyColorMatrices(
        createHueSaturationMatrix(
          phenotype.pigment.hueShiftDeg + phenotype.internalFilaments.hueOffsetDeg,
          phenotype.pigment.saturation
        ),
        createContrastMatrix(0.94)
      ),
    [
      phenotype.internalFilaments.hueOffsetDeg,
      phenotype.pigment.hueShiftDeg,
      phenotype.pigment.saturation
    ]
  );
  const nodeColor = hslToRgba(205 + phenotype.pigment.hueShiftDeg * 0.45, 0.74, 0.72, 1);
  const cacheKey = useMemo(() => createFlattenedCreatureCacheKey(genomeKey), [genomeKey]);
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
    surfaceMatrix,
    surfaceMode: phenotype.surface.mode
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
  surfaceMatrix,
  surfaceMode
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
  surfaceMode: OrganismPhenotype["surface"]["mode"];
}) {
  return (
    <Group origin={plan.center} transform={plan.biologicalTransform}>
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
        transform={[{ scale: plan.tendrilScale }]}
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
        surfaceMode={surfaceMode}
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
  surfaceMatrix,
  surfaceMode
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
  surfaceMode: OrganismPhenotype["surface"]["mode"];
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
        surfaceMode={surfaceMode}
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
    surfaceMatrix,
    surfaceMode
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

function createStaticFinAccentTransform(plan: RenderPlan): Transforms3d {
  return [
    { scaleX: plan.finAccentScaleX },
    { scaleY: plan.finAccentScaleY },
    { rotate: plan.finAccentRotation }
  ];
}

function createFlattenedCreatureCacheKey(normalizedGenome: string) {
  return [
    `renderer=${FLATTENED_CREATURE_ART_REVISION}`,
    `genome=${normalizedGenome}`,
    `resolution=${FLATTENED_CREATURE_ART_WIDTH}x${FLATTENED_CREATURE_ART_HEIGHT}`,
    `moustache=${SHOW_MOUSTACHE ? "on" : "off"}`
  ].join("|");
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
  const center = vec(size * 0.5, size * 0.5);
  const glowCenterY = size * PRESENCE_GLOW_CENTER_Y_RATIO;

  return (
    <>
      <Group
        origin={center}
        transform={[
          { scaleX: PRESENCE_GLOW_ATMOSPHERE_SCALE_X },
          { scaleY: PRESENCE_GLOW_ATMOSPHERE_SCALE_Y }
        ]}
      >
        <Circle
          color={PRESENCE_GLOW_ATMOSPHERE_COLOR}
          cx={size * 0.5}
          cy={glowCenterY}
          r={size * PRESENCE_GLOW_ATMOSPHERE_RADIUS_RATIO}
        >
          <BlurMask blur={size * PRESENCE_GLOW_ATMOSPHERE_BLUR_RATIO} style="normal" />
        </Circle>
      </Group>
      <Group origin={center} transform={[{ scaleY: PRESENCE_GLOW_CORE_SCALE_Y }]}>
        <Circle
          color={PRESENCE_GLOW_CORE_COLOR}
          cx={size * 0.5}
          cy={glowCenterY}
          r={size * PRESENCE_GLOW_CORE_RADIUS_RATIO}
        >
          <BlurMask blur={size * PRESENCE_GLOW_CORE_BLUR_RATIO} style="normal" />
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
  finAccentTransform: SkiaTransform;
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
      {finsImage ? <Image fit="fill" height={size} image={finsImage} width={size} x={0} y={0} /> : null}
      {finsImage && plan.finAccentOpacity > 0 ? (
        <Group opacity={plan.finAccentOpacity} origin={plan.center} transform={finAccentTransform}>
          <Image fit="fill" height={size} image={finsImage} width={size} x={0} y={0} />
        </Group>
      ) : null}
      {bodyImage ? <Image fit="fill" height={size} image={bodyImage} width={size} x={0} y={0} /> : null}
    </Group>
  );
}

function SurfaceLayer({
  filamentMatrix,
  image,
  plan,
  size,
  surfaceMatrix,
  surfaceMode
}: {
  filamentMatrix: number[];
  image: SkImage | null;
  plan: RenderPlan;
  size: number;
  surfaceMatrix: number[];
  surfaceMode: OrganismPhenotype["surface"]["mode"];
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
      {surfaceMode === "native" ? (
        <ImageLayer image={image} matrix={surfaceMatrix} opacity={plan.surfaceOpacity} size={size} />
      ) : null}
      {surfaceMode === "mirror-x" ? (
        <ImageLayer
          image={image}
          matrix={surfaceMatrix}
          opacity={plan.surfaceOpacity}
          origin={plan.center}
          size={size}
          transform={[{ scaleX: -1 }]}
        />
      ) : null}
      {surfaceMode === "ghost-double" ? (
        <>
          <ImageLayer image={image} matrix={surfaceMatrix} opacity={plan.surfaceOpacity * 0.86} size={size} />
          <ImageLayer
            image={image}
            matrix={surfaceMatrix}
            opacity={plan.surfaceOpacity * 0.12}
            origin={plan.center}
            size={size}
            transform={[
              { translateX: size * 0.004 },
              { translateY: -size * 0.003 },
              { scale: 1.004 }
            ]}
          />
        </>
      ) : null}
      {surfaceMode === "radial-echo" ? (
        <>
          {[-1, 0, 1].map((turn) => (
            <ImageLayer
              key={`surface-echo-${turn}`}
              image={image}
              matrix={surfaceMatrix}
              opacity={plan.surfaceOpacity * (turn === 0 ? 0.84 : 0.08)}
              origin={plan.center}
              size={size}
              transform={[
                { rotate: turn * 0.026 },
                { scale: turn === 0 ? 1 : 1.003 }
              ]}
            />
          ))}
        </>
      ) : null}
    </>
  );
}

function SensoryNodes({ color, nodes }: { color: string; nodes: SensoryNode[] }) {
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
  origin?: ReturnType<typeof vec>;
  size: number;
  transform?: SkiaTransform;
}) {
  const clampedOpacity = clamp(opacity, 0, 1);

  if (!image || clampedOpacity <= 0) {
    return null;
  }

  return (
    <Group
      blendMode={blendMode}
      opacity={clampedOpacity}
      origin={origin}
      transform={transform}
    >
      {blur && blur > 0 ? <Blur blur={blur} mode="decal" /> : null}
      {matrix ? <ColorMatrix matrix={matrix} /> : null}
      <Image fit="fill" height={size} image={image} width={size} x={0} y={0} />
    </Group>
  );
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

function createRenderPlan(
  phenotype: OrganismPhenotype,
  registration: CreatureFamilyDefinition,
  size: number
): RenderPlan {
  const scale = size / ORGANISM_RUNTIME_CANVAS.width;
  const center = vec(size * 0.5, size * 0.5);
  const biologicalScaleX = phenotype.body.formScaleX * phenotype.body.proportionScaleX;
  const biologicalScaleY = phenotype.body.formScaleY * phenotype.body.proportionScaleY;
  const appendageScale = phenotype.appendages.expressionScale;
  const finScaleX =
    phenotype.membrane.scaleX * phenotype.appendages.finScaleXMul * appendageScale;
  const finScaleY =
    phenotype.membrane.scaleY * phenotype.appendages.finScaleYMul * appendageScale;
  const sideRotation = phenotype.asymmetry.sideRotationDeg;
  const opposingRotation = phenotype.membrane.opposingRotationDeg;
  const primaryFinOpacity = phenotype.membrane.opacity * phenotype.appendages.finOpacityMul;
  const tendrilOpacity =
    phenotype.appendages.tendrilOpacityMul * phenotype.appendages.expressionTendrilOpacityMul;
  const moustache = registration.moustache;
  const sensoryNodes = registration.sensoryAnchors
    .slice(0, phenotype.sensoryNodes.count)
    .map(([x, y]) => ({
      x: x * size,
      y: y * size,
      radius: phenotype.sensoryNodes.radiusPxAt1024 * scale,
      opacity: phenotype.sensoryNodes.opacity
    }));

  return {
    center,
    biologicalTransform: [
      { translateY: size * ART_FRAME_Y_OFFSET_RATIO },
      { scale: ART_FRAME_SCALE },
      { scaleX: biologicalScaleX },
      { scaleY: biologicalScaleY }
    ],
    baseAnatomyOpacity: clamp((phenotype.body.opacity + phenotype.membrane.opacity) * 0.5, 0.58, 0.96),
    finAccentOpacity: clamp(primaryFinOpacity * 0.13, 0.04, 0.14),
    finAccentScaleX: 1 + (finScaleX - 1) * FIN_ACCENT_TRANSFORM_MULTIPLIER,
    finAccentScaleY: 1 + (finScaleY - 1) * FIN_ACCENT_TRANSFORM_MULTIPLIER,
    finAccentRotation: degToRad((opposingRotation + sideRotation) * FIN_ACCENT_TRANSFORM_MULTIPLIER),
    glowTransform: [{ scale: 1 + (phenotype.bioluminescence.glowScale - 1) * 0.48 }],
    haloTransform: [{ scale: 1 + (phenotype.halo.scale - 1) * 0.32 }],
    tendrilOpacity: clamp(tendrilOpacity, 0.08, 1),
    tendrilScale: appendageScale,
    rootFloatPx:
      (ROOT_FLOAT_BASE_PX_AT_1024 +
        phenotype.motion.tendrilDriftPxAt1024 * ROOT_FLOAT_MOTION_PX_MULTIPLIER) *
      scale,
    rootSwayRad: degToRad(0.45 + phenotype.motion.finWaveDeg * 0.26),
    coreTransform: [
      { translateX: phenotype.asymmetry.coreOffsetPxAt1024 * scale },
      { scaleX: phenotype.core.scaleX },
      { scaleY: phenotype.core.scaleY },
      { rotate: degToRad(phenotype.core.rotationDeg) }
    ],
    coreOpacity: phenotype.core.opacity,
    surfaceOpacity: phenotype.surface.opacity,
    internalFilamentOpacity: phenotype.internalFilaments.opacity * INTERNAL_FILAMENT_OPACITY_MULTIPLIER,
    internalFilamentTransform: [{ scale: phenotype.internalFilaments.scale }],
    haloBlur: phenotype.halo.blurPxAt1024 * scale * HALO_BLUR_MULTIPLIER,
    haloOpacity: phenotype.halo.opacity * HALO_OPACITY_MULTIPLIER,
    glowOpacity: phenotype.bioluminescence.glowOpacity * GLOW_OPACITY_MULTIPLIER,
    sensoryNodes,
    moustache: {
      centerX: moustache.center[0] * size,
      centerY: moustache.center[1] * size,
      width: moustache.width * size * MOUSTACHE_VISUAL_SCALE,
      rotation: degToRad(moustache.rotationDeg)
    }
  };
}

function createHueSaturationMatrix(hueShiftDeg: number, saturation: number) {
  return multiplyColorMatrices(createHueRotationMatrix(hueShiftDeg), createSaturationMatrix(saturation));
}

function createHueRotationMatrix(degrees: number) {
  const radians = degToRad(degrees);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const lumR = 0.213;
  const lumG = 0.715;
  const lumB = 0.072;

  return [
    lumR + cos * (1 - lumR) + sin * -lumR,
    lumG + cos * -lumG + sin * -lumG,
    lumB + cos * -lumB + sin * (1 - lumB),
    0,
    0,
    lumR + cos * -lumR + sin * 0.143,
    lumG + cos * (1 - lumG) + sin * 0.14,
    lumB + cos * -lumB + sin * -0.283,
    0,
    0,
    lumR + cos * -lumR + sin * -(1 - lumR),
    lumG + cos * -lumG + sin * lumG,
    lumB + cos * (1 - lumB) + sin * lumB,
    0,
    0,
    0,
    0,
    0,
    1,
    0
  ];
}

function createSaturationMatrix(saturation: number) {
  const s = clamp(saturation, 0, 2);
  const lumR = 0.213;
  const lumG = 0.715;
  const lumB = 0.072;

  return [
    lumR + (1 - lumR) * s,
    lumG - lumG * s,
    lumB - lumB * s,
    0,
    0,
    lumR - lumR * s,
    lumG + (1 - lumG) * s,
    lumB - lumB * s,
    0,
    0,
    lumR - lumR * s,
    lumG - lumG * s,
    lumB + (1 - lumB) * s,
    0,
    0,
    0,
    0,
    0,
    1,
    0
  ];
}

function createBrightnessMatrix(brightness: number) {
  const b = clamp(brightness, 0, 1.4);

  return [
    b,
    0,
    0,
    0,
    0,
    0,
    b,
    0,
    0,
    0,
    0,
    0,
    b,
    0,
    0,
    0,
    0,
    0,
    1,
    0
  ];
}

function createContrastMatrix(contrast: number) {
  const c = clamp(contrast, 0, 1.6);
  const offset = 0.5 * (1 - c);

  return [
    c,
    0,
    0,
    0,
    offset,
    0,
    c,
    0,
    0,
    offset,
    0,
    0,
    c,
    0,
    offset,
    0,
    0,
    0,
    1,
    0
  ];
}

function multiplyColorMatrices(outer: number[], inner: number[]) {
  const result = Array.from({ length: 20 }, () => 0);

  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const offset = col === 4 ? outer[row * 5 + 4] : 0;

      result[row * 5 + col] =
        outer[row * 5] * inner[col] +
        outer[row * 5 + 1] * inner[5 + col] +
        outer[row * 5 + 2] * inner[10 + col] +
        outer[row * 5 + 3] * inner[15 + col] +
        offset;
    }
  }

  return result;
}

function hslToRgba(hue: number, saturation: number, lightness: number, alpha: number) {
  const h = (((hue % 360) + 360) % 360) / 360;
  const s = clamp(saturation, 0, 1);
  const l = clamp(lightness, 0, 1);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const red = hueToRgb(p, q, h + 1 / 3);
  const green = hueToRgb(p, q, h);
  const blue = hueToRgb(p, q, h - 1 / 3);

  return `rgba(${Math.round(red * 255)}, ${Math.round(green * 255)}, ${Math.round(
    blue * 255
  )}, ${clamp(alpha, 0, 1).toFixed(3)})`;
}

function hueToRgb(p: number, q: number, t: number) {
  let localT = t;

  if (localT < 0) {
    localT += 1;
  }

  if (localT > 1) {
    localT -= 1;
  }

  if (localT < 1 / 6) {
    return p + (q - p) * 6 * localT;
  }

  if (localT < 1 / 2) {
    return q;
  }

  if (localT < 2 / 3) {
    return p + (q - p) * (2 / 3 - localT) * 6;
  }

  return p;
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
