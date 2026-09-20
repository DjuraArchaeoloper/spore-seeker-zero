import { useEffect, useState } from "react";
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

const TAB_COUNT = surfaces.length;
const TRAY_HORIZONTAL_PADDING = 6;
const ACTIVE_SIGNAL_COLOR = "#b2f6ff";
const ACTIVE_SEGMENT_WIDTH = 36;
const ACTIVE_GLOW_WIDTH = 88;

const ACTIVE_TRANSITION = {
  duration: 240,
  easing: Easing.out(Easing.cubic),
};

type BottomNavigationProps = {
  activeSurface: SurfaceKey;
  onSurfaceChange: (surface: SurfaceKey) => void;
};

export function BottomNavigation({ activeSurface, onSurfaceChange }: BottomNavigationProps) {
  const insets = useSafeAreaInsets();
  const [fontsLoaded, fontError] = useFonts({ Michroma_400Regular });
  const [trayWidth, setTrayWidth] = useState(0);
  const activeIndex = Math.max(0, surfaces.findIndex((surface) => surface.key === activeSurface));

  if (fontError) throw fontError;

  return (
    <View style={[styles.navigation, {
      paddingBottom: insets.bottom + 18,
      paddingLeft: Math.max(insets.left, tokens.spacing.lg),
      paddingRight: Math.max(insets.right, tokens.spacing.lg),
      opacity: fontsLoaded ? 1 : 0,
    }]}>
      <View
        onLayout={({ nativeEvent }) => setTrayWidth(nativeEvent.layout.width)}
        style={styles.tray}
      >
        <ActiveTopSignal activeIndex={activeIndex} trayWidth={trayWidth} />
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
              <NavigationIcon active={active} source={surface.icon} />
              <AppText
                maxFontSizeMultiplier={1.2}
                variant="metadata"
                style={[styles.label, active ? styles.labelActive : styles.labelInactive]}
              >
                {surface.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ActiveTopSignal({
  activeIndex,
  trayWidth,
}: {
  activeIndex: number;
  trayWidth: number;
}) {
  const position = useSharedValue(activeIndex);
  const glow = useSharedValue(1);

  useEffect(() => {
    position.value = withTiming(activeIndex, ACTIVE_TRANSITION);
    glow.value = 0.7;
    glow.value = withTiming(1, ACTIVE_TRANSITION);
  }, [activeIndex, glow, position]);

  const signalStyle = useAnimatedStyle(() => {
    const usableWidth = Math.max(0, trayWidth - TRAY_HORIZONTAL_PADDING * 2);
    const tabWidth = usableWidth / TAB_COUNT;
    const centerX =
      TRAY_HORIZONTAL_PADDING +
      tabWidth * position.value +
      tabWidth / 2;

    return {
      opacity: trayWidth > 0 ? 1 : 0,
      transform: [
        { translateX: centerX - ACTIVE_GLOW_WIDTH / 2 },
        { scaleX: 0.98 + glow.value * 0.02 },
      ],
    };
  }, [trayWidth]);

  const nearGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.105 + glow.value * 0.035,
  }));

  const midGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.048 + glow.value * 0.022,
  }));

  const farGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.018 + glow.value * 0.01,
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.activeSignal, signalStyle]}>
      <Animated.View style={[styles.activeGlowFar, farGlowStyle]} />
      <Animated.View style={[styles.activeGlowMid, midGlowStyle]} />
      <Animated.View style={[styles.activeGlowNear, nearGlowStyle]} />
      <View style={styles.activeSegment} />
    </Animated.View>
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
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, ACTIVE_TRANSITION);
  }, [active, progress]);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: 0.58 + progress.value * 0.38,
    transform: [{ translateY: -1 * progress.value }],
  }));

  return (
    <Animated.View style={[styles.icon, iconStyle]}>
      <Host matchContents pointerEvents="none" style={styles.iconHost}>
        <Icon name={source} color={tint} size={18} />
      </Host>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  navigation: {
    flexDirection: "row",
    minHeight: 72,
    paddingHorizontal: tokens.spacing.xl,
  },
  // One shared dock: preserve the approved navigation behavior across tab switches.
  tray: {
    backgroundColor: "rgba(3, 19, 24, 0.64)",
    borderColor: "rgba(135, 221, 234, 0.45)",
    borderRadius: 17,
    borderTopWidth: StyleSheet.hairlineWidth,
    boxShadow: "0 1px 5px 0 rgba(136, 223, 234, 0.08) inset",
    flex: 1,
    flexDirection: "row",
    minHeight: 54,
    overflow: "hidden",
    paddingHorizontal: TRAY_HORIZONTAL_PADDING,
    position: "relative",
  },
  item: {
    alignItems: "center",
    flex: 1,
    gap: 3,
    justifyContent: "center",
    paddingTop: 12,
    paddingBottom: 6,
    position: "relative",
    zIndex: 1,
  },
  activeSignal: {
    alignItems: "center",
    height: 24,
    position: "absolute",
    top: 0,
    width: ACTIVE_GLOW_WIDTH,
    zIndex: 0,
  },
  activeSegment: {
    backgroundColor: ACTIVE_SIGNAL_COLOR,
    borderRadius: 999,
    height: 2,
    width: ACTIVE_SEGMENT_WIDTH,
  },
  activeGlowNear: {
    backgroundColor: ACTIVE_SIGNAL_COLOR,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    height: 9,
    position: "absolute",
    top: 2,
    width: 46,
  },
  activeGlowMid: {
    backgroundColor: ACTIVE_SIGNAL_COLOR,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    height: 17,
    position: "absolute",
    top: 4,
    width: 66,
  },
  activeGlowFar: {
    backgroundColor: ACTIVE_SIGNAL_COLOR,
    borderBottomLeftRadius: 42,
    borderBottomRightRadius: 42,
    height: 25,
    position: "absolute",
    top: 6,
    width: ACTIVE_GLOW_WIDTH,
  },
  icon: {
    alignItems: "center",
    height: 20,
    justifyContent: "center",
    width: 24,
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
  labelInactive: {
    opacity: 0.5,
  },
  labelActive: {
    color: tokens.postAuth.primary,
    opacity: 0.96,
  },
  pressed: {
    opacity: tokens.opacity.muted,
  },
});
