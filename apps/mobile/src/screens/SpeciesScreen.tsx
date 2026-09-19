import { ScrollView, StyleSheet, View } from "react-native";

import type {
  OutbreakResponse,
  OutbreakSkrPool,
  SpeciesLeaderboardResponse,
  SpeciesMapResponse,
  SpeciesResponse,
} from "../auth/api";
import { AppText } from "../components/AppText";
import { Screen } from "../components/Screen";
import { SoftTextScrim } from "../components/SoftTextScrim";
import { SporeLoader } from "../components/SporeLoader";
import { WorldInfectionMap } from "../components/species/WorldInfectionMap";
import { tokens } from "../design/tokens";

type SpeciesScreenProps = {
  species?: SpeciesResponse | null;
  speciesMap?: SpeciesMapResponse | null;
  speciesMapError?: string | null;
  speciesMapLoading?: boolean;
  leaderboard?: SpeciesLeaderboardResponse | null;
  leaderboardError?: string | null;
  leaderboardLoading?: boolean;
  outbreak?: OutbreakResponse | null;
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

function formatOrganismNumberValue(organismNumber: string) {
  return `#${organismNumber.padStart(6, "0")}`;
}

function formatDescendantLabel(totalDescendants: number) {
  return totalDescendants === 1 ? "DESCENDANT" : "DESCENDANTS";
}

function formatOutbreakSeasonLabel(seasonId: string) {
  const cleaned = seasonId.trim().replace(/[_-]+/g, " ");

  if (!cleaned) {
    return "OUTBREAK";
  }

  if (/^outbreak\b/i.test(cleaned)) {
    return cleaned.toUpperCase();
  }

  if (/^\d+$/.test(cleaned)) {
    return `OUTBREAK ${cleaned.padStart(2, "0")}`;
  }

  const numberedSeason = /^(?:season|outbreak)\s*0*(\d+)$/i.exec(cleaned);

  if (numberedSeason) {
    return `OUTBREAK ${numberedSeason[1].padStart(2, "0")}`;
  }

  return cleaned.toUpperCase();
}

function formatPool(pool: OutbreakSkrPool | undefined) {
  if (!pool) {
    return null;
  }

  if (pool.label) {
    return pool.label.toUpperCase();
  }

  if (pool.totalAmount || pool.tokenMint) {
    return "SEASON POOL CONFIGURED";
  }

  return null;
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

export function SpeciesScreen({
  species,
  speciesMap,
  speciesMapError,
  speciesMapLoading = false,
  leaderboard,
  leaderboardError,
  leaderboardLoading = false,
  outbreak,
  error,
  loading = false,
}: SpeciesScreenProps) {
  if (loading) {
    return (
      <Screen eyebrow="GLOBAL STATE" title="Species">
        <SporeLoader mode="screen" label="READING SPECIES" style={styles.loadingContent} />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen eyebrow="GLOBAL STATE" title="Species">
        <View style={styles.stateContent}>
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
        <View style={styles.stateContent}>
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
  const activeOutbreak = outbreak?.active ? outbreak : null;
  const poolLabel = activeOutbreak ? formatPool(activeOutbreak.season.skrPool) : null;

  return (
    <Screen eyebrow="GLOBAL STATE" title="Species">
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

        {activeOutbreak ? (
          <View style={styles.outbreak}>
            <AppText style={styles.sectionLabel}>
              {formatOutbreakSeasonLabel(activeOutbreak.season.seasonId)}
            </AppText>
            <AppText style={styles.outbreakStatus}>ACTIVE</AppText>
            <AppText style={styles.outbreakMeta}>
              {formatPopulation(activeOutbreak.global.totalPoints)} PTS GENERATED
            </AppText>
            {poolLabel ? <AppText style={styles.outbreakPool}>{poolLabel}</AppText> : null}
          </View>
        ) : null}

        <MostContagious
          error={leaderboardError}
          leaderboard={leaderboard}
          loading={leaderboardLoading}
        />
      </ScrollView>
    </Screen>
  );
}

function MostContagious({
  error,
  leaderboard,
  loading,
}: {
  error?: string | null;
  leaderboard?: SpeciesLeaderboardResponse | null;
  loading?: boolean;
}) {
  const leaders = leaderboard?.leaders ?? [];

  return (
    <View style={styles.leaderboard}>
      <AppText style={styles.sectionLabel}>MOST CONTAGIOUS</AppText>
      {loading ? (
        <AppText style={styles.leaderboardState}>READING LINEAGE SPREAD</AppText>
      ) : error ? (
        <AppText style={styles.leaderboardState}>CONTAGION INDEX UNAVAILABLE</AppText>
      ) : leaders.length === 0 ? (
        <AppText style={styles.leaderboardState}>NO LINEAGE HAS SURFACED YET.</AppText>
      ) : (
        <View style={styles.leaderboardRows}>
          {leaders.map((leader, index) => (
            <View key={leader.organismNumber} style={styles.leaderboardRow}>
              <AppText style={styles.rank}>{String(index + 1).padStart(2, "0")}</AppText>
              <View style={styles.leaderIdentity}>
                <AppText style={styles.leaderNumber}>
                  {formatOrganismNumberValue(leader.organismNumber)}
                </AppText>
                <AppText style={styles.leaderGeneration}>
                  GEN {leader.generation}
                </AppText>
              </View>
              <View style={styles.descendants}>
                <AppText style={styles.descendantNumber}>
                  {formatPopulation(leader.totalDescendants)}
                </AppText>
                <AppText style={styles.descendantLabel}>
                  {formatDescendantLabel(leader.totalDescendants)}
                </AppText>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
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
    fontWeight: "600",
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
    fontWeight: "500",
    lineHeight: 27,
  },
  outbreak: {
    gap: space.xs,
  },
  outbreakStatus: {
    color: color.text,
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 24,
  },
  outbreakMeta: {
    ...tokens.postAuth.smallText,
    color: color.muted,
    fontSize: 11,
    letterSpacing: 1,
    lineHeight: 18,
    textTransform: "uppercase",
  },
  outbreakPool: {
    ...tokens.postAuth.smallText,
    color: color.soft,
    fontSize: 11,
    letterSpacing: 0.9,
    lineHeight: 18,
    textTransform: "uppercase",
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
  leaderboard: {
    gap: space.md,
    paddingTop: space.xs,
  },
  leaderboardState: {
    ...tokens.postAuth.smallText,
    color: color.soft,
    fontSize: 11,
    letterSpacing: 1,
    lineHeight: 18,
    paddingLeft: space.xs,
    textTransform: "uppercase",
  },
  leaderboardRows: {
    gap: 0,
  },
  leaderboardRow: {
    alignItems: "center",
    borderTopColor: "rgba(184, 206, 211, 0.12)",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: space.md,
    minHeight: 54,
    paddingVertical: space.sm,
  },
  rank: {
    ...tokens.postAuth.smallText,
    color: color.muted,
    fontSize: 10,
    letterSpacing: 1.2,
    lineHeight: 15,
    width: 28,
  },
  leaderIdentity: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  leaderNumber: {
    color: color.text,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 21,
  },
  leaderGeneration: {
    ...tokens.postAuth.smallText,
    color: color.muted,
    fontSize: 10,
    letterSpacing: 1,
    lineHeight: 14,
    textTransform: "uppercase",
  },
  descendants: {
    alignItems: "flex-end",
    gap: 2,
  },
  descendantNumber: {
    color: color.text,
    fontSize: 17,
    fontWeight: "500",
    lineHeight: 21,
  },
  descendantLabel: {
    ...tokens.postAuth.smallText,
    color: color.soft,
    fontSize: 9,
    letterSpacing: 0.8,
    lineHeight: 13,
    textTransform: "uppercase",
  },
});
