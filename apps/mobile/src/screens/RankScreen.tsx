import { ScrollView, StyleSheet, View } from "react-native";

import type { SpeciesLeaderboardResponse } from "../auth/api";
import { AppText } from "../components/AppText";
import { Screen } from "../components/Screen";
import { SoftTextScrim } from "../components/SoftTextScrim";
import { SporeLoader } from "../components/SporeLoader";
import { tokens } from "../design/tokens";

type RankScreenProps = {
  leaderboard?: SpeciesLeaderboardResponse | null;
  error?: string | null;
  loading?: boolean;
};

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

function formatOrganismNumber(organismNumber: string) {
  return `#${organismNumber.padStart(6, "0")}`;
}

function formatDescendantLabel(totalDescendants: number) {
  return totalDescendants === 1 ? "DESCENDANT" : "DESCENDANTS";
}

export function RankScreen({
  error,
  leaderboard,
  loading = false,
}: RankScreenProps) {
  const leaders = leaderboard?.leaders.slice(0, 10) ?? [];

  if (loading) {
    return (
      <Screen eyebrow="LINEAGE RANK" title="Rank">
        <SporeLoader mode="screen" label="READING LINEAGES" style={styles.loadingContent} />
      </Screen>
    );
  }

  return (
    <Screen eyebrow="LINEAGE RANK" title="Rank">
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scroller}
      >
        <View style={styles.heading}>
          <AppText style={styles.headingText}>MOST CONTAGIOUS</AppText>
          <AppText style={styles.headingMeta}>TOTAL DESCENDANTS</AppText>
        </View>

        {error ? (
          <RankState label="CONTAGION INDEX UNAVAILABLE" text={error} />
        ) : leaders.length === 0 ? (
          <RankState label="NO LINEAGE HAS SURFACED YET" text="DESCENDANT COUNTS ARE STILL EMERGING." />
        ) : (
          <View style={styles.rows}>
            {leaders.map((leader, index) => (
              <View key={leader.organismNumber} style={styles.row}>
                <AppText style={styles.rank}>{String(index + 1).padStart(2, "0")}</AppText>
                <View style={styles.identity}>
                  <AppText style={styles.organism}>
                    {formatOrganismNumber(leader.organismNumber)}
                  </AppText>
                  <AppText style={styles.generation}>GEN {leader.generation}</AppText>
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
      </ScrollView>
    </Screen>
  );
}

function RankState({ label, text }: { label: string; text: string }) {
  return (
    <View style={styles.state}>
      <SoftTextScrim style={styles.stateScrim} variant="state" />
      <AppText style={styles.stateLabel}>{label}</AppText>
      <AppText style={styles.stateText}>{text}</AppText>
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
  loadingContent: {
    flex: 1,
    justifyContent: "center",
  },
  heading: {
    gap: space.xs,
  },
  headingText: {
    color: color.text,
    fontSize: 30,
    lineHeight: 38,
  },
  headingMeta: {
    ...tokens.postAuth.smallText,
    color: color.soft,
    fontSize: 11,
    letterSpacing: 1.25,
    lineHeight: 17,
    textTransform: "uppercase",
  },
  rows: {
    gap: 0,
  },
  row: {
    alignItems: "center",
    borderTopColor: "rgba(184, 206, 211, 0.12)",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: space.md,
    minHeight: 72,
    paddingVertical: space.md,
  },
  rank: {
    ...tokens.postAuth.smallText,
    color: color.muted,
    fontSize: 11,
    letterSpacing: 1.25,
    lineHeight: 16,
    width: 34,
  },
  identity: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  organism: {
    color: color.text,
    fontSize: 19,
    lineHeight: 25,
  },
  generation: {
    ...tokens.postAuth.smallText,
    color: color.muted,
    fontSize: 10,
    letterSpacing: 1,
    lineHeight: 14,
    textTransform: "uppercase",
  },
  descendants: {
    alignItems: "flex-end",
    gap: 3,
  },
  descendantNumber: {
    color: color.text,
    fontSize: 22,
    lineHeight: 27,
  },
  descendantLabel: {
    ...tokens.postAuth.smallText,
    color: color.soft,
    fontSize: 9,
    letterSpacing: 0.9,
    lineHeight: 13,
    textTransform: "uppercase",
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
});
