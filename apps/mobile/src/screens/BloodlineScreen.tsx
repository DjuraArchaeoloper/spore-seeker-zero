import { StyleSheet, View } from "react-native";

import { AppText } from "../components/AppText";
import { Screen } from "../components/Screen";
import { tokens } from "../design/tokens";

export function BloodlineScreen() {
  return (
    <Screen eyebrow="ANCESTRY" title="Bloodline">
      <View style={styles.content}>
        <View style={styles.origin}>
          <AppText tone="muted" variant="metadata">
            ORIGIN
          </AppText>
          <AppText variant="title">Seeker Zero</AppText>
          <AppText tone="accent" variant="identifier">
            GEN 0 · #000000
          </AppText>
        </View>

        <View style={styles.path}>
          <View style={[styles.node, styles.nodeActive]} />
          <View style={styles.line} />
          <View style={styles.node} />
          <View style={styles.line} />
          <View style={[styles.node, styles.nodeCurrent]} />
        </View>

        <View style={styles.labels}>
          <AppText tone="secondary" variant="metadata">
            SEEKER ZERO
          </AppText>
          <AppText tone="muted" variant="metadata">
            ...
          </AppText>
          <AppText tone="secondary" variant="metadata">
            CURRENT
          </AppText>
        </View>

        <View style={styles.descendants}>
          <AppText tone="muted" variant="metadata">
            DESCENDANTS
          </AppText>
          <AppText variant="title">No descendants yet</AppText>
          <AppText tone="secondary" variant="body">
            Verified lineage pending.
          </AppText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: tokens.spacing.xl
  },
  origin: {
    backgroundColor: tokens.colors.surfaceSubtle,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.md,
    borderWidth: tokens.border.width,
    gap: tokens.spacing.xs,
    padding: tokens.spacing.lg
  },
  path: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.xl
  },
  node: {
    backgroundColor: tokens.colors.surfaceSubtle,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.full,
    borderWidth: tokens.border.width,
    height: 22,
    width: 22
  },
  nodeActive: {
    backgroundColor: tokens.colors.accentSoft,
    borderColor: tokens.colors.accent
  },
  nodeCurrent: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.textSecondary
  },
  line: {
    backgroundColor: tokens.colors.border,
    flex: 1,
    height: tokens.border.width
  },
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: tokens.spacing.xs
  },
  descendants: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radii.md,
    borderWidth: tokens.border.width,
    gap: tokens.spacing.sm,
    marginTop: "auto",
    minHeight: 150,
    padding: tokens.spacing.lg
  }
});
