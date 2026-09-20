import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Michroma_400Regular } from "@expo-google-fonts/michroma";
import { Host, Icon } from "@expo/ui";
import { useFonts } from "expo-font";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText } from "../components/AppText";
import { tokens } from "../design/tokens";

export type SurfaceKey = "specimen" | "bloodline" | "spread" | "rank";

type NavigationIconSource = ReturnType<typeof Icon.select>;

const SPECIMEN_ICON = Icon.select({
  ios: "testtube.2",
  android: import("@expo/material-symbols/biotech.xml"),
});

const BLOODLINE_ICON = Icon.select({
  ios: "flowchart",
  android: import("@expo/material-symbols/account_tree.xml"),
});

const SPREAD_ICON = Icon.select({
  ios: "globe",
  android: import("@expo/material-symbols/public.xml"),
});

const RANK_ICON = Icon.select({
  ios: "trophy",
  android: import("@expo/material-symbols/leaderboard.xml"),
});

const surfaces: Array<{ key: SurfaceKey; label: string; icon: NavigationIconSource }> = [
  { key: "specimen", label: "Specimen", icon: SPECIMEN_ICON },
  { key: "bloodline", label: "Bloodline", icon: BLOODLINE_ICON },
  { key: "spread", label: "Spread", icon: SPREAD_ICON },
  { key: "rank", label: "Rank", icon: RANK_ICON },
];

const ACTIVE_TRANSITION = {
  duration: 210,
  easing: Easing.out(Easing.cubic),
};

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
              <ActiveTabEffects active={active} />
              <NavigationIcon active={active} source={surface.icon} />
              <AppText maxFontSizeMultiplier={1.2} variant="metadata" style={[styles.label, active && styles.labelActive]}>
                {surface.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ActiveTabEffects({ active }: { active: boolean }) {
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, ACTIVE_TRANSITION);
  }, [active, progress]);

  const auraStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { scaleX: 0.88 + progress.value * 0.12 },
      { scaleY: 0.92 + progress.value * 0.08 },
    ],
  }));

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scaleX: 0.68 + progress.value * 0.32 }],
  }));

  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.activeAura, auraStyle]} />
      <Animated.View pointerEvents="none" style={[styles.indicator, indicatorStyle]} />
    </>
  );
}

function NavigationIcon({
  active,
  source,
}: {
  active: boolean;
  source: NavigationIconSource;
}) {
  const tint = active ? tokens.postAuth.primary : tokens.postAuth.secondary;
  const opacity = active ? 0.92 : 0.58;

  return (
    <View style={[styles.icon, { opacity }]}>
      <Host matchContents pointerEvents="none" style={styles.iconHost}>
        <Icon name={source} color={tint} size={18} />
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  navigation: {
    flexDirection: "row",
    minHeight: 72,
    paddingHorizontal: tokens.spacing.xl,
  },
  // One shared tray: preserve the approved geometry across tab switches.
  tray: {
    backgroundColor: "rgba(3, 19, 24, 0.64)",
    borderColor: "rgba(135, 221, 234, 0.45)",
    borderRadius: 22,
    borderWidth: 1,
    boxShadow: "0 1px 5px 0 rgba(136, 223, 234, 0.08) inset",
    flex: 1,
    flexDirection: "row",
    minHeight: 54,
    paddingHorizontal: 8,
  },
  item: {
    alignItems: "center",
    flex: 1,
    gap: 2,
    justifyContent: "center",
    paddingTop: 5,
    paddingBottom: 5,
  },
  activeAura: {
    backgroundColor: "rgba(112, 226, 246, 0.035)",
    borderRadius: 28,
    boxShadow: "0 0 18px 8px rgba(112, 226, 246, 0.09)",
    height: 34,
    position: "absolute",
    top: 7,
    width: 62,
  },
  icon: {
    alignItems: "center",
    height: 18,
    justifyContent: "center",
    width: 22,
  },
  iconHost: {
    height: 18,
    width: 18,
  },
  label: {
    ...tokens.postAuth.smallText,
    color: tokens.postAuth.secondary,
    fontFamily: "Michroma_400Regular",
    fontSize: 8,
    fontWeight: "400",
    includeFontPadding: false,
    letterSpacing: 0.8,
    paddingLeft: 1,
    textTransform: "uppercase",
  },
  labelActive: {
    color: tokens.postAuth.primary,
  },
  indicator: {
    backgroundColor: "#b2f6ff",
    borderRadius: 999,
    bottom: 5,
    boxShadow: "0 0 7px 2px rgba(112, 226, 246, 0.42)",
    height: 2,
    position: "absolute",
    width: 24,
  },
  pressed: {
    opacity: tokens.opacity.muted,
  },
});
