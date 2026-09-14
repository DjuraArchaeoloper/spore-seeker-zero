import { StyleSheet, View } from "react-native";

import { AppText } from "../components/AppText";
import { Screen } from "../components/Screen";
import { SoftTextScrim } from "../components/SoftTextScrim";
import { tokens } from "../design/tokens";

type SpeciesResponse = {
  population?: number | null;
  deepestGeneration?: number | null;
  seekerZero?: unknown | null;
};

type SpeciesScreenProps = {
  species?: SpeciesResponse | null;
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
  faint: tokens.postAuth.tertiary,
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

export function SpeciesScreen({ species, error, loading = false }: SpeciesScreenProps) {
  if (loading) {
    return (
      <Screen eyebrow="GLOBAL STATE" title="Species">
        <View style={[styles.content, styles.loadingContent]}>
          <View style={styles.population}>
            <AppText style={[styles.populationNumber, styles.populationNumberPending]}>-</AppText>
            <AppText style={styles.populationLabel}>POPULATION</AppText>
          </View>

          <View style={styles.generation}>
            <AppText style={styles.sectionLabel}>SPECIES STATE</AppText>
            <AppText style={styles.stateText}>READING SPECIES</AppText>
          </View>
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen eyebrow="GLOBAL STATE" title="Species">
        <View style={styles.content}>
          <View style={styles.state}>
            <SoftTextScrim style={styles.stateScrim} variant="state" />
            <AppText style={styles.stateLabel}>SPECIES UNAVAILABLE</AppText>
            <AppText style={styles.stateText}>{error}</AppText>
          </View>
        </View>
      </Screen>
    );
  }

  if (!species) {
    return (
      <Screen eyebrow="GLOBAL STATE" title="Species">
        <View style={styles.content}>
          <View style={styles.state}>
            <SoftTextScrim style={styles.stateScrim} variant="state" />
            <AppText style={styles.stateLabel}>NO SPECIES DATA</AppText>
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
    <Screen eyebrow="GLOBAL STATE" title="Species">
      <View style={styles.content}>
        <View style={styles.population}>
          <AppText adjustsFontSizeToFit minimumFontScale={0.62} numberOfLines={1} style={styles.populationNumber}>
            {population === null ? "-" : formatPopulation(population)}
          </AppText>
          <AppText style={styles.populationLabel}>POPULATION</AppText>
        </View>

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: space.xxxl,
    justifyContent: "center",
    paddingBottom: space.xxxl,
    paddingTop: space.lg,
  },
  loadingContent: {
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
    fontWeight: "600",
    lineHeight: 98,
  },
  populationNumberPending: {
    color: color.faint,
    fontWeight: "400",
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
  sectionLabel: {
    ...tokens.postAuth.smallText,
    color: color.soft,
    fontSize: 12,
    letterSpacing: 1.25,
    lineHeight: 17,
    textTransform: "uppercase",
  },
  generationValue: {
    color: color.text,
    fontSize: 21,
    fontWeight: "500",
    lineHeight: 27,
  },
  origin: {
    gap: space.md,
    paddingTop: space.sm,
  },
  originRecord: {
    gap: 3,
  },
  originName: {
    color: color.text,
    fontSize: 21,
    fontWeight: "500",
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
