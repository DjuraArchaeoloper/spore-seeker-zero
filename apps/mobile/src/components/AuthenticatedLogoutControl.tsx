import { Michroma_400Regular } from "@expo-google-fonts/michroma";
import { useFonts } from "expo-font";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { tokens } from "../design/tokens";
import { AppText } from "./AppText";
import { SporeLoader } from "./SporeLoader";

export const AUTH_LOGOUT_TOP_OFFSET = 8;
export const AUTH_LOGOUT_HIT_SIZE = 48;
export const AUTH_LOGOUT_RESERVED_WIDTH = 112;
export const AUTH_LOGOUT_TOP_RESERVE = AUTH_LOGOUT_TOP_OFFSET + AUTH_LOGOUT_HIT_SIZE + 8;

type AuthenticatedLogoutControlProps = {
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export function AuthenticatedLogoutControl({
  busy = false,
  disabled = false,
  onPress,
  style,
}: AuthenticatedLogoutControlProps) {
  const [fontsLoaded, fontError] = useFonts({ Michroma_400Regular });
  if (fontError) throw fontError;

  return (
    <Pressable
      accessibilityLabel="Log out of SPØR"
      accessibilityRole="button"
      accessibilityState={{ busy, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.touchTarget,
        style,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        !fontsLoaded && styles.hidden,
      ]}
    >
      {({ pressed }) => (
        <View style={[styles.backing, pressed && !disabled && styles.backingPressed]}>
          {busy ? (
            <SporeLoader mode="button" size={14} />
          ) : (
            <AppText maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.label} variant="metadata">
              LOG OUT
            </AppText>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touchTarget: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: AUTH_LOGOUT_HIT_SIZE,
    minWidth: 90,
    zIndex: 20,
  },
  hidden: {
    opacity: 0,
  },
  disabled: {
    opacity: 0.46,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  backing: {
    alignItems: "center",
    backgroundColor: "rgba(0, 5, 8, 0.58)",
    borderColor: "rgba(247, 251, 251, 0.22)",
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 30,
    paddingHorizontal: 12,
  },
  backingPressed: {
    backgroundColor: "rgba(11, 24, 27, 0.72)",
    borderColor: "rgba(247, 251, 251, 0.34)",
  },
  label: {
    ...tokens.postAuth.smallText,
    color: tokens.postAuth.primary,
    fontFamily: "Michroma_400Regular",
    fontSize: 10,
    fontWeight: "400",
    letterSpacing: 1.15,
    lineHeight: 15,
    paddingLeft: 1.15,
    textAlign: "center",
    textTransform: "uppercase",
  },
});
