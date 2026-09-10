import { Pressable, StyleSheet, type GestureResponderEvent } from "react-native";

import { tokens } from "../design/tokens";
import { AppText } from "./AppText";

type PrimaryButtonProps = {
  label: string;
  disabled?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
};

export function PrimaryButton({ disabled = false, label, onPress }: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed
      ]}
    >
      <AppText tone={disabled ? "muted" : "primary"} variant="label">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: tokens.colors.accentSoft,
    borderColor: "rgba(184, 230, 210, 0.34)",
    borderRadius: tokens.radii.md,
    borderWidth: tokens.border.width,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: tokens.spacing.xl,
    width: "100%"
  },
  disabled: {
    backgroundColor: "rgba(244, 247, 244, 0.055)",
    borderColor: "rgba(244, 247, 244, 0.12)",
    opacity: 1
  },
  pressed: {
    opacity: tokens.opacity.muted
  }
});
