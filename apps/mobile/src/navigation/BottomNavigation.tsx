import { Pressable, StyleSheet, View } from "react-native";

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
  return (
    <View style={styles.navigation}>
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
            <AppText tone={active ? "primary" : "muted"} variant="metadata">
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
    backgroundColor: tokens.colors.background,
    flexDirection: "row",
    minHeight: 66,
    paddingBottom: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing.xs
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
    backgroundColor: tokens.colors.accent
  },
  pressed: {
    opacity: tokens.opacity.muted
  }
});
