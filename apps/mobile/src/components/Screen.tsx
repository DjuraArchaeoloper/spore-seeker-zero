import { Platform, StatusBar, StyleSheet, View, type ViewProps } from "react-native";

import { tokens } from "../design/tokens";
import { AppText } from "./AppText";
import { AUTH_LOGOUT_RESERVED_WIDTH } from "./AuthenticatedLogoutControl";
import { SoftTextScrim } from "./SoftTextScrim";

type ScreenProps = ViewProps & {
  title: string;
  eyebrow?: string;
};

export function Screen({ children, eyebrow, style, title, ...props }: ScreenProps) {
  return (
    <View {...props} style={[styles.screen, style]}>
      <View style={styles.header}>
        <SoftTextScrim style={styles.headerScrim} variant="header" />
        {eyebrow ? (
          <AppText style={styles.eyebrow} variant="metadata">
            {eyebrow}
          </AppText>
        ) : null}
        <AppText style={styles.title} variant="title">{title}</AppText>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    ...tokens.postAuth.smallText,
    color: tokens.postAuth.tertiary,
    fontSize: 12,
    letterSpacing: 1.25,
    lineHeight: 17,
  },
  title: {
    color: tokens.postAuth.primary,
    letterSpacing: 0.5,
    textShadowColor: "rgba(0, 0, 0, 0.62)",
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 3,
  },
  screen: {
    // backgroundColor: tokens.colors.background,
    flex: 1,
    overflow: "visible",
    paddingBottom: tokens.spacing.xl,
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: (Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0) + tokens.spacing.xl
  },
  header: {
    gap: tokens.spacing.xs,
    overflow: "visible",
    paddingBottom: tokens.spacing.lg,
    paddingRight: AUTH_LOGOUT_RESERVED_WIDTH,
    position: "relative",
  },
  headerScrim: {
    bottom: 4,
    left: -20,
    right: "20%",
    top: -16,
  }
});
