import { Pressable, StyleSheet } from "react-native";

import { tokens } from "../design/tokens";
import { AppText } from "./AppText";

type QuietActionProps = {
  disabled?: boolean;
  label: string;
  onPress?: () => void;
};

export function QuietAction({ disabled = false, label, onPress }: QuietActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quietAction,
        disabled && styles.quietActionDisabled,
        pressed && !disabled && styles.quietActionPressed,
      ]}
    >
      <AppText style={styles.quietActionLabel} variant="metadata">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  quietAction: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: tokens.spacing.xl,
  },
  quietActionDisabled: {
    opacity: 0.42,
  },
  quietActionPressed: {
    opacity: tokens.opacity.muted,
  },
  quietActionLabel: {
    color: tokens.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
});
