import { StyleSheet, View } from "react-native";

import type { SpeciesResponse } from "../auth/api";
import { AppText } from "../components/AppText";
import { Screen } from "../components/Screen";
import { StatRow } from "../components/StatRow";
import { tokens } from "../design/tokens";

type SpeciesScreenProps = {
  species?: SpeciesResponse | null;
  error?: string | null;
  loading?: boolean;
};

const previewSpecies: SpeciesResponse = {
  population: 1,
  deepestGeneration: 0,
  seekerZero: {
    organismPda: "",
    organismNumber: "0",
    sgtMint: "",
    generation: 0,
    genome: "",
    parent: null,
    parentOrganismPda: null,
    bornAt: "",
    coreAsset: ""
  }
};

export function SpeciesScreen({ species = previewSpecies, error, loading = false }: SpeciesScreenProps) {
  const stats = [
    {
      label: "POPULATION",
      value: !loading && species ? String(species.population) : "-",
      detail: loading ? "Reading index" : "Indexed organisms"
    },
    {
      label: "DEEPEST GENERATION",
      value: !loading && species ? String(species.deepestGeneration) : "-",
      detail: loading ? "Reading index" : species?.deepestGeneration === 0 ? "Seeker Zero only" : "Deepest indexed descendant"
    },
    {
      label: "SEEKER ZERO",
      value: !loading && species?.seekerZero ? `#${species.seekerZero.organismNumber.padStart(6, "0")}` : "-",
      detail: loading ? "Reading index" : species?.seekerZero ? `GEN ${species.seekerZero.generation}` : "Not indexed yet"
    }
  ];

  return (
    <Screen eyebrow="GLOBAL STATE" title="Species">
      <View style={styles.content}>
        <View style={styles.stats}>
          {stats.map((stat) => (
            <StatRow detail={stat.detail} key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </View>

        <View style={styles.footer}>
          <AppText tone="muted" variant="metadata">
            {error ?? "SOLANA CANONICAL · INDEXED FOR READING"}
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
