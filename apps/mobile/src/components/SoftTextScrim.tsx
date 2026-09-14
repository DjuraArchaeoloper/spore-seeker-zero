import { useState } from "react";
import { Canvas, Fill, RadialGradient, vec } from "@shopify/react-native-skia";
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type SoftTextScrimProps = {
  style?: StyleProp<ViewStyle>;
  variant?: "header" | "state";
};

const SCRIMS = {
  header: {
    centerX: 0.28,
    centerY: 0.48,
    coreAlpha: 0.3,
    midAlpha: 0.14,
    radiusScale: 0.86,
  },
  state: {
    centerX: 0.32,
    centerY: 0.5,
    coreAlpha: 0.28,
    midAlpha: 0.13,
    radiusScale: 0.78,
  },
} as const;

export function SoftTextScrim({
  style,
  variant = "state",
}: SoftTextScrimProps) {
  const [size, setSize] = useState({ height: 0, width: 0 });
  const scrim = SCRIMS[variant];

  function updateSize(event: LayoutChangeEvent) {
    const { height, width } = event.nativeEvent.layout;

    setSize((previous) =>
      previous.height === height && previous.width === width
        ? previous
        : { height, width },
    );
  }

  return (
    <View pointerEvents="none" style={[styles.scrim, style]} onLayout={updateSize}>
      {size.height > 0 && size.width > 0 ? (
        <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Fill>
            <RadialGradient
              c={vec(size.width * scrim.centerX, size.height * scrim.centerY)}
              r={Math.max(size.width, size.height) * scrim.radiusScale}
              colors={[
                `rgba(0, 4, 7, ${scrim.coreAlpha})`,
                `rgba(0, 4, 7, ${scrim.midAlpha})`,
                "rgba(0, 4, 7, 0)",
              ]}
              positions={[0, 0.52, 1]}
            />
          </Fill>
        </Canvas>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    overflow: "visible",
    position: "absolute",
  },
});
