import { Platform, StatusBar, StyleSheet, View, type ViewProps } from "react-native";

import { tokens } from "../design/tokens";
import { AppText } from "./AppText";

type ScreenProps = ViewProps & {
  title: string;
  eyebrow?: string;
};

export function Screen({ children, eyebrow, style, title, ...props }: ScreenProps) {
  return (
    <View {...props} style={[styles.screen, style]}>
      <View style={styles.header}>
        {eyebrow ? (
          <AppText tone="muted" variant="metadata">
            {eyebrow}
          </AppText>
        ) : null}
        <AppText variant="title">{title}</AppText>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: tokens.colors.background,
    flex: 1,
    paddingBottom: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: (Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0) + tokens.spacing.xl
  },
  header: {
    gap: tokens.spacing.xs,
    paddingBottom: tokens.spacing.lg
  }
});
