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

const MAP_ASPECT_RATIO = 1.86;
const MIN_MAP_HEIGHT = 176;
const MAX_MAP_HEIGHT = 236;
const NODE_LIMIT = 200;
const CONTINENTS: Array<Array<[number, number]>> = [
  [
    [-168, 70],
    [-146, 72],
    [-126, 63],
    [-110, 54],
    [-95, 51],
    [-79, 43],
    [-68, 32],
    [-82, 23],
    [-96, 18],
    [-114, 24],
    [-126, 34],
    [-143, 44],
    [-159, 55],
  ],
  [
    [-82, 12],
    [-66, 7],
    [-54, -8],
    [-48, -24],
    [-57, -43],
    [-70, -55],
    [-76, -39],
    [-74, -21],
    [-84, -4],
  ],
  [
    [-24, 36],
    [-8, 54],
    [22, 61],
    [55, 60],
    [86, 53],
    [124, 48],
    [149, 58],
    [166, 46],
    [145, 31],
    [113, 23],
    [84, 18],
    [55, 13],
    [35, 1],
    [19, -10],
    [2, 5],
    [-10, 19],
  ],
  [
    [-17, 32],
    [12, 32],
    [31, 17],
    [36, -3],
    [29, -25],
    [18, -35],
    [2, -28],
    [-9, -9],
    [-18, 8],
  ],
  [
    [38, 28],
    [55, 24],
    [74, 20],
    [88, 8],
    [78, -2],
    [62, 3],
    [45, 12],
  ],
  [
    [112, -12],
    [134, -12],
    [154, -26],
    [144, -39],
    [119, -36],
    [108, -25],
  ],
  [
    [-53, 75],
    [-35, 72],
    [-28, 64],
    [-44, 59],
    [-61, 65],
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
              <Path path={landPath} color="rgba(184, 206, 211, 0.055)" />
              <Path
                path={landPath}
                color="rgba(181, 238, 226, 0.075)"
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
          <View pointerEvents="none" style={styles.mapState}>
            <AppText style={styles.mapStateText}>
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

  for (const continent of CONTINENTS) {
    const [firstLongitude, firstLatitude] = continent[0];
    const first = project(firstLongitude, firstLatitude, size);

    path.moveTo(first.x, first.y);

    for (let index = 1; index < continent.length; index += 1) {
      const [longitude, latitude] = continent[index];
      const point = project(longitude, latitude, size);

      path.lineTo(point.x, point.y);
    }

    path.close();
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
  mapStateText: {
    ...tokens.postAuth.smallText,
    color: tokens.postAuth.secondary,
    fontSize: 10,
    letterSpacing: 1.25,
    lineHeight: 16,
    textAlign: "center",
    textTransform: "uppercase",
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
