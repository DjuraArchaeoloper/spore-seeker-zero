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
        maxFontSizeMultiplier={specimen ? 1.2 : undefined}
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
    backgroundColor: "rgba(4, 27, 33, 0.54)",
    borderColor: "rgba(165, 237, 248, 0.82)",
    borderRadius: 18,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 12,
    // Uneven inset light uses the same native capability as the auth membrane.
    boxShadow: [
      { offsetX: 7, offsetY: 0, blurRadius: 14, spreadDistance: -3, color: "rgba(131, 230, 242, 0.28)", inset: true },
      { offsetX: -8, offsetY: 0, blurRadius: 12, spreadDistance: -3, color: "rgba(170, 243, 250, 0.35)", inset: true },
      { offsetX: 0, offsetY: 1, blurRadius: 4, spreadDistance: 0, color: "rgba(180, 241, 250, 0.18)", inset: true },
    ],
  },
  specimenDisabled: {
    backgroundColor: "rgba(5, 10, 12, 0.26)",
    borderColor: "rgba(163, 171, 178, 0.16)",
    boxShadow: "none",
  },
  specimenLabel: {
    color: tokens.specimen.primary,
    fontFamily: "Michroma_400Regular",
    includeFontPadding: false,
    fontSize: 12,
    fontWeight: "400",
    letterSpacing: 2.7,
    paddingLeft: 2.7,
    lineHeight: 18,
    textAlign: "center"
  },
  specimenLabelDisabled: {
    color: "rgba(163, 171, 178, 0.54)"
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
