import { Pressable, StyleSheet, type GestureResponderEvent } from "react-native";

import { tokens } from "../design/tokens";
import { AppText } from "./AppText";

type PrimaryButtonProps = {
  label: string;
  disabled?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  appearance?: "default" | "specimen";
};

export function PrimaryButton({ disabled = false, label, onPress, appearance = "default" }: PrimaryButtonProps) {
  const specimen = appearance === "specimen";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        specimen && styles.specimen,
        specimen && disabled && styles.specimenDisabled,
        pressed && !disabled && styles.pressed
      ]}
    >
      <AppText
        tone={disabled ? "muted" : "primary"}
        variant="label"
        style={specimen ? [styles.specimenLabel, disabled && styles.specimenLabelDisabled] : undefined}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  specimen: {
    backgroundColor: "rgba(6, 14, 18, 0.64)",
    borderColor: tokens.specimen.outline,
    borderRadius: tokens.radii.full,
    minHeight: 54,
    paddingHorizontal: tokens.spacing.xxl,
    paddingVertical: tokens.spacing.lg
  },
  specimenDisabled: {
    backgroundColor: "rgba(6, 14, 18, 0.48)",
    borderColor: "rgba(181, 238, 226, 0.38)"
  },
  specimenLabel: {
    color: tokens.specimen.primary,
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 3,
    lineHeight: 18,
    textAlign: "center"
  },
  specimenLabelDisabled: {
    color: "#b9c4c6"
  },
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
