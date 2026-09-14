import { Pressable, StyleSheet, View } from "react-native";
import { Michroma_400Regular } from "@expo-google-fonts/michroma";
import { useFonts } from "expo-font";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "../components/AppText";
import { tokens } from "../design/tokens";

export type SurfaceKey = "specimen" | "bloodline" | "species";

const surfaces: Array<{ key: SurfaceKey; label: string }> = [
  { key: "specimen", label: "Specimen" },
  { key: "bloodline", label: "Bloodline" },
  { key: "species", label: "Species" }
];

type BottomNavigationProps = {
  activeSurface: SurfaceKey;
  onSurfaceChange: (surface: SurfaceKey) => void;
};

export function BottomNavigation({ activeSurface, onSurfaceChange }: BottomNavigationProps) {
  const insets = useSafeAreaInsets();
  const [fontsLoaded, fontError] = useFonts({ Michroma_400Regular });
  if (fontError) throw fontError;
  return (
    <View style={[styles.navigation, {
      paddingBottom: insets.bottom + 18,
      paddingLeft: Math.max(insets.left, tokens.spacing.lg),
      paddingRight: Math.max(insets.right, tokens.spacing.lg),
      opacity: fontsLoaded ? 1 : 0,
    }]}>
      <View style={styles.tray}>
      {surfaces.map((surface) => {
        const active = surface.key === activeSurface;

        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={surface.key}
            onPress={() => onSurfaceChange(surface.key)}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <AppText maxFontSizeMultiplier={1.2} variant="metadata" style={[styles.label, active && styles.labelActive]}>
              {surface.label}
            </AppText>
            <View style={[styles.indicator, active && styles.indicatorActive]} />
          </Pressable>
        );
      })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navigation: {
    flexDirection: "row",
    minHeight: 72,
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: 8,
  },
  // One shared tray: preserve the approved geometry across tab switches.
  tray: {
    flexDirection: "row",
    flex: 1,
    minHeight: 50,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(135, 221, 234, 0.45)",
    backgroundColor: "rgba(3, 19, 24, 0.64)",
    paddingHorizontal: 8,
    boxShadow: "0 1px 5px 0 rgba(136, 223, 234, 0.08) inset",
  },
  item: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 50,
    paddingTop: 4,
    gap: 0,
  },
  label: {
    ...tokens.postAuth.smallText,
    fontFamily: "Michroma_400Regular",
    includeFontPadding: false,
    fontSize: 9,
    fontWeight: "400",
    letterSpacing: 1,
    paddingLeft: 1,
    color: tokens.postAuth.secondary,
    lineHeight: 16,
    textTransform: "uppercase",
  },
  labelActive: {
    color: tokens.postAuth.primary,
  },
  indicator: {
    position: "absolute",
    bottom: 9,
    width: 40,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: "transparent",
  },
  indicatorActive: {
    backgroundColor: "#b2f6ff",
    boxShadow: "0 0 4px 1px rgba(112, 226, 246, 0.4)",
  },
  pressed: {
    opacity: tokens.opacity.muted
  }
});
