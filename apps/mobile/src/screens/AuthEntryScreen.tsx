import { Michroma_400Regular } from "@expo-google-fonts/michroma";
import {
  BlurMask,
  Canvas,
  Circle,
  Fill,
  Group,
  ImageShader,
  Shader,
  Skia,
  useImage
} from "@shopify/react-native-skia";
import { useFonts } from "expo-font";
import { useEffect, useState } from "react";
import { Image as StaticImage, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import {
  cancelAnimation,
  Easing,
  type SharedValue,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SporeLoader } from "../components/SporeLoader";

type AuthEntryScreenProps = {
  status: "restoring" | "unauthenticated" | "authenticating";
  error?: string | null;
  onEnter: () => void;
};

const TWO_PI = Math.PI * 2;
const AUTH_BACKGROUND_SOURCE = require("../../assets/backgrounds/auth-entry-bg.png");
const UPPER_MEMBRANE_DURATION_MS = 11000;
const LOWER_MEMBRANE_DURATION_MS = 13500;
const REFRACTION_DURATION_MS = 17000;
const UPPER_LIGHT_DURATION_MS = 9000;
const LOWER_LIGHT_DURATION_MS = 13000;
const DETAIL_LIGHT_DURATION_MS = 7500;
const PARTICLE_DRIFT_DURATION_MS = 28000;
const UPPER_MEMBRANE_INITIAL_PHASE = 0.17;
const LOWER_MEMBRANE_INITIAL_PHASE = 0.31;
const REFRACTION_INITIAL_PHASE = 0.46;
const UPPER_LIGHT_INITIAL_PHASE = 0.22;
const LOWER_LIGHT_INITIAL_PHASE = 0.58;
const DETAIL_LIGHT_INITIAL_PHASE = 0.37;
const PARTICLE_DRIFT_INITIAL_PHASE = 0.12;

const BACKGROUND_DEFORMATION_SHADER = Skia.RuntimeEffect.Make(`
uniform shader background;
uniform float2 resolution;
uniform float4 imageRect;
uniform float upperPhase;
uniform float lowerPhase;
uniform float refractPhase;
uniform float upperLightPhase;
uniform float lowerLightPhase;
uniform float detailLightPhase;

const float PI = 3.14159265359;

float ellipseMask(float2 p, float2 center, float2 radius) {
  float2 d = (p - center) / radius;
  return smoothstep(1.0, 0.0, dot(d, d));
}

float softPulse(float2 p, float2 center, float2 radius) {
  float2 d = (p - center) / radius;
  return exp(-dot(d, d) * 2.8);
}

half4 main(float2 xy) {
  float2 uv = xy / resolution;
  float2 imageUv = (xy - imageRect.xy) / imageRect.zw;

  float upperWave = upperPhase * PI * 2.0;
  float lowerWave = lowerPhase * PI * 2.0;
  float refractWave = refractPhase * PI * 2.0;

  float2 upperCenter = float2(0.49, 0.31);
  float2 lowerCenter = float2(0.42, 0.76);
  float upperMembrane = ellipseMask(uv, upperCenter, float2(0.48, 0.29));
  float lowerMembrane = ellipseMask(uv, lowerCenter, float2(0.66, 0.27));
  float leftMembrane = ellipseMask(uv, float2(0.05, 0.49), float2(0.20, 0.43));
  float tissue = clamp(max(max(upperMembrane, lowerMembrane), leftMembrane), 0.0, 1.0);
  float typographyCavity = 1.0 - 0.48 * ellipseMask(uv, float2(0.52, 0.55), float2(0.32, 0.25));

  float2 upperDir = normalize((uv - upperCenter) * float2(1.0, 0.82) + float2(0.0001, 0.0001));
  float upperBreath = sin(upperWave + imageUv.x * 2.4 - imageUv.y * 1.3);
  float upperRipple = sin(upperWave + imageUv.x * 7.0 + imageUv.y * 3.5);

  float lowerBreath = sin(lowerWave - imageUv.x * 3.2 + imageUv.y * 2.7);
  float lowerRipple = cos(lowerWave + imageUv.x * 8.2 - imageUv.y * 4.0);

  float refractA = sin(refractWave + imageUv.x * 5.4 + imageUv.y * 3.1);
  float refractB = cos(refractWave - imageUv.y * 6.2 + imageUv.x * 2.6);

  float2 warp = float2(0.0);
  warp += upperDir * upperMembrane * (upperBreath * 5.3 + upperRipple * 1.55) * typographyCavity;
  warp += float2(lowerBreath * 4.15, lowerRipple * 5.2) * lowerMembrane * typographyCavity;
  warp += float2(refractA * 2.6 + refractB * 1.15, refractB * 2.35 - refractA * 0.9) * tissue * typographyCavity;
  warp += float2(sin(lowerWave + imageUv.y * 9.0) * 2.35, cos(upperWave + imageUv.x * 6.0) * 1.55) * leftMembrane;

  half4 sampled = background.eval(xy - warp);
  float3 rgb = float3(sampled.r, sampled.g, sampled.b);
  float luma = dot(rgb, float3(0.299, 0.587, 0.114));
  float cyanBias = clamp(rgb.g + rgb.b - rgb.r * 1.35, 0.0, 1.0);

  float upperLightWave = upperLightPhase * PI * 2.0;
  float lowerLightWave = lowerLightPhase * PI * 2.0;
  float detailLightWave = detailLightPhase * PI * 2.0;

  float2 upperLightCenter = float2(
    0.49 + sin(upperLightWave) * 0.055,
    0.31 + cos(upperLightWave + PI * 0.18) * 0.038
  );
  float2 lowerLightCenter = float2(
    0.36 + cos(lowerLightWave + PI * 0.29) * 0.075,
    0.74 + sin(lowerLightWave) * 0.032
  );
  float2 detailLightCenter = float2(
    0.73 + sin(detailLightWave + PI * 0.14) * 0.040,
    0.50 + cos(detailLightWave + PI * 0.33) * 0.050
  );

  float upperPulse = softPulse(uv, upperLightCenter, float2(0.18, 0.12)) * upperMembrane;
  float lowerPulse = softPulse(uv, lowerLightCenter, float2(0.20, 0.095)) * lowerMembrane;
  float detailPulse = softPulse(uv, detailLightCenter, float2(0.12, 0.12)) * tissue;
  float tissueGate = smoothstep(0.035, 0.30, luma + cyanBias * 0.06);
  rgb += float3(0.013, 0.091, 0.083) * upperPulse * tissueGate;
  rgb += float3(0.010, 0.068, 0.065) * lowerPulse * tissueGate;
  rgb += float3(0.008, 0.049, 0.052) * detailPulse * tissueGate;

  float edgeGate = smoothstep(0.15, 0.68, luma) * smoothstep(0.12, 0.54, cyanBias) * tissue;
  float shimmer = (0.5 + 0.5 * sin(refractWave + uv.x * 31.0 - uv.y * 17.0))
    * (0.5 + 0.5 * sin(lowerWave + uv.x * 12.0 + uv.y * 23.0));
  rgb += float3(0.005, 0.041, 0.040) * edgeGate * shimmer;

  float3 finalRgb = clamp(rgb, 0.0, 1.0);
  return half4(finalRgb.r, finalRgb.g, finalRgb.b, sampled.a);
}
`);

const LIVING_PARTICLES = [
  { left: 0.19, top: 0.30, size: 1.6, blur: 0.7, opacity: 0.18, driftX: 7, driftY: -18, curve: 3, phase: 0.05 },
  { left: 0.36, top: 0.45, size: 1.3, blur: 0.6, opacity: 0.13, driftX: -6, driftY: -15, curve: 2.4, phase: 0.23 },
  { left: 0.67, top: 0.36, size: 1.9, blur: 0.8, opacity: 0.15, driftX: 5, driftY: -17, curve: 3.2, phase: 0.41 },
  { left: 0.79, top: 0.52, size: 1.5, blur: 0.7, opacity: 0.12, driftX: -6, driftY: -14, curve: 2.6, phase: 0.58 },
  { left: 0.45, top: 0.70, size: 2.7, blur: 1.8, opacity: 0.09, driftX: 9, driftY: -21, curve: 4.4, phase: 0.76 },
  { left: 0.60, top: 0.80, size: 3.8, blur: 2.5, opacity: 0.07, driftX: -8, driftY: -19, curve: 5.2, phase: 0.90 },
];

export function AuthEntryScreen({ error, onEnter, status }: AuthEntryScreenProps) {
  const window = useWindowDimensions();
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null);
  const { width, height } = viewport ?? window;
  const insets = useSafeAreaInsets();
  const [fontsLoaded, fontError] = useFonts({ Michroma_400Regular });
  const reduceMotion = useReducedMotion();
  const disabled = status !== "unauthenticated";
  const authenticating = status === "authenticating";
  const restoring = status === "restoring";

  // The 941 x 1672 mockup's in-device viewport is approximately 741 x 1584
  // at (100, 40). Preserve that crop without the frame. Explicit proportional
  // image dimensions avoid distortion; the artwork has no tint or overlay.
  const artworkScale = Math.max(width / 841, height / 1684);
  const artworkWidth = 941 * artworkScale;
  const artworkHeight = 1672 * artworkScale;
  const artworkLeft = (width - artworkWidth) / 2;
  const artworkTop = (height - artworkHeight) * (40 / 88);
  const scale = Math.min((width - insets.left - insets.right) / 741, height / 1584, 0.75);
  const buttonWidth = Math.min((width - insets.left - insets.right) * 0.75, 420);
  // The reference membrane measures approximately 594 x 110, with 38px corners.
  const buttonScale = buttonWidth / 594;
  const buttonHeight = Math.max(52, 110 * buttonScale);
  const titleTop = Math.max(insets.top + 16, height * (686 / 1584));
  const actionTop = Math.min(
    Math.max(height * (973 / 1584), titleTop + 210 * scale + 32),
    height - insets.bottom - buttonHeight - 24,
  );

  // Never silently finish with substitute typography if the bundled font fails.
  if (fontError) throw fontError;

  return (
    <View
      style={styles.screen}
      onLayout={({ nativeEvent: { layout } }) => {
        setViewport((previous) =>
          previous?.width === layout.width && previous.height === layout.height
            ? previous
            : { width: layout.width, height: layout.height },
        );
      }}
    >
      <AuthLivingBackground
        artworkHeight={artworkHeight}
        artworkLeft={artworkLeft}
        artworkTop={artworkTop}
        artworkWidth={artworkWidth}
        height={height}
        reduceMotion={reduceMotion}
        width={width}
      />
      {restoring ? (
        <View style={styles.authLoading}>
          <SporeLoader mode="screen" label="RESTORING SESSION" />
        </View>
      ) : fontsLoaded ? (
        <>
          <View style={[styles.lockup, { top: titleTop }]}>
            <Text
              accessibilityRole="header"
              maxFontSizeMultiplier={1.2}
              style={[styles.text, styles.title, {
                fontSize: 78 * scale,
                lineHeight: 82 * scale,
                letterSpacing: 22 * scale,
                paddingLeft: 22 * scale,
              }]}
            >
              SPOR
            </Text>
            <Text maxFontSizeMultiplier={1.2} style={[styles.text, styles.secondary, {
              marginTop: 12 * scale,
              fontSize: 26 * scale,
              lineHeight: 30 * scale,
              letterSpacing: 9 * scale,
              paddingLeft: 9 * scale,
            }]}>
              SEEKER ZERO
            </Text>
            <Text maxFontSizeMultiplier={1.2} style={[styles.text, styles.secondary, {
              marginTop: 23 * scale,
              fontSize: 15 * scale,
              lineHeight: 24 * scale,
              letterSpacing: 5 * scale,
              paddingLeft: 5 * scale,
            }]}>
              THE SPECIES DOESN'T END HERE.
            </Text>
          </View>
          <View style={[styles.action, { top: actionTop, width: buttonWidth }]}>
            {error ? (
              <Text
                accessibilityLiveRegion="polite"
                maxFontSizeMultiplier={1.2}
                style={[styles.text, styles.error, { bottom: buttonHeight + 16 }]}
              >
                SEEKER VERIFICATION FAILED.
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="ENTER SPOR"
              accessibilityState={{ disabled, busy: disabled }}
              accessibilityValue={{ text: authenticating ? "Verifying Seeker" : "Ready" }}
              disabled={disabled}
              onPress={onEnter}
              style={({ pressed }) => [styles.button, {
                height: buttonHeight,
                borderRadius: 38 * buttonScale,
                borderWidth: 1.5 * buttonScale,
                // Reference-pixel edge lighting scales with the membrane itself.
                boxShadow: [
                  { offsetX: 12 * buttonScale, offsetY: 0, blurRadius: 24 * buttonScale, spreadDistance: -4 * buttonScale, color: "rgba(136, 235, 220, 0.30)", inset: true },
                  { offsetX: -14 * buttonScale, offsetY: 0, blurRadius: 24 * buttonScale, spreadDistance: -4 * buttonScale, color: "rgba(149, 243, 227, 0.38)", inset: true },
                  { offsetX: 0, offsetY: 2 * buttonScale, blurRadius: 8 * buttonScale, spreadDistance: 0, color: "rgba(156, 237, 222, 0.24)", inset: true },
                  { offsetX: 0, offsetY: -1 * buttonScale, blurRadius: 6 * buttonScale, spreadDistance: 0, color: "rgba(111, 224, 207, 0.12)" },
                ],
                opacity: authenticating ? 0.86 : disabled ? 0.35 : pressed ? 0.88 : 1,
              }]}
            >
              {authenticating ? (
                <View style={styles.buttonPendingRow}>
                  <SporeLoader mode="button" size={Math.max(17, 24 * buttonScale)} />
                  <Text maxFontSizeMultiplier={1.2} style={[styles.text, styles.buttonText, {
                    fontSize: 24 * buttonScale,
                    lineHeight: 34 * buttonScale,
                    letterSpacing: 3.6 * buttonScale,
                    paddingLeft: 3.6 * buttonScale,
                  }]}>
                    VERIFYING
                  </Text>
                </View>
              ) : (
                <Text maxFontSizeMultiplier={1.2} style={[styles.text, styles.buttonText, {
                  fontSize: 34 * buttonScale,
                  lineHeight: 46 * buttonScale,
                  letterSpacing: 4.5 * buttonScale,
                  paddingLeft: 4.5 * buttonScale,
                }]}>
                  ENTER
                </Text>
              )}
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}

function AuthLivingBackground({
  artworkHeight,
  artworkLeft,
  artworkTop,
  artworkWidth,
  height,
  reduceMotion,
  width
}: {
  artworkHeight: number;
  artworkLeft: number;
  artworkTop: number;
  artworkWidth: number;
  height: number;
  reduceMotion: boolean;
  width: number;
}) {
  const backgroundImage = useImage(AUTH_BACKGROUND_SOURCE);
  const backgroundShader = BACKGROUND_DEFORMATION_SHADER;
  const upperPhase = useLoopingPhase(UPPER_MEMBRANE_DURATION_MS, reduceMotion, UPPER_MEMBRANE_INITIAL_PHASE);
  const lowerPhase = useLoopingPhase(LOWER_MEMBRANE_DURATION_MS, reduceMotion, LOWER_MEMBRANE_INITIAL_PHASE);
  const refractPhase = useLoopingPhase(REFRACTION_DURATION_MS, reduceMotion, REFRACTION_INITIAL_PHASE);
  const upperLightPhase = useLoopingPhase(UPPER_LIGHT_DURATION_MS, reduceMotion, UPPER_LIGHT_INITIAL_PHASE);
  const lowerLightPhase = useLoopingPhase(LOWER_LIGHT_DURATION_MS, reduceMotion, LOWER_LIGHT_INITIAL_PHASE);
  const detailLightPhase = useLoopingPhase(DETAIL_LIGHT_DURATION_MS, reduceMotion, DETAIL_LIGHT_INITIAL_PHASE);
  const particlePhase = useLoopingPhase(PARTICLE_DRIFT_DURATION_MS, reduceMotion, PARTICLE_DRIFT_INITIAL_PHASE);
  const shaderUniforms = useDerivedValue(() => ({
    resolution: [width, height],
    imageRect: [artworkLeft, artworkTop, artworkWidth, artworkHeight],
    upperPhase: upperPhase.value,
    lowerPhase: lowerPhase.value,
    refractPhase: refractPhase.value,
    upperLightPhase: upperLightPhase.value,
    lowerLightPhase: lowerLightPhase.value,
    detailLightPhase: detailLightPhase.value,
  }), [
    artworkHeight,
    artworkLeft,
    artworkTop,
    artworkWidth,
    height,
    width,
  ]);

  if (!backgroundImage || !backgroundShader) {
    return (
      <StaticImage
        accessible={false}
        fadeDuration={0}
        source={AUTH_BACKGROUND_SOURCE}
        resizeMode="stretch"
        style={{
          position: "absolute",
          width: artworkWidth,
          height: artworkHeight,
          left: artworkLeft,
          top: artworkTop,
        }}
      />
    );
  }

  return (
    <Canvas pointerEvents="none" style={[styles.backgroundCanvas, { height, width }]}>
      <Fill color="#020b0e" />
      <Fill>
        <Shader source={backgroundShader} uniforms={shaderUniforms}>
          <ImageShader
            fit="fill"
            height={artworkHeight}
            image={backgroundImage}
            tx="clamp"
            ty="clamp"
            width={artworkWidth}
            x={artworkLeft}
            y={artworkTop}
          />
        </Shader>
      </Fill>
      {LIVING_PARTICLES.map((particle, index) => (
        <LivingParticle
          key={`auth-living-particle-${index}`}
          height={height}
          particle={particle}
          phase={particlePhase}
          reduceMotion={reduceMotion}
          width={width}
        />
      ))}
    </Canvas>
  );
}

function useLoopingPhase(durationMs: number, reduceMotion: boolean, initialPhase: number) {
  const phase = useSharedValue(initialPhase);

  useEffect(() => {
    cancelAnimation(phase);
    const startPhase = ((initialPhase % 1) + 1) % 1;

    if (reduceMotion) {
      phase.value = 0;
      return;
    }

    phase.value = startPhase;
    phase.value = withSequence(
      withTiming(1, { duration: durationMs * (1 - startPhase), easing: Easing.linear }),
      withTiming(0, { duration: 1, easing: Easing.linear }),
      withRepeat(
        withSequence(
          withTiming(1, { duration: durationMs, easing: Easing.linear }),
          withTiming(0, { duration: 1, easing: Easing.linear }),
        ),
        -1,
      ),
    );

    return () => {
      cancelAnimation(phase);
    };
  }, [durationMs, initialPhase, phase, reduceMotion]);

  return phase;
}

function LivingParticle({
  height,
  particle,
  phase,
  reduceMotion,
  width
}: {
  height: number;
  particle: (typeof LIVING_PARTICLES)[number];
  phase: SharedValue<number>;
  reduceMotion: boolean;
  width: number;
}) {
  const { blur, curve, driftX, driftY, left, opacity, phase: phaseOffset, size, top } = particle;
  const viewportScale = Math.min(Math.max(width / 390, 0.9), 1.16);
  const radius = size * viewportScale;
  const cx = useDerivedValue(() => {
    if (reduceMotion) {
      return width * left;
    }

    const wave = (phase.value + phaseOffset) * TWO_PI;
    return width * left + Math.sin(wave) * driftX + Math.cos(wave + Math.PI * 0.31) * curve;
  }, [curve, driftX, left, phaseOffset, reduceMotion, width]);
  const cy = useDerivedValue(() => {
    if (reduceMotion) {
      return height * top;
    }

    const wave = (phase.value + phaseOffset) * TWO_PI;
    return height * top + Math.cos(wave + Math.PI * 0.18) * driftY + Math.sin(wave + Math.PI * 0.62) * curve;
  }, [curve, driftY, height, phaseOffset, reduceMotion, top]);
  const particleOpacity = useDerivedValue(() => {
    if (reduceMotion) {
      return 0;
    }

    const wave = (phase.value + phaseOffset) * TWO_PI;
    const visibility = (Math.sin(wave + Math.PI * 0.42) + 1) * 0.5;
    return opacity * (0.18 + visibility * 0.82);
  }, [opacity, phaseOffset, reduceMotion]);

  return (
    <Group blendMode="screen" opacity={particleOpacity}>
      <Circle color="rgba(93, 241, 225, 0.34)" cx={cx} cy={cy} r={radius}>
        <BlurMask blur={blur * viewportScale} style="normal" />
      </Circle>
      <Circle color="rgba(218, 255, 252, 0.68)" cx={cx} cy={cy} r={radius * 0.28} />
    </Group>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#020b0e", overflow: "hidden" },
  backgroundCanvas: { position: "absolute", left: 0, top: 0 },
  authLoading: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  lockup: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  text: { fontFamily: "Michroma_400Regular", includeFontPadding: false, textAlign: "center" },
  title: { color: "#f4f8f8" },
  secondary: { color: "#819ea8" },
  action: { position: "absolute", alignSelf: "center" },
  button: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 39, 43, 0.24)",
    borderColor: "rgba(164, 235, 229, 0.76)",
    borderTopColor: "rgba(184, 248, 238, 0.86)",
    borderRightColor: "rgba(176, 243, 232, 0.92)",
    borderBottomColor: "rgba(139, 212, 209, 0.72)",
  },
  buttonPendingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
  },
  buttonText: { color: "#f4f8f8" },
  error: { position: "absolute", left: -16, right: -16, color: "#819ea8", fontSize: 9, lineHeight: 16, letterSpacing: 1 },
});
