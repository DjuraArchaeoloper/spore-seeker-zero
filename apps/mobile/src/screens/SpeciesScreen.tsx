import { StyleSheet, View } from "react-native";

import { AppText } from "../components/AppText";
import { Screen } from "../components/Screen";
import { StatRow } from "../components/StatRow";
import { tokens } from "../design/tokens";

const speciesStats = [
  {
    label: "POPULATION",
    value: "1",
    detail: "Local placeholder"
  },
  {
    label: "DEEPEST GENERATION",
    value: "0",
    detail: "Seeker Zero only"
  },
  {
    label: "MUTATIONS DISCOVERED",
    value: "0",
    detail: "Undiscovered"
  }
];

export function SpeciesScreen() {
  return (
    <Screen eyebrow="GLOBAL STATE" title="Species">
      <View style={styles.content}>
        <View style={styles.stats}>
          {speciesStats.map((stat) => (
            <StatRow detail={stat.detail} key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </View>

        <View style={styles.footer}>
          <AppText tone="muted" variant="metadata">
            LOCAL PLACEHOLDER VALUES
          </AppText>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: "space-between"
  },
  stats: {
    gap: tokens.spacing.md
  },
  footer: {
    borderColor: tokens.colors.border,
    borderTopWidth: tokens.border.width,
    gap: tokens.spacing.sm,
    paddingTop: tokens.spacing.lg
  }
});
