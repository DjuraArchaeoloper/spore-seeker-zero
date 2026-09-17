import { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Path,
  RadialGradient,
  vec,
} from "@shopify/react-native-skia";
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { tokens } from "../design/tokens";
import { AppText } from "./AppText";

export type SporeLoaderMode = "screen" | "inline" | "button";

type SporeLoaderProps = {
  label?: string;
  mode?: SporeLoaderMode;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

const TWO_PI = Math.PI * 2;
const PRIMARY_MORPH_MS = 1780;
const SECONDARY_MORPH_MS = 2040;
const TERTIARY_MORPH_MS = 2360;
const FIELD_MORPH_MS = 1660;
const LOADER_SIZES = { screen: 44, inline: 28, button: 19 } as const;
const CENTER = vec(50, 50);

const MORPH_PRIMARY =
  "M 50 18 C 61 27 76 33 75 49 C 75 65 58 77 42 72 C 27 67 25 48 34 35 C 39 28 45 22 50 18 Z";
const MORPH_SECONDARY =
  "M 28 48 C 32 31 53 23 67 35 C 79 45 69 63 51 69 C 34 76 24 63 28 48 Z";
const MORPH_TERTIARY =
  "M 51 23 C 65 32 69 54 57 68 C 48 79 31 63 35 46 C 38 32 43 26 51 23 Z";
const MORPH_DEEP =
  "M 42 30 C 57 20 78 39 68 57 C 59 75 36 72 30 55 C 25 41 31 35 42 30 Z";
const CORE_MASS =
  "M 50 31 C 59 38 62 50 56 61 C 51 71 39 64 39 51 C 38 41 43 35 50 31 Z";
const FIELD_COLORS = [
  tokens.postAuth.primary,
  tokens.specimen.mint,
  tokens.colors.accentSoft,
  "rgba(181, 238, 226, 0.02)",
];
const FIELD_STOPS = [0, 0.34, 0.74, 1];
const FIELD_EDGE_COLORS = [
  tokens.postAuth.primary,
  tokens.specimen.mint,
  tokens.specimen.outline,
  tokens.colors.accentSoft,
];
const FIELD_EDGE_STOPS = [0, 0.42, 0.72, 1];
const MORPH_COLORS = [
  tokens.colors.accentSoft,
  tokens.specimen.mint,
  tokens.postAuth.primary,
  tokens.specimen.mint,
  tokens.colors.accentSoft,
];
const MORPH_STOPS = [0, 0.26, 0.5, 0.75, 1];

export function SporeLoader({
  label,
  mode = "inline",
  size,
  style,
}: SporeLoaderProps) {
  const loaderSize = sanitizeSize(size ?? LOADER_SIZES[mode]);
  const reduceMotion = useReducedMotion();

  return (
    <View
      accessibilityLabel={label ?? "SPØR loading"}
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      style={[
        styles.container,
        mode === "screen" && styles.screenContainer,
        style,
      ]}
    >
      <SporeGlyph mode={mode} reduceMotion={reduceMotion} size={loaderSize} />
      {label ? (
        <AppText
          maxFontSizeMultiplier={1.2}
          style={[
            styles.label,
            mode === "screen" && styles.screenLabel,
            mode === "button" && styles.buttonLabel,
          ]}
          variant="metadata"
        >
          {label}
        </AppText>
      ) : null}
    </View>
  );
}

function smoothPulse(phase: number) {
  "worklet";
  const wave = (Math.sin(phase * TWO_PI) + 1) * 0.5;
  return wave * wave * (3 - 2 * wave);
}

function createPhaseLoop(initialPhase: number, durationMs: number) {
  const phase = ((initialPhase % 1) + 1) % 1;
  const duration = Math.max(1, Math.round(durationMs));
  const firstDuration = Math.max(1, Math.round(duration * (1 - phase)));

  return withSequence(
    withTiming(1, {
      duration: firstDuration,
      easing: Easing.linear,
      reduceMotion: ReduceMotion.Never,
    }),
    withTiming(0, {
      duration: 1,
      easing: Easing.linear,
      reduceMotion: ReduceMotion.Never,
    }),
    withRepeat(
      withTiming(1, {
        duration,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.Never,
      }),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    ),
  );
}

const MORPH_A = "M25 25 L75 25 L50 75 Z";
const MORPH_B = "M50 25 L75 75 L25 75 Z";
const MORPH_C = "M35 35 L65 35 L50 65 Z";
const MORPH_D = "M35 65 L65 65 L50 35 Z";

function SporeGlyph({
  mode,
  reduceMotion,
  size,
}: {
  mode: SporeLoaderMode;
  reduceMotion: boolean;
  size: number;
}) {
  const phase = useSharedValue(0);

  const compact = mode === "button";
  const rich = mode === "screen";
  const buttonVisualScale = compact ? 1.13 : 1;

  useEffect(() => {
    phase.value = withRepeat(
      withTiming(1, {
        duration: reduceMotion ? 2400 : 1800,
        easing: Easing.linear,
      }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(phase);
    };
  }, [phase, reduceMotion]);

  const pulse = useDerivedValue(() => {
    return 0.5 - 0.5 * Math.cos(phase.value * TWO_PI);
  });

  const fieldTransform = useDerivedValue(() => [
    {
      scale: 0.985 + pulse.value * 0.035,
    },
  ]);

  const rotationA = useDerivedValue(() => [
    {
      rotate: reduceMotion ? 0.15 : phase.value * TWO_PI,
    },
    {
      scale: compact ? 0.97 + pulse.value * 0.14 : 0.94 + pulse.value * 0.1,
    },
  ], [compact, reduceMotion]);

  const rotationB = useDerivedValue(() => [
    {
      rotate: reduceMotion ? -0.35 : -phase.value * TWO_PI - 0.35,
    },
    {
      scaleX: compact ? 1.1 - pulse.value * 0.11 : 1.05 - pulse.value * 0.08,
    },
    {
      scaleY: compact ? 0.96 + pulse.value * 0.14 : 0.94 + pulse.value * 0.1,
    },
  ], [compact, reduceMotion]);

  const rotationC = useDerivedValue(() => [
    {
      rotate: reduceMotion ? 0.8 : phase.value * TWO_PI * 1.3 + 0.8,
    },
    {
      scale: compact ? 0.95 + pulse.value * 0.14 : 0.88 + pulse.value * 0.16,
    },
  ], [compact, reduceMotion]);

  const rotationD = useDerivedValue(() => [
    {
      rotate: reduceMotion ? -1 : -phase.value * TWO_PI * 0.72 - 1,
    },
    {
      scale: 0.9 + pulse.value * 0.12,
    },
  ]);

  const glowOpacity = useDerivedValue(
    () => (compact ? 0.08 : rich ? 0.16 : 0.12) + pulse.value * 0.1,
    [compact, rich],
  );

  const buttonFieldOpacity = useDerivedValue(() => 0.3 + pulse.value * 0.08);
  const buttonEdgeOpacity = useDerivedValue(() => 0.72 + pulse.value * 0.14);
  const buttonMorphAOpacity = useDerivedValue(() => 0.72 + pulse.value * 0.12);
  const buttonMorphBOpacity = useDerivedValue(() => 0.64 + pulse.value * 0.1);
  const buttonMorphCOpacity = useDerivedValue(() => 0.58 + pulse.value * 0.08);
  const coreOpacity = useDerivedValue(() => compact ? 0.7 + pulse.value * 0.24 : 0.48 + pulse.value * 0.28, [
    compact,
  ]);

  /*
   * CSS reference uses blur(7px) at 100px.
   * Because our whole 100x100 drawing is scaled down,
   * these values naturally become subtle at real loader sizes.
   */
  const morphBlur = compact ? 2.2 : rich ? 6 : 5;

  return (
    <Canvas
      pointerEvents="none"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <Group transform={[{ scale: size / 100 }]}>
        <Group origin={CENTER} transform={[{ scale: buttonVisualScale }]}>
        {/* Outer field */}
        <Group origin={CENTER} transform={fieldTransform}>
          {!compact ? (
            <Circle
              cx={50}
              cy={50}
              r={38}
              color={tokens.specimen.mint}
              opacity={glowOpacity}
            >
              <BlurMask blur={rich ? 8 : 6} style="normal" />
            </Circle>
          ) : null}

          <Circle cx={50} cy={50} r={39} opacity={compact ? buttonFieldOpacity : 0.22}>
            <RadialGradient
              c={CENTER}
              r={41}
              colors={FIELD_COLORS}
              positions={FIELD_STOPS}
            />
          </Circle>

          <Circle
            cx={50}
            cy={50}
            r={39}
            style="stroke"
            strokeWidth={compact ? 1.55 : 1.2}
            opacity={compact ? buttonEdgeOpacity : 0.42}
          >
            <LinearGradient
              start={vec(30, 12)}
              end={vec(70, 88)}
              colors={FIELD_EDGE_COLORS}
              positions={FIELD_EDGE_STOPS}
            />
          </Circle>
        </Group>

        {/* Morphing mass */}
        <Group blendMode="screen">
          <Group origin={CENTER} transform={rotationA}>
            <Path path={MORPH_A} opacity={compact ? buttonMorphAOpacity : 0.58}>
              <LinearGradient
                start={vec(25, 25)}
                end={vec(75, 75)}
                colors={MORPH_COLORS}
                positions={MORPH_STOPS}
              />
              <BlurMask blur={morphBlur} style="normal" />
            </Path>
          </Group>

          <Group origin={CENTER} transform={rotationB}>
            <Path path={MORPH_B} opacity={compact ? buttonMorphBOpacity : 0.5}>
              <LinearGradient
                start={vec(70, 25)}
                end={vec(30, 75)}
                colors={MORPH_COLORS}
                positions={MORPH_STOPS}
              />
              <BlurMask blur={morphBlur} style="normal" />
            </Path>
          </Group>

          <Group origin={CENTER} transform={rotationC}>
            <Path path={MORPH_C} opacity={compact ? buttonMorphCOpacity : 0.48}>
              <LinearGradient
                start={vec(35, 30)}
                end={vec(65, 70)}
                colors={MORPH_COLORS}
                positions={MORPH_STOPS}
              />
              <BlurMask blur={morphBlur * 0.8} style="normal" />
            </Path>
          </Group>

          {!compact ? (
            <Group origin={CENTER} transform={rotationD}>
              <Path path={MORPH_D} opacity={0.34}>
                <LinearGradient
                  start={vec(35, 65)}
                  end={vec(65, 35)}
                  colors={MORPH_COLORS}
                  positions={MORPH_STOPS}
                />
                <BlurMask blur={morphBlur} style="normal" />
              </Path>
            </Group>
          ) : null}

          {/* Small luminous center */}
          <Circle
            cx={50}
            cy={50}
            r={compact ? 7.2 : 6}
            color={tokens.specimen.mint}
            opacity={coreOpacity}
          >
            <BlurMask blur={compact ? 1.1 : 3.5} style="normal" />
          </Circle>
        </Group>
        </Group>
      </Group>
    </Canvas>
  );
}

// function SporeGlyph({ mode, reduceMotion, size }: {
//   mode: SporeLoaderMode;
//   reduceMotion: boolean;
//   size: number;
// }) {
//   const fieldPhase = useSharedValue(0.27);
//   const primaryPhase = useSharedValue(0.08);
//   const secondaryPhase = useSharedValue(0.41);
//   const tertiaryPhase = useSharedValue(0.68);
//   const compact = mode === "button";
//   const rich = mode === "screen";
//   const edgeWidth = Math.max(1.05, (compact ? 0.52 : 0.42) * 100 / size);
//   const morphBlur = compact ? 0 : rich ? 1.55 : 0.95;

//   useEffect(() => {
//     fieldPhase.value = createPhaseLoop(0.27, FIELD_MORPH_MS);
//     primaryPhase.value = createPhaseLoop(0.08, PRIMARY_MORPH_MS);
//     secondaryPhase.value = createPhaseLoop(0.41, SECONDARY_MORPH_MS);
//     tertiaryPhase.value = createPhaseLoop(0.68, TERTIARY_MORPH_MS);

//     return () => {
//       cancelAnimation(fieldPhase);
//       cancelAnimation(primaryPhase);
//       cancelAnimation(secondaryPhase);
//       cancelAnimation(tertiaryPhase);
//     };
//   }, [fieldPhase, primaryPhase, secondaryPhase, tertiaryPhase]);

//   const fieldPulse = useDerivedValue(() => smoothPulse(fieldPhase.value - 0.2));
//   const corePulse = useDerivedValue(() => smoothPulse(primaryPhase.value + 0.15));
//   const fieldTransform = useDerivedValue(() => [
//     { scaleX: 0.982 + 0.04 * fieldPulse.value },
//     { scaleY: 0.992 + 0.026 * fieldPulse.value },
//   ]);
//   const fieldOpacity = useDerivedValue(() => (compact ? 0.24 : 0.2) + 0.08 * fieldPulse.value, [compact]);
//   const fieldEdgeOpacity = useDerivedValue(() => (compact ? 0.64 : 0.48) + 0.2 * fieldPulse.value, [compact]);
//   const fieldGlowOpacity = useDerivedValue(() => (rich ? 0.12 : compact ? 0.04 : 0.075) + 0.07 * corePulse.value, [
//     compact,
//     rich,
//   ]);
//   const primaryTransform = useDerivedValue(() => {
//     const pulse = smoothPulse(primaryPhase.value + 0.06);

//     if (reduceMotion) {
//       return [
//         { rotate: 0.22 },
//         { scaleX: 0.95 + 0.07 * pulse },
//         { scaleY: 0.97 + 0.05 * pulse },
//       ];
//     }

//     return [
//       { rotate: primaryPhase.value * TWO_PI + 0.22 },
//       { scaleX: 0.88 + 0.22 * pulse },
//       { scaleY: 1.08 - 0.12 * pulse },
//       { translateX: Math.sin((primaryPhase.value + 0.18) * TWO_PI) * 1.4 },
//       { translateY: Math.cos((primaryPhase.value + 0.31) * TWO_PI) * 1.0 },
//     ];
//   }, [reduceMotion]);
//   const secondaryTransform = useDerivedValue(() => {
//     const pulse = smoothPulse(secondaryPhase.value + 0.32);

//     if (reduceMotion) {
//       return [
//         { rotate: -0.54 },
//         { scaleX: 0.96 + 0.05 * pulse },
//         { scaleY: 0.95 + 0.06 * pulse },
//       ];
//     }

//     return [
//       { rotate: -secondaryPhase.value * TWO_PI - 0.54 },
//       { scaleX: 1.08 - 0.1 * pulse },
//       { scaleY: 0.88 + 0.2 * pulse },
//       { translateX: Math.cos((secondaryPhase.value + 0.44) * TWO_PI) * 1.2 },
//       { translateY: Math.sin((secondaryPhase.value + 0.08) * TWO_PI) * 1.3 },
//     ];
//   }, [reduceMotion]);
//   const tertiaryTransform = useDerivedValue(() => {
//     const pulse = smoothPulse(tertiaryPhase.value + 0.58);

//     if (reduceMotion) {
//       return [
//         { rotate: 0.86 },
//         { scaleX: 0.94 + 0.06 * pulse },
//         { scaleY: 0.98 + 0.04 * pulse },
//       ];
//     }

//     return [
//       { rotate: tertiaryPhase.value * TWO_PI + 0.86 },
//       { scaleX: 0.92 + 0.18 * pulse },
//       { scaleY: 1.04 - 0.08 * pulse },
//       { translateX: Math.sin((tertiaryPhase.value + 0.61) * TWO_PI) * 0.9 },
//       { translateY: Math.cos((tertiaryPhase.value + 0.17) * TWO_PI) * 1.2 },
//     ];
//   }, [reduceMotion]);
//   const coreTransform = useDerivedValue(() => [
//     { rotate: reduceMotion ? -0.08 : Math.sin((primaryPhase.value + 0.22) * TWO_PI) * 0.18 - 0.08 },
//     { scaleX: 0.82 + 0.2 * corePulse.value },
//     { scaleY: 0.9 + 0.14 * corePulse.value },
//   ], [reduceMotion]);
//   const primaryOpacity = useDerivedValue(() => (compact ? 0.56 : 0.46) + 0.22 * smoothPulse(primaryPhase.value + 0.14), [
//     compact,
//   ]);
//   const secondaryOpacity = useDerivedValue(() => (compact ? 0.48 : 0.38) + 0.18 * smoothPulse(secondaryPhase.value + 0.47), [
//     compact,
//   ]);
//   const tertiaryOpacity = useDerivedValue(() => 0.32 + 0.14 * smoothPulse(tertiaryPhase.value + 0.28));
//   const deepOpacity = useDerivedValue(() => 0.18 + 0.12 * smoothPulse(fieldPhase.value + 0.36));
//   const coreOpacity = useDerivedValue(() => (compact ? 0.58 : 0.46) + 0.3 * corePulse.value, [compact]);
//   const coreGlowOpacity = useDerivedValue(() => (compact ? 0.08 : rich ? 0.18 : 0.12) + 0.12 * corePulse.value, [
//     compact,
//     rich,
//   ]);

//   return (
//     <Canvas pointerEvents="none" style={{ height: size, width: size, flexShrink: 0 }}>
//       <Group transform={[{ scale: size / 100 }]}>
//         <Group origin={CENTER} transform={fieldTransform}>
//           {!compact ? (
//             <Circle color={tokens.specimen.mint} cx={50} cy={50} opacity={fieldGlowOpacity} r={35}>
//               <BlurMask blur={rich ? 4 : 2.4} style="normal" />
//             </Circle>
//           ) : null}
//           <Circle cx={50} cy={50} opacity={fieldOpacity} r={39}>
//             <RadialGradient
//               c={CENTER}
//               r={41}
//               colors={FIELD_COLORS}
//               positions={FIELD_STOPS}
//             />
//           </Circle>
//           <Circle cx={50} cy={50} opacity={fieldEdgeOpacity} r={39} style="stroke" strokeWidth={edgeWidth}>
//             <LinearGradient
//               start={vec(32, 12)}
//               end={vec(69, 88)}
//               colors={FIELD_EDGE_COLORS}
//               positions={FIELD_EDGE_STOPS}
//             />
//           </Circle>
//         </Group>
//         <Group blendMode="screen">
//           <Group origin={CENTER} transform={primaryTransform}>
//             <Path path={MORPH_PRIMARY} opacity={primaryOpacity}>
//               <LinearGradient
//                 start={vec(34, 25)}
//                 end={vec(69, 73)}
//                 colors={MORPH_COLORS}
//                 positions={MORPH_STOPS}
//               />
//               {morphBlur > 0 ? <BlurMask blur={morphBlur} style="normal" /> : null}
//             </Path>
//           </Group>
//           <Group origin={CENTER} transform={secondaryTransform}>
//             <Path path={MORPH_SECONDARY} opacity={secondaryOpacity}>
//               <LinearGradient
//                 start={vec(26, 54)}
//                 end={vec(73, 38)}
//                 colors={MORPH_COLORS}
//                 positions={MORPH_STOPS}
//               />
//               {morphBlur > 0 ? <BlurMask blur={morphBlur} style="normal" /> : null}
//             </Path>
//           </Group>
//           {!compact ? (
//             <Group origin={CENTER} transform={tertiaryTransform}>
//               <Path path={MORPH_TERTIARY} opacity={tertiaryOpacity}>
//                 <LinearGradient
//                   start={vec(44, 25)}
//                   end={vec(58, 73)}
//                   colors={MORPH_COLORS}
//                   positions={MORPH_STOPS}
//                 />
//                 <BlurMask blur={morphBlur} style="normal" />
//               </Path>
//             </Group>
//           ) : null}
//           {rich ? (
//             <Group origin={CENTER} transform={fieldTransform}>
//               <Path path={MORPH_DEEP} color={tokens.specimen.mint} opacity={deepOpacity}>
//                 <BlurMask blur={2.2} style="normal" />
//               </Path>
//             </Group>
//           ) : null}
//           <Group origin={CENTER} transform={coreTransform}>
//             {!compact ? (
//               <Path path={CORE_MASS} color={tokens.specimen.mint} opacity={coreGlowOpacity}>
//                 <BlurMask blur={rich ? 2.6 : 1.5} style="normal" />
//               </Path>
//             ) : null}
//             <Path path={CORE_MASS} opacity={coreOpacity}>
//               <LinearGradient
//                 start={vec(44, 32)}
//                 end={vec(57, 69)}
//                 colors={MORPH_COLORS}
//                 positions={MORPH_STOPS}
//               />
//             </Path>
//           </Group>
//         </Group>
//       </Group>
//     </Canvas>
//   );
// }

function sanitizeSize(value: number) {
  if (!Number.isFinite(value)) return LOADER_SIZES.inline;
  return Math.min(112, Math.max(12, value));
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: tokens.spacing.sm,
    maxWidth: "100%",
  },
  screenContainer: {
    gap: tokens.spacing.md,
    minHeight: 128,
    width: "100%",
  },
  label: {
    ...tokens.postAuth.smallText,
    flexShrink: 1,
    color: tokens.postAuth.secondary,
    fontSize: 10,
    lineHeight: 16,
    textAlign: "left",
    textTransform: "uppercase",
  },
  screenLabel: {
    flexShrink: 0,
    textAlign: "center",
    textTransform: "none",
  },
  buttonLabel: {
    color: tokens.postAuth.primary,
  },
});
