import { Pressable, StyleSheet, View } from "react-native";
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
  return (
    <View style={[styles.navigation, {
      paddingBottom: Math.max(insets.bottom, tokens.spacing.lg),
      paddingLeft: Math.max(insets.left, tokens.spacing.lg),
      paddingRight: Math.max(insets.right, tokens.spacing.lg)
    }]}>
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
            <View style={[styles.indicator, active && styles.indicatorActive]} />
            <AppText variant="metadata" style={[styles.label, active && styles.labelActive]}>
              {surface.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  navigation: {
    flexDirection: "row",
    minHeight: 72,
    paddingBottom: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing.sm
  },
  item: {
    alignItems: "center",
    flex: 1,
    gap: tokens.spacing.xs,
    justifyContent: "center",
    minHeight: 48
  },
  indicator: {
    backgroundColor: "transparent",
    borderRadius: tokens.radii.full,
    height: 4,
    width: 4
  },
  indicatorActive: {
    backgroundColor: tokens.specimen.mint
  },
  label: {
    color: tokens.specimen.secondary,
    fontSize: 10,
    fontWeight: "400",
    letterSpacing: 2,
    lineHeight: 16,
    textTransform: "uppercase"
  },
  labelActive: {
    color: tokens.specimen.primary,
    fontWeight: "600"
  },
  pressed: {
    opacity: tokens.opacity.muted
  }
});
