import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { tokens } from "../design/tokens";
import { openSporeLegalDocument } from "../legal";
import { AppText } from "./AppText";
import { SporeLoader } from "./SporeLoader";

export const AUTH_LOGOUT_TOP_OFFSET = 8;
export const AUTH_LOGOUT_HIT_SIZE = 48;
export const AUTH_LOGOUT_RESERVED_WIDTH = 168;
export const AUTH_LOGOUT_TOP_RESERVE = AUTH_LOGOUT_TOP_OFFSET + AUTH_LOGOUT_HIT_SIZE + 20;

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
  return (
    <View style={[styles.control, style]}>
      <Pressable
        accessibilityLabel="Log out of SPØR"
        accessibilityRole="button"
        accessibilityState={{ busy, disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.touchTarget,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
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
      <View style={styles.legalRow}>
        <LegalLink
          label="TERMS"
          accessibilityLabel="Open Terms of Service"
          onPress={() => {
            void openSporeLegalDocument("terms");
          }}
        />
        <AppText maxFontSizeMultiplier={1.15} style={styles.legalDivider} variant="metadata">
          ·
        </AppText>
        <LegalLink
          label="PRIVACY"
          accessibilityLabel="Open Privacy Policy"
          onPress={() => {
            void openSporeLegalDocument("privacy");
          }}
        />
        <AppText maxFontSizeMultiplier={1.15} style={styles.legalDivider} variant="metadata">
          ·
        </AppText>
        <LegalLink
          label="DATA DELETION"
          accessibilityLabel="Open Data Deletion"
          onPress={() => {
            void openSporeLegalDocument("dataDeletion");
          }}
        />
      </View>
    </View>
  );
}

function LegalLink({
  accessibilityLabel,
  label,
  onPress,
}: {
  accessibilityLabel: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [
        styles.legalTouchTarget,
        pressed && styles.legalPressed,
      ]}
    >
      <AppText maxFontSizeMultiplier={1.15} numberOfLines={1} style={styles.legalLabel} variant="metadata">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  control: {
    alignItems: "center",
    minWidth: AUTH_LOGOUT_RESERVED_WIDTH,
    zIndex: 20,
  },
  touchTarget: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: AUTH_LOGOUT_HIT_SIZE,
    minWidth: 90,
    zIndex: 20,
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
    fontSize: 10,
    letterSpacing: 1.15,
    lineHeight: 15,
    paddingLeft: 1.15,
    textAlign: "center",
    textTransform: "uppercase",
  },
  legalRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginTop: -3,
  },
  legalTouchTarget: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 22,
    paddingHorizontal: 2,
  },
  legalPressed: {
    opacity: tokens.opacity.muted,
  },
  legalLabel: {
    ...tokens.postAuth.smallText,
    color: tokens.postAuth.tertiary,
    fontSize: 8,
    letterSpacing: 0.8,
    lineHeight: 12,
    paddingLeft: 0.8,
    textAlign: "center",
    textTransform: "uppercase",
  },
  legalDivider: {
    ...tokens.postAuth.smallText,
    color: "rgba(135, 161, 168, 0.42)",
    fontSize: 8,
    lineHeight: 12,
    paddingHorizontal: 1,
  },
});
