import { StyleSheet, View } from "react-native";

import { AppText } from "../components/AppText";
import { Screen } from "../components/Screen";
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
  text: theme.colors?.text ?? "#F7F2E8",
  muted: theme.colors?.muted ?? theme.colors?.textMuted ?? "#8F897D",
  faint: theme.colors?.faint ?? "rgba(247, 242, 232, 0.52)",
};

const space = {
  xs: theme.spacing?.xs ?? 4,
  sm: theme.spacing?.sm ?? 8,
  md: theme.spacing?.md ?? 12,
  lg: theme.spacing?.lg ?? 16,
  xl: theme.spacing?.xl ?? 24,
  xxl: theme.spacing?.xxl ?? 32,
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
        <View style={styles.content}>
          <View style={styles.state}>
            <AppText style={styles.stateLabel}>SPECIES STATE</AppText>
            <AppText style={styles.stateText}>LOADING SPECIES.</AppText>
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
          <AppText style={styles.populationNumber}>
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
    gap: space.xxl,
    paddingBottom: space.xxl,
    paddingTop: space.xl,
  },
  state: {
    gap: space.sm,
    paddingTop: space.xl,
  },
  stateLabel: {
    color: color.muted,
    fontSize: 11,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  stateText: {
    color: color.text,
    fontSize: 15,
    lineHeight: 22,
  },
  population: {
    gap: space.xs,
    paddingTop: space.xl,
  },
  populationNumber: {
    color: color.text,
    fontSize: 72,
    lineHeight: 78,
  },
  populationLabel: {
    color: color.muted,
    fontSize: 13,
    letterSpacing: 0,
    lineHeight: 18,
    textTransform: "uppercase",
  },
  generation: {
    gap: space.sm,
    paddingTop: space.md,
  },
  sectionLabel: {
    color: color.muted,
    fontSize: 11,
    letterSpacing: 0,
    lineHeight: 16,
    textTransform: "uppercase",
  },
  generationValue: {
    color: color.text,
    fontSize: 22,
    lineHeight: 28,
  },
  origin: {
    gap: space.lg,
    paddingTop: space.xl,
  },
  originRecord: {
    gap: space.xs,
  },
  originName: {
    color: color.text,
    fontSize: 20,
    lineHeight: 26,
  },
  originMeta: {
    color: color.faint,
    fontSize: 13,
    letterSpacing: 0,
    lineHeight: 18,
    textTransform: "uppercase",
  },
  originLine: {
    color: color.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: space.sm,
    textTransform: "uppercase",
  },
  originUnavailable: {
    color: color.muted,
    fontSize: 13,
    lineHeight: 20,
    textTransform: "uppercase",
  },
});
