import { ScrollView, StyleSheet, View } from "react-native";

import type {
  SpeciesMapResponse,
  SpeciesResponse,
} from "../auth/api";
import { AppText } from "../components/AppText";
import { Screen } from "../components/Screen";
import { SoftTextScrim } from "../components/SoftTextScrim";
import { SporeLoader } from "../components/SporeLoader";
import { WorldInfectionMap } from "../components/species/WorldInfectionMap";
import { tokens } from "../design/tokens";

type SpreadScreenProps = {
  species?: SpeciesResponse | null;
  speciesMap?: SpeciesMapResponse | null;
  speciesMapError?: string | null;
  speciesMapLoading?: boolean;
  error?: string | null;
  loading?: boolean;
};

type OrganismRecord = Record<string, unknown>;

const theme = tokens as {
  colors?: Record<string, string>;
  spacing?: Record<string, number>;
};

const color = {
  text: tokens.postAuth.primary,
  muted: tokens.postAuth.tertiary,
  soft: tokens.postAuth.secondary,
};

const space = {
  xs: theme.spacing?.xs ?? 4,
  sm: theme.spacing?.sm ?? 8,
  md: theme.spacing?.md ?? 12,
  lg: theme.spacing?.lg ?? 16,
  xl: theme.spacing?.xl ?? 24,
  xxl: theme.spacing?.xxl ?? 32,
  xxxl: theme.spacing?.xxxl ?? 48,
};

function formatPopulation(population: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(population);
}

function readField(organism: unknown, fields: string[]) {
  if (!organism || typeof organism !== "object") {
    return null;
  }

  const record = organism as OrganismRecord;

  for (const field of fields) {
    const value = record[field];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function toNumericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const numeric = value.match(/\d+/)?.[0];

    if (numeric) {
      return Number.parseInt(numeric, 10);
    }
  }

  return null;
}

function getOrganismNumber(organism: unknown) {
  return toNumericValue(
    readField(organism, ["organismNumber", "organism_number", "number", "index", "tokenId", "id"]),
  );
}

function getGeneration(organism: unknown) {
  return toNumericValue(readField(organism, ["generation", "gen"]));
}

function formatOrganismNumber(organism: unknown) {
  const organismNumber = getOrganismNumber(organism);

  if (organismNumber === null) {
    return "#------";
  }

  return `#${organismNumber.toString().padStart(6, "0")}`;
}

function formatGeneration(generation: unknown) {
  const numericGeneration = toNumericValue(generation);

  return numericGeneration === null ? "GEN -" : `GEN ${numericGeneration}`;
}

function formatOrganismGeneration(organism: unknown) {
  return formatGeneration(getGeneration(organism));
}

export function SpreadScreen({
  species,
  speciesMap,
  speciesMapError,
  speciesMapLoading = false,
  error,
  loading = false,
}: SpreadScreenProps) {
  if (loading) {
    return (
      <Screen eyebrow="GLOBAL STATE" title="Spread">
        <SporeLoader mode="screen" label="READING SPREAD" style={styles.loadingContent} />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen eyebrow="GLOBAL STATE" title="Spread">
        <View style={styles.stateContent}>
          <View style={styles.state}>
            <SoftTextScrim style={styles.stateScrim} variant="state" />
            <AppText style={styles.stateLabel}>SPREAD UNAVAILABLE</AppText>
            <AppText style={styles.stateText}>{error}</AppText>
          </View>
        </View>
      </Screen>
    );
  }

  if (!species) {
    return (
      <Screen eyebrow="GLOBAL STATE" title="Spread">
        <View style={styles.stateContent}>
          <View style={styles.state}>
            <SoftTextScrim style={styles.stateScrim} variant="state" />
            <AppText style={styles.stateLabel}>NO SPREAD DATA</AppText>
            <AppText style={styles.stateText}>SPECIES RECORD UNAVAILABLE.</AppText>
          </View>
        </View>
      </Screen>
    );
  }

  const population = typeof species.population === "number" ? species.population : null;
  const deepestGeneration = typeof species.deepestGeneration === "number" ? species.deepestGeneration : null;
  const seekerZero = species.seekerZero;

  return (
    <Screen eyebrow="GLOBAL STATE" title="Spread">
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scroller}
      >
        <View style={styles.population}>
          <AppText adjustsFontSizeToFit minimumFontScale={0.62} numberOfLines={1} style={styles.populationNumber}>
            {population === null ? "-" : formatPopulation(population)}
          </AppText>
          <AppText style={styles.populationLabel}>GLOBAL POPULATION</AppText>
        </View>

        <View style={styles.section}>
          <AppText style={styles.sectionLabel}>WORLD INFECTION MAP</AppText>
          <WorldInfectionMap
            error={speciesMapError}
            loading={speciesMapLoading}
            regions={speciesMap?.regions}
          />
        </View>

        <View style={styles.globalStats}>
          <View style={styles.generation}>
            <AppText style={styles.sectionLabel}>DEEPEST GENERATION</AppText>
            <AppText style={styles.generationValue}>{formatGeneration(deepestGeneration)}</AppText>
          </View>

          <View style={styles.origin}>
            <AppText style={styles.sectionLabel}>ORIGIN</AppText>
            {seekerZero ? (
              <View style={styles.originRecord}>
                <AppText style={styles.originName}>SEEKER ZERO</AppText>
                <AppText style={styles.originMeta}>
                  {formatOrganismNumber(seekerZero)} · {formatOrganismGeneration(seekerZero)}
                </AppText>
                <AppText style={styles.originLine}>THE FIRST SEEKERBORNE CASE.</AppText>
              </View>
            ) : (
              <AppText style={styles.originUnavailable}>ORIGIN RECORD UNAVAILABLE.</AppText>
            )}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroller: {
    flex: 1,
  },
  content: {
    gap: space.xxl,
    paddingBottom: space.xxxl * 2,
    paddingTop: space.lg,
  },
  stateContent: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: space.xxxl,
    paddingTop: space.lg,
  },
  loadingContent: {
    flex: 1,
    justifyContent: "center",
  },
  state: {
    alignSelf: "stretch",
    gap: space.sm,
    overflow: "visible",
    paddingTop: space.xl,
    position: "relative",
  },
  stateScrim: {
    bottom: -18,
    left: -18,
    right: 20,
    top: 6,
  },
  stateLabel: {
    ...tokens.postAuth.smallText,
    color: color.soft,
    fontSize: 12,
    letterSpacing: 1.1,
    lineHeight: 17,
    textTransform: "uppercase",
  },
  stateText: {
    ...tokens.postAuth.smallText,
    color: color.text,
    fontSize: 14,
    letterSpacing: 0.7,
    lineHeight: 20,
    textTransform: "uppercase",
  },
  population: {
    gap: space.sm,
  },
  populationNumber: {
    color: color.text,
    fontSize: 92,
    lineHeight: 98,
  },
  populationLabel: {
    ...tokens.postAuth.smallText,
    color: color.soft,
    fontSize: 12,
    letterSpacing: 1.25,
    lineHeight: 18,
    textTransform: "uppercase",
  },
  generation: {
    gap: space.xs,
  },
  section: {
    gap: space.md,
    paddingTop: space.xs,
  },
  sectionLabel: {
    ...tokens.postAuth.smallText,
    color: color.soft,
    fontSize: 12,
    letterSpacing: 1.25,
    lineHeight: 17,
    textTransform: "uppercase",
  },
  globalStats: {
    gap: space.xxl,
    paddingTop: space.xs,
  },
  generationValue: {
    color: color.text,
    fontSize: 21,
    lineHeight: 27,
  },
  origin: {
    gap: space.md,
  },
  originRecord: {
    gap: 3,
  },
  originName: {
    color: color.text,
    fontSize: 21,
    lineHeight: 27,
  },
  originMeta: {
    ...tokens.postAuth.smallText,
    color: color.muted,
    fontSize: 11,
    letterSpacing: 1,
    lineHeight: 18,
    textTransform: "uppercase",
  },
  originLine: {
    ...tokens.postAuth.smallText,
    color: color.soft,
    fontSize: 12,
    letterSpacing: 0.8,
    lineHeight: 20,
    marginTop: space.md,
    textTransform: "uppercase",
  },
  originUnavailable: {
    ...tokens.postAuth.smallText,
    color: color.soft,
    fontSize: 11,
    letterSpacing: 1,
    lineHeight: 20,
    textTransform: "uppercase",
  },
});
