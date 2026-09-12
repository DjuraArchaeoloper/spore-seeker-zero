import { StyleSheet, View } from "react-native";

import type { BloodlineResponse } from "../auth/api";
import { AppText } from "../components/AppText";
import { Screen } from "../components/Screen";
import { tokens } from "../design/tokens";

type BloodlineScreenProps = {
  bloodline?: BloodlineResponse | null;
  error?: string | null;
  loading?: boolean;
};

type OrganismRecord = Record<string, unknown>;

type LineageEntry = {
  organism: unknown;
  isCurrent: boolean;
  sourceIndex: number;
};

const theme = tokens as {
  colors?: Record<string, string>;
  spacing?: Record<string, number>;
  radii?: Record<string, number>;
};

const color = {
  text: theme.colors?.text ?? "#F7F2E8",
  muted: theme.colors?.muted ?? theme.colors?.textMuted ?? "#8F897D",
  faint: theme.colors?.faint ?? "rgba(247, 242, 232, 0.44)",
  line: theme.colors?.border ?? "rgba(247, 242, 232, 0.18)",
  accent: theme.colors?.accent ?? "#D9D2C3",
};

const space = {
  xs: theme.spacing?.xs ?? 4,
  sm: theme.spacing?.sm ?? 8,
  md: theme.spacing?.md ?? 12,
  lg: theme.spacing?.lg ?? 16,
  xl: theme.spacing?.xl ?? 24,
  xxl: theme.spacing?.xxl ?? 32,
};

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

function formatGeneration(organism: unknown) {
  const generation = getGeneration(organism);

  return generation === null ? "GEN -" : `GEN ${generation}`;
}

function isSeekerZero(organism: unknown) {
  return getOrganismNumber(organism) === 0;
}

function lineageIdentity(organism: unknown) {
  const organismNumber = getOrganismNumber(organism);
  const generation = getGeneration(organism);

  return `${organismNumber ?? "unknown"}:${generation ?? "unknown"}`;
}

function normalizeLineage(bloodline: BloodlineResponse): LineageEntry[] {
  const currentIdentity = lineageIdentity(bloodline.organism);
  const ancestors = Array.isArray(bloodline.ancestors) ? bloodline.ancestors : [];
  const entries = [...ancestors, bloodline.organism].filter(Boolean).map((organism, sourceIndex) => ({
    organism,
    isCurrent: lineageIdentity(organism) === currentIdentity,
    sourceIndex,
  }));

  return entries.sort((first, second) => {
    const firstGeneration = getGeneration(first.organism);
    const secondGeneration = getGeneration(second.organism);

    if (firstGeneration !== null && secondGeneration !== null && firstGeneration !== secondGeneration) {
      return firstGeneration - secondGeneration;
    }

    if (firstGeneration !== null && secondGeneration === null) {
      return -1;
    }

    if (firstGeneration === null && secondGeneration !== null) {
      return 1;
    }

    if (first.isCurrent !== second.isCurrent) {
      return first.isCurrent ? 1 : -1;
    }

    return first.sourceIndex - second.sourceIndex;
  });
}

/*
const previewBloodline: BloodlineResponse = {
  organism: {
    organismPda: "",
    organismNumber: "0",
    sgtMint: "",
    generation: 0,
    genome: "",
    parent: null,
    parentOrganismPda: null,
    bornAt: "",
    coreAsset: ""
  },
  ancestors: [],
  directChildren: [],
  totalDescendants: 0
};

*/
export function BloodlineScreen({ bloodline, error, loading = false }: BloodlineScreenProps) {
  if (loading) {
    return (
      <Screen eyebrow="ANCESTRY" title="Bloodline">
        <View style={styles.bloodlineContent}>
          <View style={styles.bloodlineState}>
            <AppText style={styles.bloodlineStateLabel}>LINEAGE</AppText>
            <AppText style={styles.bloodlineStateText}>LOADING BLOODLINE.</AppText>
          </View>
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen eyebrow="ANCESTRY" title="Bloodline">
        <View style={styles.bloodlineContent}>
          <View style={styles.bloodlineState}>
            <AppText style={styles.bloodlineStateLabel}>BLOODLINE UNAVAILABLE</AppText>
            <AppText style={styles.bloodlineStateText}>{error}</AppText>
          </View>
        </View>
      </Screen>
    );
  }

  if (!bloodline?.organism) {
    return (
      <Screen eyebrow="ANCESTRY" title="Bloodline">
        <View style={styles.bloodlineContent}>
          <View style={styles.bloodlineState}>
            <AppText style={styles.bloodlineStateLabel}>NO BLOODLINE DATA</AppText>
            <AppText style={styles.bloodlineStateText}>LINEAGE RECORD UNAVAILABLE.</AppText>
          </View>
        </View>
      </Screen>
    );
  }

  const renderedLineage = normalizeLineage(bloodline);
  const renderedDirectChildren = Array.isArray(bloodline.directChildren) ? bloodline.directChildren : [];
  const renderedTotalDescendants = bloodline.totalDescendants ?? 0;

  return (
    <Screen eyebrow="ANCESTRY" title="Bloodline">
      <View style={styles.bloodlineContent}>
        <View style={styles.bloodlineSection}>
          <AppText style={styles.bloodlineSectionLabel}>LINEAGE</AppText>
          <View style={styles.bloodlineLineage}>
            {renderedLineage.map((entry, index) => {
              const isLast = index === renderedLineage.length - 1;
              const seekerZero = isSeekerZero(entry.organism);
              const organismNumber = formatOrganismNumber(entry.organism);
              const generation = formatGeneration(entry.organism);
              const primaryLabel = seekerZero ? "SEEKER ZERO" : organismNumber;
              const detailLabel = [seekerZero ? organismNumber : null, generation, entry.isCurrent ? "YOU" : null]
                .filter(Boolean)
                .join(" · ");

              return (
                <View
                  key={`${lineageIdentity(entry.organism)}-${entry.sourceIndex}`}
                  style={[styles.bloodlineLineageRow, isLast && styles.bloodlineLineageRowLast]}
                >
                  <View style={styles.bloodlineNodeColumn}>
                    <View
                      style={[
                        styles.bloodlineNode,
                        seekerZero && styles.bloodlineSeekerNode,
                        entry.isCurrent && styles.bloodlineCurrentNode,
                      ]}
                    >
                      {entry.isCurrent ? <View style={styles.bloodlineCurrentNodeCore} /> : null}
                    </View>
                    {!isLast ? <View style={styles.bloodlineConnector} /> : null}
                  </View>
                  <View style={styles.bloodlineLineageCopy}>
                    <AppText
                      style={[
                        styles.bloodlineLineageName,
                        !entry.isCurrent && !seekerZero && styles.bloodlineLineageNameQuiet,
                        entry.isCurrent && styles.bloodlineLineageNameCurrent,
                      ]}
                    >
                      {primaryLabel}
                    </AppText>
                    <AppText
                      style={[
                        styles.bloodlineLineageMeta,
                        entry.isCurrent && styles.bloodlineLineageMetaCurrent,
                      ]}
                    >
                      {detailLabel}
                    </AppText>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.bloodlineSection}>
          <AppText style={styles.bloodlineSectionLabel}>DIRECT OFFSPRING</AppText>
          {renderedDirectChildren.length > 0 ? (
            <View style={styles.bloodlineChildren}>
              {renderedDirectChildren.map((child, index) => (
                <View key={`${lineageIdentity(child)}-${index}`} style={styles.bloodlineChildRow}>
                  <AppText style={styles.bloodlineChildNumber}>{formatOrganismNumber(child)}</AppText>
                  <AppText style={styles.bloodlineChildGeneration}>{formatGeneration(child)}</AppText>
                </View>
              ))}
            </View>
          ) : (
            <AppText style={styles.bloodlineNoOffspring}>NO OFFSPRING YET.</AppText>
          )}
        </View>

        <View style={styles.bloodlineDescendants}>
          <AppText style={styles.bloodlineDescendantNumber}>{renderedTotalDescendants}</AppText>
          <AppText style={styles.bloodlineDescendantLabel}>TOTAL DESCENDANTS</AppText>
        </View>
      </View>
    </Screen>
  );
  /*
  const organism = bloodline?.organism;
  const lineage = !loading && bloodline ? [...bloodline.ancestors, bloodline.organism] : [];
  const directChildren = bloodline?.directChildren ?? [];

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
          {lineage.length > 0 ? lineage.map((node, index) => (
            <View key={node.organismPda} style={styles.pathItem}>
              <View style={[styles.node, index === 0 && styles.nodeActive, index === lineage.length - 1 && styles.nodeCurrent]} />
              {index < lineage.length - 1 ? <View style={styles.line} /> : null}
            </View>
          )) : (
            <>
              <View style={[styles.node, styles.nodeActive]} />
              <View style={styles.line} />
              <View style={[styles.node, styles.nodeCurrent]} />
            </>
          )}
        </View>

        <View style={styles.labels}>
          <AppText tone="secondary" variant="metadata">
            SEEKER ZERO
          </AppText>
          <AppText tone="secondary" variant="metadata">
            {organism ? `#${organism.organismNumber.padStart(6, "0")}` : "CURRENT"}
          </AppText>
        </View>

        <View style={styles.descendants}>
          <AppText tone="muted" variant="metadata">
            {loading ? "READING" : "DESCENDANTS"}
          </AppText>
          <AppText variant="title">
            {loading
              ? "Indexing lineage"
              : `${bloodline?.totalDescendants ?? 0} total`}
          </AppText>
          <AppText tone="secondary" variant="body">
            {error
              ? error
              : directChildren.length > 0
                ? directChildren.map((child) => `#${child.organismNumber.padStart(6, "0")}`).join(" · ")
                : bloodline
                  ? "No direct children yet."
                  : "Verified lineage pending."}
          </AppText>
        </View>
      </View>
    </Screen>
  );
}

  */
}

const styles = StyleSheet.create({
  bloodlineContent: {
    gap: space.xxl,
    paddingBottom: space.xxl,
  },
  bloodlineSection: {
    gap: space.lg,
  },
  bloodlineSectionLabel: {
    color: color.muted,
    fontSize: 11,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  bloodlineState: {
    gap: space.sm,
    paddingTop: space.xl,
  },
  bloodlineStateLabel: {
    color: color.muted,
    fontSize: 11,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  bloodlineStateText: {
    color: color.text,
    fontSize: 15,
    lineHeight: 22,
  },
  bloodlineLineage: {
    gap: 0,
  },
  bloodlineLineageRow: {
    flexDirection: "row",
    minHeight: 64,
  },
  bloodlineLineageRowLast: {
    minHeight: 42,
  },
  bloodlineNodeColumn: {
    alignItems: "center",
    marginRight: space.md,
    width: 18,
  },
  bloodlineNode: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderColor: color.faint,
    borderRadius: 6,
    borderWidth: 1,
    height: 12,
    justifyContent: "center",
    marginTop: 2,
    width: 12,
  },
  bloodlineSeekerNode: {
    borderColor: color.accent,
  },
  bloodlineCurrentNode: {
    borderColor: color.text,
    borderRadius: 8,
    height: 16,
    width: 16,
  },
  bloodlineCurrentNodeCore: {
    backgroundColor: color.text,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  bloodlineConnector: {
    backgroundColor: color.line,
    flex: 1,
    marginTop: space.xs,
    width: 1,
  },
  bloodlineLineageCopy: {
    flex: 1,
    gap: space.xs,
    paddingBottom: space.lg,
  },
  bloodlineLineageName: {
    color: color.text,
    fontSize: 18,
    lineHeight: 22,
  },
  bloodlineLineageNameQuiet: {
    color: color.muted,
  },
  bloodlineLineageNameCurrent: {
    fontSize: 20,
    lineHeight: 24,
  },
  bloodlineLineageMeta: {
    color: color.muted,
    fontSize: 12,
    letterSpacing: 0,
    lineHeight: 16,
    textTransform: "uppercase",
  },
  bloodlineLineageMetaCurrent: {
    color: color.text,
  },
  bloodlineChildren: {
    gap: space.md,
  },
  bloodlineChildRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 24,
  },
  bloodlineChildNumber: {
    color: color.text,
    fontSize: 16,
    lineHeight: 22,
  },
  bloodlineChildGeneration: {
    color: color.muted,
    fontSize: 12,
    letterSpacing: 0,
    lineHeight: 16,
    textTransform: "uppercase",
  },
  bloodlineNoOffspring: {
    color: color.muted,
    fontSize: 13,
    letterSpacing: 0,
    lineHeight: 18,
    textTransform: "uppercase",
  },
  bloodlineDescendants: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: space.sm,
    paddingTop: space.sm,
  },
  bloodlineDescendantNumber: {
    color: color.text,
    fontSize: 34,
    lineHeight: 38,
  },
  bloodlineDescendantLabel: {
    color: color.muted,
    fontSize: 12,
    letterSpacing: 0,
    lineHeight: 16,
    textTransform: "uppercase",
  },
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
  pathItem: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1
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
