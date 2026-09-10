import { StyleSheet, Text, type TextProps, type TextStyle } from "react-native";

import { tokens } from "../design/tokens";

type TextVariant = keyof typeof tokens.typography;
type TextTone = "primary" | "secondary" | "muted" | "accent";

type AppTextProps = TextProps & {
  variant?: TextVariant;
  tone?: TextTone;
};

const textColor: Record<TextTone, TextStyle> = {
  primary: { color: tokens.colors.textPrimary },
  secondary: { color: tokens.colors.textSecondary },
  muted: { color: tokens.colors.textMuted },
  accent: { color: tokens.colors.accent }
};

export function AppText({ children, style, tone = "primary", variant = "body", ...props }: AppTextProps) {
  return (
    <Text {...props} style={[styles.base, tokens.typography[variant], textColor[tone], style]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    letterSpacing: 0
  }
});
