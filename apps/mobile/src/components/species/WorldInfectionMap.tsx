import { useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import type { SpeciesMapRegion } from "../../auth/api";
import { tokens } from "../../design/tokens";
import { AppText } from "../AppText";

type WorldInfectionMapProps = {
  regions?: SpeciesMapRegion[] | null;
  loading?: boolean;
  error?: string | null;
};

type MapSize = {
  width: number;
  height: number;
};

type ProjectedRegion = SpeciesMapRegion & {
  x: number;
  y: number;
  intensity: number;
  phase: number;
};

type GeoPoint = [longitude: number, latitude: number];

type LandPathCommand =
  | { point: GeoPoint; type: "M" }
  | { point: GeoPoint; type: "L" }
  | { control1: GeoPoint; control2: GeoPoint; point: GeoPoint; type: "C" }
  | { type: "Z" };

const MAP_ASPECT_RATIO = 1.86;
const MIN_MAP_HEIGHT = 224;
const MAX_MAP_HEIGHT = 328;
const NODE_LIMIT = 200;
// Static simplified world silhouette in lon/lat coordinates.
const WORLD_LAND_PATHS: LandPathCommand[][] = [
  [
    { point: [-169, 58], type: "M" },
    { control1: [-164, 68], control2: [-151, 73], point: [-135, 70], type: "C" },
    { control1: [-121, 67], control2: [-113, 59], point: [-98, 56], type: "C" },
    { control1: [-82, 55], control2: [-70, 51], point: [-59, 45], type: "C" },
    { control1: [-65, 42], control2: [-70, 38], point: [-73, 34], type: "C" },
    { control1: [-77, 29], control2: [-79, 26], point: [-83, 24], type: "C" },
    { control1: [-90, 22], control2: [-95, 25], point: [-101, 22], type: "C" },
    { control1: [-107, 19], control2: [-108, 15], point: [-101, 12], type: "C" },
    { control1: [-94, 10], control2: [-88, 8], point: [-82, 7], type: "C" },
    { control1: [-91, 4], control2: [-101, 8], point: [-109, 17], type: "C" },
    { control1: [-116, 25], control2: [-121, 36], point: [-129, 43], type: "C" },
    { control1: [-140, 52], control2: [-154, 54], point: [-169, 58], type: "C" },
    { type: "Z" },
  ],
  [
    { point: [-80, 10], type: "M" },
    { control1: [-70, 13], control2: [-57, 8], point: [-48, -4], type: "C" },
    { control1: [-39, -16], control2: [-39, -29], point: [-51, -39], type: "C" },
    { control1: [-58, -45], control2: [-61, -54], point: [-68, -56], type: "C" },
    { control1: [-74, -45], control2: [-78, -31], point: [-76, -18], type: "C" },
    { control1: [-74, -7], control2: [-84, 0], point: [-80, 10], type: "C" },
    { type: "Z" },
  ],
  [
    { point: [-54, 76], type: "M" },
    { control1: [-44, 78], control2: [-31, 74], point: [-28, 65], type: "C" },
    { control1: [-34, 58], control2: [-47, 57], point: [-59, 62], type: "C" },
    { control1: [-66, 68], control2: [-64, 74], point: [-54, 76], type: "C" },
    { type: "Z" },
  ],
  [
    { point: [-12, 36], type: "M" },
    { control1: [-8, 47], control2: [-1, 55], point: [13, 58], type: "C" },
    { control1: [20, 66], control2: [36, 67], point: [49, 61], type: "C" },
    { control1: [73, 63], control2: [108, 62], point: [137, 56], type: "C" },
    { control1: [154, 53], control2: [166, 47], point: [167, 39], type: "C" },
    { control1: [156, 39], control2: [149, 34], point: [140, 31], type: "C" },
    { control1: [129, 27], control2: [119, 28], point: [112, 18], type: "C" },
    { control1: [108, 13], control2: [105, 8], point: [101, 4], type: "C" },
    { control1: [96, 6], control2: [97, 14], point: [91, 15], type: "C" },
    { control1: [86, 16], control2: [84, 10], point: [82, 7], type: "C" },
    { control1: [78, 16], control2: [73, 23], point: [64, 24], type: "C" },
    { control1: [56, 25], control2: [49, 28], point: [43, 29], type: "C" },
    { control1: [39, 23], control2: [44, 16], point: [53, 13], type: "C" },
    { control1: [43, 10], control2: [35, 20], point: [31, 30], type: "C" },
    { control1: [23, 38], control2: [15, 38], point: [8, 42], type: "C" },
    { control1: [1, 47], control2: [-7, 42], point: [-12, 36], type: "C" },
    { type: "Z" },
  ],
  [
    { point: [-18, 30], type: "M" },
    { control1: [-7, 33], control2: [15, 33], point: [31, 27], type: "C" },
    { control1: [40, 23], control2: [43, 15], point: [47, 8], type: "C" },
    { control1: [39, 4], control2: [37, -8], point: [34, -18], type: "C" },
    { control1: [30, -30], control2: [22, -36], point: [14, -35], type: "C" },
    { control1: [4, -33], control2: [-4, -25], point: [-8, -13], type: "C" },
    { control1: [-13, -2], control2: [-20, 11], point: [-18, 30], type: "C" },
    { type: "Z" },
  ],
  [
    { point: [111, -17], type: "M" },
    { control1: [122, -12], control2: [139, -12], point: [152, -25], type: "C" },
    { control1: [148, -35], control2: [135, -42], point: [119, -38], type: "C" },
    { control1: [108, -34], control2: [104, -24], point: [111, -17], type: "C" },
    { type: "Z" },
  ],
];

export function WorldInfectionMap({
  error,
  loading = false,
  regions,
}: WorldInfectionMapProps) {
  const [size, setSize] = useState<MapSize>({ width: 0, height: 0 });
  const reduceMotion = useReduceMotion();
  const pulse = useSharedValue(0);
  const visibleRegions = useMemo(
    () => (regions ?? []).slice(0, NODE_LIMIT),
    [regions],
  );
  const projectedRegions = useMemo(
    () => projectRegions(visibleRegions, size),
    [size, visibleRegions],
  );
  const landPath = useMemo(() => createLandPath(size), [size]);
  const gridPath = useMemo(() => createGridPath(size), [size]);
  const mapHeight = Math.min(
    MAX_MAP_HEIGHT,
    Math.max(MIN_MAP_HEIGHT, size.width / MAP_ASPECT_RATIO || MIN_MAP_HEIGHT),
  );

  useEffect(() => {
    if (reduceMotion || projectedRegions.length === 0) {
      cancelAnimation(pulse);
      pulse.value = 0;
      return;
    }

    pulse.value = withRepeat(
      withTiming(1, {
        duration: tokens.motion.breathe,
      }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(pulse);
    };
  }, [projectedRegions.length, pulse, reduceMotion]);

  function updateSize(event: LayoutChangeEvent) {
    const { width } = event.nativeEvent.layout;
    const nextHeight = Math.min(
      MAX_MAP_HEIGHT,
      Math.max(MIN_MAP_HEIGHT, width / MAP_ASPECT_RATIO),
    );

    setSize((previous) =>
      previous.width === width && previous.height === nextHeight
        ? previous
        : { width, height: nextHeight },
    );
  }

  const showEmptyState = !loading && !error && projectedRegions.length === 0;
  const landFillColor = showEmptyState
    ? "rgba(184, 206, 211, 0.038)"
    : "rgba(184, 206, 211, 0.055)";
  const landStrokeColor = showEmptyState
    ? "rgba(181, 238, 226, 0.052)"
    : "rgba(181, 238, 226, 0.075)";

  return (
    <View style={styles.shell} onLayout={updateSize}>
      <View style={[styles.mapFrame, { height: mapHeight }]}>
        {size.width > 0 && size.height > 0 ? (
          <>
            <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Path
                path={gridPath}
                color="rgba(184, 206, 211, 0.045)"
                strokeWidth={0.6}
                style="stroke"
              />
              <Path path={landPath} color={landFillColor} />
              <Path
                path={landPath}
                color={landStrokeColor}
                strokeWidth={0.8}
                style="stroke"
              />
            </Canvas>
            {projectedRegions.map((region) => (
              <InfectionNode
                key={region.key}
                progress={pulse}
                reduceMotion={reduceMotion}
                region={region}
              />
            ))}
          </>
        ) : null}

        {loading ? (
          <View pointerEvents="none" style={styles.mapState}>
            <AppText style={styles.mapStateText}>READING GLOBAL SPREAD</AppText>
          </View>
        ) : null}

        {error ? (
          <View pointerEvents="none" style={styles.mapState}>
            <AppText style={styles.mapStateText}>GLOBAL SPREAD UNAVAILABLE</AppText>
          </View>
        ) : null}

        {showEmptyState ? (
          <View pointerEvents="none" style={[styles.mapState, styles.emptyMapState]}>
            <AppText style={[styles.mapStateText, styles.emptyMapStateText]}>
              THE SPECIES HAS NOT SURFACED GLOBALLY YET
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function InfectionNode({
  progress,
  reduceMotion,
  region,
}: {
  progress: SharedValue<number>;
  reduceMotion: boolean;
  region: ProjectedRegion;
}) {
  const radius = 3.5 + region.intensity * 5.5;
  const glowSize = radius * 5.4;
  const coreSize = radius * 1.65;
  const animatedStyle = useAnimatedStyle(() => {
    const wave = reduceMotion
      ? 0.34
      : (Math.sin((progress.value + region.phase) * Math.PI * 2) + 1) / 2;
    const scale = 0.92 + wave * (0.1 + region.intensity * 0.16);

    return {
      opacity: 0.5 + region.intensity * 0.24 + wave * 0.16,
      transform: [{ scale }],
    };
  }, [reduceMotion, region.intensity, region.phase]);

  return (
    <Animated.View
      accessibilityLabel={`${region.label} infection colony`}
      pointerEvents="none"
      style={[
        styles.node,
        {
          height: glowSize,
          left: region.x - glowSize / 2,
          top: region.y - glowSize / 2,
          width: glowSize,
        },
        animatedStyle,
      ]}
    >
      <View
        style={[
          styles.nodeHalo,
          {
            borderRadius: glowSize / 2,
          },
        ]}
      />
      <View
        style={[
          styles.nodeCore,
          {
            borderRadius: coreSize / 2,
            height: coreSize,
            width: coreSize,
          },
        ]}
      />
    </Animated.View>
  );
}

function projectRegions(regions: SpeciesMapRegion[], size: MapSize): ProjectedRegion[] {
  if (size.width <= 0 || size.height <= 0) {
    return [];
  }

  const maxBirths = Math.max(1, ...regions.map((region) => region.births));

  return regions.map((region) => {
    const point = project(region.longitude, region.latitude, size);
    const intensity =
      maxBirths <= 1
        ? 0.38
        : Math.log1p(Math.max(1, region.births)) / Math.log1p(maxBirths);

    return {
      ...region,
      intensity: clamp(intensity, 0.32, 1),
      phase: hashPhase(region.key),
      x: point.x,
      y: point.y,
    };
  });
}

function createLandPath(size: MapSize) {
  const path = Skia.Path.Make();

  if (size.width <= 0 || size.height <= 0) {
    return path;
  }

  for (const landPath of WORLD_LAND_PATHS) {
    for (const command of landPath) {
      if (command.type === "Z") {
        path.close();
        continue;
      }

      const point = project(command.point[0], command.point[1], size);

      if (command.type === "M") {
        path.moveTo(point.x, point.y);
        continue;
      }

      if (command.type === "L") {
        path.lineTo(point.x, point.y);
        continue;
      }

      const control1 = project(command.control1[0], command.control1[1], size);
      const control2 = project(command.control2[0], command.control2[1], size);

      path.cubicTo(control1.x, control1.y, control2.x, control2.y, point.x, point.y);
    }
  }

  return path;
}

function createGridPath(size: MapSize) {
  const path = Skia.Path.Make();

  if (size.width <= 0 || size.height <= 0) {
    return path;
  }

  for (const latitude of [-45, 0, 45]) {
    const start = project(-176, latitude, size);
    const end = project(176, latitude, size);

    path.moveTo(start.x, start.y);
    path.lineTo(end.x, end.y);
  }

  for (const longitude of [-120, -60, 0, 60, 120]) {
    const start = project(longitude, 70, size);
    const end = project(longitude, -58, size);

    path.moveTo(start.x, start.y);
    path.lineTo(end.x, end.y);
  }

  return path;
}

function project(longitude: number, latitude: number, size: MapSize) {
  const marginX = size.width * 0.035;
  const marginY = size.height * 0.08;
  const width = size.width - marginX * 2;
  const height = size.height - marginY * 2;
  const x = marginX + ((longitude + 180) / 360) * width;
  const y = marginY + ((86 - latitude) / 172) * height;

  return {
    x: clamp(x, marginX, size.width - marginX),
    y: clamp(y, marginY, size.height - marginY),
  };
}

function hashPhase(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return ((hash >>> 0) % 1000) / 1000;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}

const styles = StyleSheet.create({
  shell: {
    overflow: "visible",
    width: "100%",
  },
  mapFrame: {
    overflow: "visible",
    position: "relative",
    width: "100%",
  },
  mapState: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    paddingHorizontal: tokens.spacing.xl,
    position: "absolute",
    right: 0,
    top: 0,
  },
  emptyMapState: {
    transform: [{ translateY: tokens.spacing.lg }],
  },
  mapStateText: {
    ...tokens.postAuth.smallText,
    color: tokens.postAuth.secondary,
    fontSize: 10,
    letterSpacing: 1.25,
    lineHeight: 16,
    textAlign: "center",
    textTransform: "uppercase",
  },
  emptyMapStateText: {
    maxWidth: 260,
  },
  node: {
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
  },
  nodeHalo: {
    backgroundColor: "rgba(181, 238, 226, 0.12)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    shadowColor: tokens.specimen.mint,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    top: 0,
  },
  nodeCore: {
    backgroundColor: "rgba(224, 255, 248, 0.86)",
    shadowColor: tokens.specimen.mint,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.44,
    shadowRadius: 9,
  },
});
