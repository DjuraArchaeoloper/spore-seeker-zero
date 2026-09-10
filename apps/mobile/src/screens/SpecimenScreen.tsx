import { Platform, StatusBar, StyleSheet, useWindowDimensions, View } from "react-native";
import { SEEKER_ZERO_GENOME_HEX } from "@spore/shared";

import { AppText } from "../components/AppText";
import { OrganismRenderer } from "../components/organism/OrganismRenderer";
import { PrimaryButton } from "../components/PrimaryButton";
import { tokens } from "../design/tokens";

export function SpecimenScreen() {
  const { height, width } = useWindowDimensions();
  const topInset = Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;
  const organismSize = Math.max(380, Math.min(width + 132, height * 0.64, 580));

  return (
    <View style={[styles.screen, { paddingTop: topInset + tokens.spacing.xl }]}>
      <View style={styles.metadata}>
        <AppText tone="muted" variant="identifier">
          GEN 0 · #000000
        </AppText>
      </View>

      <View style={styles.organismStage}>
        <OrganismRenderer genome={SEEKER_ZERO_GENOME_HEX} size={organismSize} />
      </View>

      <View style={styles.footer}>
        <View style={styles.identity}>
          <AppText style={styles.name} variant="title">
            Seeker Zero
          </AppText>
          <View style={styles.readyRow}>
            <View style={styles.readyDot} />
            <AppText tone="secondary" variant="body">
              Spore ready
            </AppText>
          </View>
        </View>

        <PrimaryButton disabled label="RELEASE SPORE" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: tokens.colors.background,
    flex: 1,
    paddingBottom: tokens.spacing.lg,
    paddingHorizontal: tokens.spacing.xl
  },
  metadata: {
    alignItems: "center",
    minHeight: 28
  },
  organismStage: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    marginHorizontal: -tokens.spacing.xl,
    overflow: "visible"
  },
  footer: {
    gap: tokens.spacing.xl
  },
  identity: {
    alignItems: "center",
    gap: tokens.spacing.sm
  },
  name: {
    fontSize: 24,
    lineHeight: 30
  },
  readyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "center"
  },
  readyDot: {
    backgroundColor: tokens.colors.accent,
    borderRadius: tokens.radii.full,
    height: 5,
    opacity: 0.82,
    width: 5
  }
});
