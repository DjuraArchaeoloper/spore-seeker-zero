import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Image as RNImage,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Michroma_400Regular } from "@expo-google-fonts/michroma";
import { useFonts } from "expo-font";
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { BODY_FAMILY_SLOTS, type CreatureFamily } from "@spore/shared";

import {
  SPORE_CREATURE_FAMILIES,
  SPORE_MOUSTACHE_ASSET,
} from "../../assets/organisms/registry";
import { AppText } from "../components/AppText";
import { OrganismRenderer } from "../components/organism/OrganismRenderer";
import { tokens } from "../design/tokens";
import type { Organism } from "./chain";

const MIXING_SEQUENCE_DURATION_MS = 3600;
const FINAL_REVEAL_DURATION_MS = 2700;
const REDUCED_MOTION_MIXING_DURATION_MS = 650;
const REDUCED_MOTION_FINAL_REVEAL_DURATION_MS = 1850;
const COLLAPSE_START = 0.78;
const COLLAPSE_END = 0.9;
const FAMILY_LAYER_ORDER = [
  "glow",
  "fins",
  "body",
  "tendrils",
  "core",
  "surface",
] as const;

type LifeformDepth = "background" | "midground" | "foreground";

type FamilyTrackLayout = {
  depth: LifeformDepth;
  holdFinal?: boolean;
  sizeRatio: number;
  time: readonly [number, number, number, number];
  x: readonly [number, number, number, number];
  y: readonly [number, number, number, number];
  scale: readonly [number, number, number, number];
  rotate: readonly [number, number, number, number];
  peakOpacity: number;
};

type LifeformTrack = {
  key: string;
  family: CreatureFamily;
  depth: LifeformDepth;
  size: number;
  layerOpacity: number;
  opacityInput: number[];
  opacityOutput: number[];
  xInput: number[];
  xOutput: number[];
  yInput: number[];
  yOutput: number[];
  scaleInput: number[];
  scaleOutput: number[];
  rotateInput: number[];
  rotateOutput: number[];
};

type NewbornTrack = Omit<LifeformTrack, "family" | "layerOpacity">;

export type BirthRevealPayload = {
  birthTransactionSignature?: string | null;
  newborn: Organism;
  parent: Organism | null;
};

const FAMILY_TRACK_LAYOUTS: readonly FamilyTrackLayout[] = [
  {
    depth: "background",
    sizeRatio: 0.46,
    time: [0.08, 0.16, 0.25, 0.43],
    x: [-0.12, 0.08, 0.34, 0.54],
    y: [0.26, 0.21, 0.3, 0.36],
    scale: [0.7, 0.76, 0.73, 0.66],
    rotate: [-5, -4, -2, -1],
    peakOpacity: 0.16,
  },
  {
    depth: "background",
    sizeRatio: 0.5,
    time: [0.12, 0.2, 0.3, 0.48],
    x: [1.1, 0.86, 0.62, 0.3],
    y: [0.18, 0.25, 0.23, 0.31],
    scale: [0.66, 0.72, 0.7, 0.62],
    rotate: [4, 3, 1, -1],
    peakOpacity: 0.14,
  },
  {
    depth: "midground",
    sizeRatio: 0.62,
    time: [0.18, 0.29, 0.39, 0.56],
    x: [-0.16, 0.13, 0.46, 0.78],
    y: [0.62, 0.54, 0.48, 0.42],
    scale: [0.82, 0.92, 0.9, 0.82],
    rotate: [-7, -5, -2, 1],
    peakOpacity: 0.34,
  },
  {
    depth: "foreground",
    sizeRatio: 0.82,
    time: [0.24, 0.33, 0.43, 0.58],
    x: [1.08, 0.82, 0.53, 0.22],
    y: [0.72, 0.64, 0.52, 0.46],
    scale: [1.06, 1.16, 1.08, 0.96],
    rotate: [7, 5, 2, -1],
    peakOpacity: 0.42,
  },
  {
    depth: "midground",
    sizeRatio: 0.58,
    time: [0.34, 0.43, 0.52, 0.68],
    x: [0.02, 0.24, 0.46, 0.64],
    y: [0.12, 0.24, 0.38, 0.54],
    scale: [0.76, 0.86, 0.92, 0.84],
    rotate: [-2, -1, 2, 4],
    peakOpacity: 0.3,
  },
  {
    depth: "background",
    sizeRatio: 0.44,
    time: [0.4, 0.49, 0.57, 0.72],
    x: [0.86, 0.7, 0.48, 0.18],
    y: [0.07, 0.18, 0.29, 0.38],
    scale: [0.66, 0.74, 0.78, 0.68],
    rotate: [3, 2, 0, -2],
    peakOpacity: 0.18,
  },
  {
    depth: "foreground",
    sizeRatio: 0.86,
    time: [0.48, 0.56, 0.64, 0.76],
    x: [-0.22, 0.05, 0.36, 0.6],
    y: [0.46, 0.5, 0.46, 0.38],
    scale: [1.02, 1.18, 1.08, 0.9],
    rotate: [-6, -4, -1, 2],
    peakOpacity: 0.44,
  },
  {
    depth: "midground",
    sizeRatio: 0.64,
    time: [0.54, 0.62, 0.69, 0.8],
    x: [0.94, 0.72, 0.48, 0.28],
    y: [0.42, 0.45, 0.5, 0.56],
    scale: [0.82, 0.96, 0.9, 0.78],
    rotate: [5, 3, 1, -2],
    peakOpacity: 0.36,
  },
  {
    depth: "background",
    sizeRatio: 0.52,
    time: [0.6, 0.67, 0.74, 0.84],
    x: [0.16, 0.3, 0.47, 0.68],
    y: [0.84, 0.68, 0.54, 0.42],
    scale: [0.68, 0.8, 0.76, 0.62],
    rotate: [-4, -2, 0, 2],
    peakOpacity: 0.2,
  },
  {
    depth: "foreground",
    sizeRatio: 0.9,
    time: [0.65, 0.72, 0.78, 0.88],
    x: [1.18, 0.88, 0.58, 0.42],
    y: [0.26, 0.34, 0.43, 0.49],
    scale: [1.12, 1.22, 1.08, 0.66],
    rotate: [6, 3, 1, 0],
    peakOpacity: 0.48,
  },
];

const NEWBORN_TRACK_LAYOUTS: readonly FamilyTrackLayout[] = [
  {
    depth: "midground",
    sizeRatio: 0.62,
    time: [0.58, 0.66, 0.71, 0.78],
    x: [0.72, 0.58, 0.47, 0.38],
    y: [0.59, 0.52, 0.47, 0.44],
    scale: [0.82, 0.94, 0.9, 0.72],
    rotate: [3, 1, 0, -1],
    peakOpacity: 0.28,
  },
  {
    depth: "foreground",
    sizeRatio: 0.78,
    time: [0.68, 0.74, 0.8, 0.87],
    x: [0.16, 0.33, 0.49, 0.5],
    y: [0.42, 0.47, 0.5, 0.5],
    scale: [0.94, 1.06, 0.9, 0.54],
    rotate: [-3, -1, 0, 0],
    peakOpacity: 0.46,
  },
  {
    depth: "midground",
    holdFinal: true,
    sizeRatio: 0.92,
    time: [0.78, 0.84, 0.9, 1],
    x: [0.5, 0.5, 0.5, 0.5],
    y: [0.5, 0.5, 0.5, 0.5],
    scale: [0.72, 0.86, 0.42, 0.34],
    rotate: [0, 0, 0, 0],
    peakOpacity: 0.56,
  },
];

export function BirthRevealPendingStage({
  status,
}: {
  status: "submittingClaim" | "awaitingNewborn" | "newbornResolved";
}) {
  const label =
    status === "submittingClaim"
      ? "Accepting life"
      : status === "newbornResolved"
        ? "Life confirmed"
        : "Receiving organism";
  const supporting =
    status === "submittingClaim"
      ? "Confirming the claim transaction."
      : "Waiting for the canonical birth record.";

  return (
    <RevealShell>
      <PendingOrb />
      <View style={styles.copy}>
        <AppText style={styles.title} variant="title">
          {label}
        </AppText>
        <AppText style={styles.supporting} tone="secondary">
          {supporting}
        </AppText>
      </View>
    </RevealShell>
  );
}

export function BirthRevealStage({
  birthTransactionSignature,
  newborn,
  parent,
  onComplete,
}: BirthRevealPayload & {
  onComplete: (payload: BirthRevealPayload) => void;
}) {
  const { height, width } = useWindowDimensions();
  const mixingProgress = useSharedValue(0);
  const birthProgress = useSharedValue(0);
  const reduceMotion = useReduceMotion();
  const mixingDuration = reduceMotion
    ? REDUCED_MOTION_MIXING_DURATION_MS
    : MIXING_SEQUENCE_DURATION_MS;
  const finalRevealDuration = reduceMotion
    ? REDUCED_MOTION_FINAL_REVEAL_DURATION_MS
    : FINAL_REVEAL_DURATION_MS;
  const revealSeed = useMemo(() => createRevealSeed(newborn), [newborn]);
  const familyTracks = useMemo(
    () => (reduceMotion ? [] : createFamilyTracks(width, height, revealSeed)),
    [height, reduceMotion, revealSeed, width],
  );
  const newbornTracks = useMemo(
    () => (reduceMotion ? [] : createNewbornTracks(width, height, revealSeed)),
    [height, reduceMotion, revealSeed, width],
  );
  const finalCreatureSize = useMemo(
    () => createFinalCreatureSize(width, height),
    [height, width],
  );
  const backdropStyle = useBackdropStyle(birthProgress);
  const currentStyle = useCurrentStyle(mixingProgress, birthProgress);

  useEffect(() => {
    mixingProgress.value = reduceMotion ? 1 : 0;
    birthProgress.value = 0;

    if (!reduceMotion) {
      mixingProgress.value = withTiming(1, {
        duration: mixingDuration,
        easing: Easing.bezier(0.16, 0.84, 0.2, 1),
      });
    }

    const birthTimer = setTimeout(() => {
      birthProgress.value = withTiming(1, {
        duration: finalRevealDuration,
        easing: Easing.bezier(0.18, 0.72, 0.18, 1),
      });
    }, mixingDuration);

    const timer = setTimeout(() => {
      onComplete({ birthTransactionSignature, newborn, parent });
    }, mixingDuration + finalRevealDuration + 80);

    return () => {
      clearTimeout(birthTimer);
      clearTimeout(timer);
      cancelAnimation(mixingProgress);
      cancelAnimation(birthProgress);
    };
  }, [
    birthProgress,
    birthTransactionSignature,
    finalRevealDuration,
    mixingDuration,
    mixingProgress,
    newborn,
    onComplete,
    parent,
    reduceMotion,
  ]);

  return (
    <RevealShell dark={false}>
      <Animated.View style={[styles.darkBackdrop, backdropStyle]} />
      <View pointerEvents="none" style={styles.chamber}>
        <Animated.View style={[styles.chamberCurrent, currentStyle]} />
        {familyTracks.map((track) => (
          <AnimatedLifeform
            key={track.key}
            progress={mixingProgress}
            track={track}
          >
            <FamilyLifeform
              family={track.family}
              layerOpacity={track.layerOpacity}
              size={track.size}
            />
          </AnimatedLifeform>
        ))}
        {newbornTracks.map((track) => (
          <AnimatedLifeform
            key={track.key}
            progress={mixingProgress}
            track={track}
          >
            <OrganismRenderer
              animated={false}
              genome={newborn.genome}
              size={track.size}
            />
          </AnimatedLifeform>
        ))}
        <ConvergenceLight
          birthProgress={birthProgress}
          mixingProgress={mixingProgress}
        />
        <FinalNewbornReveal
          newborn={newborn}
          progress={birthProgress}
          size={finalCreatureSize}
        />
        <FinalBirthText newborn={newborn} progress={birthProgress} />
      </View>
    </RevealShell>
  );
}

function RevealShell({
  children,
  dark = true,
}: {
  children: ReactNode;
  dark?: boolean;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.screen,
        dark ? styles.darkScreen : null,
        {
          paddingBottom: Math.max(insets.bottom, tokens.spacing.xl),
          paddingTop: Math.max(insets.top, tokens.spacing.xl),
        },
      ]}
    >
      {children}
    </View>
  );
}

function PendingOrb() {
  return (
    <View accessibilityLabel="Life forming" style={styles.pendingOrbStage}>
      <View style={styles.pendingOrbHalo} />
      <View style={styles.pendingOrbRing} />
      <View style={styles.pendingOrbCore} />
    </View>
  );
}

function AnimatedLifeform({
  children,
  progress,
  track,
}: {
  children: ReactNode;
  progress: SharedValue<number>;
  track: LifeformTrack | NewbornTrack;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      progress.value,
      track.opacityInput,
      track.opacityOutput,
      Extrapolation.CLAMP,
    );
    const translateX = interpolate(
      progress.value,
      track.xInput,
      track.xOutput,
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      progress.value,
      track.yInput,
      track.yOutput,
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      progress.value,
      track.scaleInput,
      track.scaleOutput,
      Extrapolation.CLAMP,
    );
    const rotation = interpolate(
      progress.value,
      track.rotateInput,
      track.rotateOutput,
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [
        { translateX },
        { translateY },
        { rotate: `${rotation}deg` },
        { scale },
      ],
    };
  }, [progress, track]);

  return (
    <Animated.View
      style={[
        styles.lifeform,
        depthStyle(track.depth),
        {
          height: track.size,
          width: track.size,
        },
        animatedStyle,
      ]}
    >
      {children}
    </Animated.View>
  );
}

function FamilyLifeform({
  family,
  layerOpacity,
  size,
}: {
  family: CreatureFamily;
  layerOpacity: number;
  size: number;
}) {
  const definition = SPORE_CREATURE_FAMILIES[family];
  const moustacheWidth = size * definition.moustache.width * 0.7;
  const moustacheHeight = moustacheWidth * 0.35;
  const moustacheLeft = size * definition.moustache.center[0] - moustacheWidth * 0.5;
  const moustacheTop = size * definition.moustache.center[1] - moustacheHeight * 0.5;

  return (
    <View style={styles.lifeformCanvas}>
      {FAMILY_LAYER_ORDER.map((layer) => (
        <RNImage
          key={layer}
          resizeMode="contain"
          source={definition.assets[layer]}
          style={[
            styles.lifeformLayer,
            {
              opacity: layerOpacity * layerOpacityFor(layer),
            },
          ]}
        />
      ))}
      <RNImage
        resizeMode="contain"
        source={SPORE_MOUSTACHE_ASSET}
        style={[
          styles.moustache,
          {
            height: moustacheHeight,
            left: moustacheLeft,
            opacity: Math.min(0.5, layerOpacity + 0.04),
            top: moustacheTop,
            transform: [{ rotate: `${definition.moustache.rotationDeg}deg` }],
            width: moustacheWidth,
          },
        ]}
      />
    </View>
  );
}

function ConvergenceLight({
  birthProgress,
  mixingProgress,
}: {
  birthProgress: SharedValue<number>;
  mixingProgress: SharedValue<number>;
}) {
  const coreStyle = useAnimatedStyle(() => {
    const collapseOpacity = interpolate(
      mixingProgress.value,
      [0, 0.12, 0.24, COLLAPSE_START, COLLAPSE_END, 1],
      [0, 0.64, 0.5, 0.7, 0.95, 0.2],
      Extrapolation.CLAMP,
    );
    const collapseScale = interpolate(
      mixingProgress.value,
      [0, 0.16, 0.34, COLLAPSE_START, COLLAPSE_END, 1],
      [0.14, 0.62, 0.52, 0.88, 1.26, 0.3],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      birthProgress.value,
      [0, 0.08, 0.2, 0.36, 0.68, 1],
      [collapseOpacity, 0.14, 0.5, 0.2, 0.05, 0],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      birthProgress.value,
      [0, 0.08, 0.2, 0.36, 0.68, 1],
      [collapseScale, 0.22, 0.64, 1.1, 0.48, 0.2],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [{ scale }],
    };
  }, [birthProgress, mixingProgress]);

  const haloStyle = useAnimatedStyle(() => {
    const collapseOpacity = interpolate(
      mixingProgress.value,
      [0, 0.18, 0.58, COLLAPSE_START, COLLAPSE_END, 1],
      [0, 0.22, 0.12, 0.3, 0.05, 0],
      Extrapolation.CLAMP,
    );
    const collapseScale = interpolate(
      mixingProgress.value,
      [0, 0.18, 0.58, COLLAPSE_START, COLLAPSE_END, 1],
      [0.2, 1, 0.92, 1.24, 0.18, 0.08],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      birthProgress.value,
      [0, 0.14, 0.42, 0.62, 1],
      [collapseOpacity, 0.02, 0.2, 0.08, 0],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      birthProgress.value,
      [0, 0.14, 0.42, 0.62, 1],
      [collapseScale, 0.12, 1.18, 0.74, 0.28],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [{ scale }],
    };
  }, [birthProgress, mixingProgress]);

  const flashStyle = useAnimatedStyle(() => {
    const collapseOpacity = interpolate(
      mixingProgress.value,
      [COLLAPSE_START, COLLAPSE_END - 0.04, COLLAPSE_END, 1],
      [0, 0.34, 0.02, 0],
      Extrapolation.CLAMP,
    );
    const birthOpacity = interpolate(
      birthProgress.value,
      [0.26, 0.36, 0.48, 0.62],
      [0, 0.12, 0.24, 0],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      birthProgress.value,
      [0, 0.36, 0.5, 1],
      [0.2, 0.62, 1.04, 0.2],
      Extrapolation.CLAMP,
    );

    return {
      opacity: Math.max(collapseOpacity, birthOpacity),
      transform: [{ scale }],
    };
  }, [birthProgress, mixingProgress]);

  return (
    <View accessibilityLabel="Life converging" style={styles.convergence}>
      <Animated.View style={[styles.convergenceHalo, haloStyle]} />
      <Animated.View style={[styles.convergenceCore, coreStyle]} />
      <Animated.View style={[styles.convergenceFlash, flashStyle]} />
    </View>
  );
}

function FinalNewbornReveal({
  newborn,
  progress,
  size,
}: {
  newborn: Organism;
  progress: SharedValue<number>;
  size: number;
}) {
  const { height } = useWindowDimensions();
  const lift = Math.min(height * 0.058, 48);
  const stageStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      progress.value,
      [0, 0.07, 0.18, 0.36, 0.78, 0.94, 1],
      [0, 0, 0.16, 0.72, 1, 1, 0.88],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      progress.value,
      [0, 0.12, 0.32, 0.56, 1],
      [0.93, 0.94, 0.965, 1, 1],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      progress.value,
      [0, 0.16, 0.56, 1],
      [18, 10, -lift, -lift],
      Extrapolation.CLAMP,
    );
    const rotation = interpolate(
      progress.value,
      [0, 0.24, 0.58, 1],
      [-1.2, -0.5, 0, 0],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [
        { translateY },
        { rotate: `${rotation}deg` },
        { scale },
      ],
    };
  }, [lift, progress]);
  const ghostStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.16, 0.3, 0.5, 0.68],
      [0, 0, 0.18, 0.24, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0.16, 0.36, 0.68],
          [0.9, 1.035, 1.06],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }), [progress]);
  const mainStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.19, 0.3, 0.48, 0.7, 0.95, 1],
      [0, 0, 0.16, 0.62, 1, 1, 0.96],
      Extrapolation.CLAMP,
    ),
  }), [progress]);

  return (
    <Animated.View
      style={[
        styles.finalNewborn,
        {
          height: size,
          marginLeft: size * -0.5,
          marginTop: size * -0.5,
          width: size,
        },
        stageStyle,
      ]}
    >
      <FinalBirthGlow progress={progress} size={size} />
      <Animated.View style={[styles.finalCreaturePass, ghostStyle]}>
        <OrganismRenderer animated={false} genome={newborn.genome} size={size} />
      </Animated.View>
      <Animated.View style={[styles.finalCreaturePass, mainStyle]}>
        <OrganismRenderer animated={false} genome={newborn.genome} size={size} />
      </Animated.View>
    </Animated.View>
  );
}

function FinalBirthGlow({
  progress,
  size,
}: {
  progress: SharedValue<number>;
  size: number;
}) {
  const outerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.18, 0.42, 0.58, 0.82, 1],
      [0, 0.04, 0.24, 0.34, 0.14, 0.06],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, 0.3, 0.58, 1],
          [0.36, 0.8, 1.08, 0.86],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }), [progress]);
  const internalStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.08, 0.18, 0.34, 0.54, 0.82, 1],
      [0, 0, 0.7, 0.34, 0.5, 0.14, 0.05],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, 0.18, 0.38, 0.58, 1],
          [0.22, 0.58, 1.22, 0.82, 0.48],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }), [progress]);
  const outerSize = size * 0.78;
  const internalSize = size * 0.18;

  return (
    <>
      <Animated.View
        style={[
          styles.birthGlowOuter,
          {
            height: outerSize,
            marginLeft: outerSize * -0.5,
            marginTop: outerSize * -0.5,
            width: outerSize,
          },
          outerStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.birthGlowInternal,
          {
            height: internalSize,
            marginLeft: internalSize * -0.5,
            marginTop: internalSize * -0.5,
            width: internalSize,
          },
          internalStyle,
        ]}
      />
    </>
  );
}

function FinalBirthText({
  newborn,
  progress,
}: {
  newborn: Organism;
  progress: SharedValue<number>;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({ Michroma_400Regular });
  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.43, 0.52, 0.9, 1],
      [0, 0, 1, 1, 0.68],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          progress.value,
          [0.43, 0.58, 1],
          [10, 0, -2],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }), [progress]);
  const identityStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.52, 0.62, 0.9, 1],
      [0, 0, 0.82, 0.82, 0.5],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          progress.value,
          [0.52, 0.66, 1],
          [8, 0, -1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }), [progress]);
  const bottom = Math.max(insets.bottom + 34, height * 0.07);
  const identity = `GEN ${newborn.generation} · #${newborn.organismNumber.padStart(6, "0")}`;

  return (
    <View pointerEvents="none" style={[styles.birthText, { bottom }]}>
      <Animated.View style={titleStyle}>
        <AppText
          maxFontSizeMultiplier={1.15}
          style={[styles.itLives, fontsLoaded ? styles.revealFont : null]}
          variant="title"
        >
          IT LIVES.
        </AppText>
      </Animated.View>
      <Animated.View style={identityStyle}>
        <AppText
          maxFontSizeMultiplier={1.15}
          style={[
            styles.birthIdentity,
            fontsLoaded ? styles.revealFont : null,
          ]}
          variant="metadata"
        >
          {identity}
        </AppText>
      </Animated.View>
    </View>
  );
}

function useBackdropStyle(progress: SharedValue<number>) {
  return useAnimatedStyle(
    () => ({
      opacity: interpolate(
        progress.value,
        [0, 0.86, 0.96, 1],
        [1, 1, 0.76, 0.58],
        Extrapolation.CLAMP,
      ),
    }),
    [progress],
  );
}

function useCurrentStyle(
  mixingProgress: SharedValue<number>,
  birthProgress: SharedValue<number>,
) {
  return useAnimatedStyle(
    () => ({
      opacity: interpolate(
        mixingProgress.value,
        [0, 0.35, 0.68, COLLAPSE_END, 1],
        [0, 0.12, 0.18, 0.08, 0.02],
        Extrapolation.CLAMP,
      ) * interpolate(
        birthProgress.value,
        [0, 0.2, 1],
        [1, 0.18, 0],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          scale: interpolate(
            mixingProgress.value,
            [0, 0.56, COLLAPSE_END, 1],
            [0.84, 1, 0.52, 0.36],
            Extrapolation.CLAMP,
          ),
        },
      ],
    }),
    [birthProgress, mixingProgress],
  );
}

function createFinalCreatureSize(width: number, height: number) {
  const usefulWidth = Math.max(1, width);
  const usefulHeight = Math.max(1, height);

  return clamp(Math.min(usefulWidth * 1.12, usefulHeight * 0.64), 330, 610);
}

function createFamilyTracks(width: number, height: number, seed: number) {
  const orderedFamilies = shuffleBySeed(BODY_FAMILY_SLOTS, seed);

  return orderedFamilies.slice(0, FAMILY_TRACK_LAYOUTS.length).map((family, index) =>
    createTrack({
      family,
      height,
      key: `possible-${family}-${index}`,
      layout: FAMILY_TRACK_LAYOUTS[index],
      seed: seed + index * 97,
      width,
    }),
  );
}

function createNewbornTracks(width: number, height: number, seed: number) {
  return NEWBORN_TRACK_LAYOUTS.map((layout, index) =>
    createTrack({
      height,
      key: `newborn-${index}`,
      layout,
      seed: seed + index * 271,
      width,
    }),
  );
}

function createTrack({
  family,
  height,
  key,
  layout,
  seed,
  width,
}: {
  family?: CreatureFamily;
  height: number;
  key: string;
  layout: FamilyTrackLayout;
  seed: number;
  width: number;
}): LifeformTrack {
  const minDimension = Math.max(1, Math.min(width, height));
  const sizeJitter = 0.94 + seededUnit(seed, 11) * 0.12;
  const size = clamp(minDimension * layout.sizeRatio * sizeJitter, 150, 560);
  const half = size * 0.5;
  const collapseJitterX = layout.holdFinal ? 0 : (seededUnit(seed, 23) - 0.5) * minDimension * 0.05;
  const collapseJitterY = layout.holdFinal ? 0 : (seededUnit(seed, 37) - 0.5) * minDimension * 0.04;
  const collapseX = width * 0.5 - half + collapseJitterX;
  const collapseY = height * 0.5 - half + collapseJitterY;
  const time = layout.time;
  const breathe = 0.985 + seededUnit(seed, 43) * 0.035;
  const layerOpacity =
    layout.depth === "background" ? 0.42 : layout.depth === "foreground" ? 0.78 : 0.62;
  const opacityInput = layout.holdFinal
    ? [
        time[0],
        midpoint(time[0], time[1]),
        time[1],
        time[2],
        1,
      ]
    : [
        time[0],
        midpoint(time[0], time[1]),
        time[1],
        time[2],
        time[3],
        COLLAPSE_END,
        1,
      ];
  const opacityOutput = layout.holdFinal
    ? [
        0,
        layout.peakOpacity * 0.42,
        layout.peakOpacity,
        layout.peakOpacity * 0.2,
        layout.peakOpacity * 0.16,
      ]
    : [
        0,
        layout.peakOpacity * 0.42,
        layout.peakOpacity,
        layout.peakOpacity * 0.72,
        0,
        0,
        0,
      ];
  const positionInput = layout.holdFinal
    ? [time[0], time[1], time[2], 1]
    : [time[0], time[1], time[2], time[3], COLLAPSE_END, 1];
  const xOutput = layout.holdFinal
    ? [
        width * layout.x[0] - half,
        width * layout.x[1] - half,
        collapseX,
        collapseX,
      ]
    : [
        width * layout.x[0] - half,
        width * layout.x[1] - half,
        width * layout.x[2] - half,
        width * layout.x[3] - half,
        collapseX,
        collapseX,
      ];
  const yOutput = layout.holdFinal
    ? [
        height * layout.y[0] - half,
        height * layout.y[1] - half,
        collapseY,
        collapseY,
      ]
    : [
        height * layout.y[0] - half,
        height * layout.y[1] - half,
        height * layout.y[2] - half,
        height * layout.y[3] - half,
        collapseY,
        collapseY,
      ];
  const scaleOutput = layout.holdFinal
    ? [
        layout.scale[0],
        layout.scale[1] * breathe,
        layout.scale[2] * 0.48,
        layout.scale[2] * 0.38,
      ]
    : [
        layout.scale[0],
        layout.scale[1] * breathe,
        layout.scale[2],
        layout.scale[3],
        0.28,
        0.18,
      ];
  const rotateOutput = layout.holdFinal
    ? [layout.rotate[0], layout.rotate[1], 0, 0]
    : [...layout.rotate, 0, 0];

  return {
    depth: layout.depth,
    family: family ?? BODY_FAMILY_SLOTS[0],
    key,
    layerOpacity,
    opacityInput,
    opacityOutput,
    rotateInput: positionInput,
    rotateOutput,
    scaleInput: positionInput,
    scaleOutput,
    size,
    xInput: positionInput,
    xOutput,
    yInput: positionInput,
    yOutput,
  };
}

function shuffleBySeed<T>(items: readonly T[], seed: number) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(seededUnit(seed, index * 131) * (index + 1));
    const current = shuffled[index];

    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = current;
  }

  return shuffled;
}

function createRevealSeed(newborn: Organism) {
  let seed = 2166136261;

  for (let index = 0; index < newborn.organismNumber.length; index += 1) {
    seed ^= newborn.organismNumber.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }

  for (const byte of newborn.genome) {
    seed ^= byte;
    seed = Math.imul(seed, 16777619);
  }

  return seed >>> 0;
}

function seededUnit(seed: number, salt: number) {
  let value = (seed ^ Math.imul(salt + 1, 2654435761)) >>> 0;

  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;

  return ((value >>> 0) % 1000) / 1000;
}

function layerOpacityFor(layer: (typeof FAMILY_LAYER_ORDER)[number]) {
  if (layer === "glow") {
    return 0.76;
  }

  if (layer === "surface" || layer === "tendrils") {
    return 0.84;
  }

  if (layer === "core") {
    return 0.9;
  }

  return 1;
}

function depthStyle(depth: LifeformDepth) {
  if (depth === "background") {
    return styles.backgroundLifeform;
  }

  if (depth === "foreground") {
    return styles.foregroundLifeform;
  }

  return styles.midgroundLifeform;
}

function midpoint(left: number, right: number) {
  return left + (right - left) * 0.5;
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
  screen: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    overflow: "hidden",
    paddingHorizontal: tokens.spacing.xl,
  },
  darkScreen: {
    backgroundColor: "#010304",
  },
  darkBackdrop: {
    backgroundColor: "#010304",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  chamber: {
    bottom: 0,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 0,
  },
  chamberCurrent: {
    backgroundColor: "rgba(112, 188, 194, 0.16)",
    borderRadius: tokens.radii.full,
    height: 360,
    left: "50%",
    marginLeft: -180,
    marginTop: -180,
    position: "absolute",
    shadowColor: tokens.specimen.mint,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 48,
    top: "50%",
    width: 360,
  },
  lifeform: {
    overflow: "visible",
    position: "absolute",
  },
  backgroundLifeform: {
    shadowColor: "#7fdde7",
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  midgroundLifeform: {
    shadowColor: "#9ee9ea",
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  foregroundLifeform: {
    shadowColor: "#d1fbf6",
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
  },
  lifeformCanvas: {
    height: "100%",
    position: "relative",
    width: "100%",
  },
  lifeformLayer: {
    bottom: 0,
    height: "100%",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    width: "100%",
  },
  moustache: {
    position: "absolute",
  },
  convergence: {
    alignItems: "center",
    height: 220,
    justifyContent: "center",
    left: "50%",
    marginLeft: -110,
    marginTop: -110,
    position: "absolute",
    top: "50%",
    width: 220,
  },
  convergenceHalo: {
    borderColor: "rgba(181, 238, 226, 0.28)",
    borderRadius: tokens.radii.full,
    borderWidth: 1,
    height: 154,
    position: "absolute",
    shadowColor: tokens.specimen.mint,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    width: 154,
  },
  convergenceCore: {
    backgroundColor: tokens.specimen.mint,
    borderRadius: tokens.radii.full,
    height: 34,
    position: "absolute",
    shadowColor: tokens.specimen.mint,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.62,
    shadowRadius: 24,
    width: 34,
  },
  convergenceFlash: {
    backgroundColor: "rgba(238, 255, 250, 0.44)",
    borderRadius: tokens.radii.full,
    height: 86,
    position: "absolute",
    shadowColor: "#effffc",
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 30,
    width: 86,
  },
  finalNewborn: {
    left: "50%",
    position: "absolute",
    top: "50%",
  },
  finalCreaturePass: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  birthGlowOuter: {
    backgroundColor: "rgba(129, 224, 221, 0.18)",
    borderRadius: tokens.radii.full,
    left: "50%",
    position: "absolute",
    shadowColor: tokens.specimen.mint,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.34,
    shadowRadius: 46,
    top: "50%",
  },
  birthGlowInternal: {
    backgroundColor: "rgba(232, 255, 250, 0.86)",
    borderRadius: tokens.radii.full,
    left: "50%",
    position: "absolute",
    shadowColor: "#eafffb",
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.66,
    shadowRadius: 26,
    top: "50%",
  },
  birthText: {
    alignItems: "center",
    gap: 9,
    left: tokens.spacing.xl,
    position: "absolute",
    right: tokens.spacing.xl,
  },
  revealFont: {
    fontFamily: "Michroma_400Regular",
    fontWeight: "400",
  },
  itLives: {
    color: tokens.postAuth.primary,
    fontSize: 21,
    fontWeight: "600",
    letterSpacing: 4,
    lineHeight: 28,
    paddingLeft: 4,
    textAlign: "center",
  },
  birthIdentity: {
    color: tokens.postAuth.secondary,
    fontSize: 10,
    fontWeight: "400",
    letterSpacing: 2.2,
    lineHeight: 15,
    paddingLeft: 2.2,
    textAlign: "center",
  },
  pendingOrbStage: {
    alignItems: "center",
    height: 168,
    justifyContent: "center",
    position: "relative",
    width: 168,
  },
  pendingOrbHalo: {
    backgroundColor: "rgba(181, 238, 226, 0.1)",
    borderRadius: tokens.radii.full,
    height: 150,
    opacity: 0.82,
    shadowColor: tokens.specimen.mint,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.42,
    shadowRadius: 26,
    width: 150,
  },
  pendingOrbRing: {
    borderColor: "rgba(181, 238, 226, 0.42)",
    borderRadius: tokens.radii.full,
    borderWidth: 1,
    height: 94,
    position: "absolute",
    width: 94,
  },
  pendingOrbCore: {
    backgroundColor: tokens.specimen.mint,
    borderRadius: tokens.radii.full,
    height: 44,
    position: "absolute",
    shadowColor: tokens.specimen.mint,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.72,
    shadowRadius: 18,
    width: 44,
  },
  copy: {
    alignItems: "center",
    gap: tokens.spacing.sm,
    maxWidth: 340,
    width: "100%",
  },
  title: {
    color: tokens.postAuth.primary,
    textAlign: "center",
  },
  supporting: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
});
