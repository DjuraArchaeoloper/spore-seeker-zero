import { Canvas, Fill, LinearGradient, vec } from "@shopify/react-native-skia";
import { StyleSheet, useWindowDimensions } from "react-native";

// UI support only: the approved image and all foreground content stay untouched.
export function PostAuthReadabilityVeil() {
  const { height } = useWindowDimensions();
  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Fill>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, height)}
          colors={[
            "rgba(0, 0, 0, 0.26)",
            "rgba(0, 0, 0, 0)",
            "rgba(0, 0, 0, 0)",
            "rgba(0, 0, 0, 0.19)",
          ]}
          positions={[0, 0.34, 0.66, 1]}
        />
      </Fill>
    </Canvas>
  );
}
