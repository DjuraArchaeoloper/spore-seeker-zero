import { StyleSheet, View } from "react-native";

import type { BloodlineResponse } from "../auth/api";
import { AppText } from "../components/AppText";
import { Screen } from "../components/Screen";
import { SoftTextScrim } from "../components/SoftTextScrim";
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
  text: tokens.postAuth.primary,
  muted: tokens.postAuth.tertiary,
  soft: tokens.postAuth.secondary,
  line: theme.colors?.border ?? "rgba(247, 242, 232, 0.18)",
  accent: theme.colors?.accent ?? "#D9D2C3",
  accentFaint: theme.colors?.accentSoft ?? "rgba(184, 230, 210, 0.14)",
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
          <View style={styles.bloodlineSection}>
            <AppText style={styles.bloodlineSectionLabel}>LINEAGE</AppText>
            <View style={styles.bloodlineLineage}>
              <View style={styles.bloodlineLineageRow}>
                <View style={styles.bloodlineNodeColumn}>
                  <View style={[styles.bloodlineNode, styles.bloodlineNodeDim]} />
                  <View style={styles.bloodlineConnector} />
                </View>
                <View style={styles.bloodlineLineageCopy}>
                  <AppText style={styles.bloodlineStateText}>READING LINEAGE</AppText>
                </View>
              </View>
              <View style={[styles.bloodlineLineageRow, styles.bloodlineLineageRowLast]}>
                <View style={styles.bloodlineNodeColumn}>
                  <View style={[styles.bloodlineNode, styles.bloodlineCurrentNode, styles.bloodlineNodeDim]} />
                </View>
                <View style={styles.bloodlineLineageCopy} />
              </View>
            </View>
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
            <SoftTextScrim style={styles.bloodlineStateScrim} variant="state" />
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
            <SoftTextScrim style={styles.bloodlineStateScrim} variant="state" />
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
              {renderedDirectChildren.map((child, index) => {
                const isLast = index === renderedDirectChildren.length - 1;

                return (
                  <View key={`${lineageIdentity(child)}-${index}`} style={styles.bloodlineChildRow}>
                    <View style={styles.bloodlineChildNodeColumn}>
                      <View style={styles.bloodlineChildNode} />
                      {!isLast ? <View style={styles.bloodlineChildConnector} /> : null}
                    </View>
                    <View style={styles.bloodlineChildCopy}>
                      <AppText style={styles.bloodlineChildNumber}>{formatOrganismNumber(child)}</AppText>
                      <AppText style={styles.bloodlineChildGeneration}>{formatGeneration(child)}</AppText>
                    </View>
                  </View>
                );
              })}
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
    gap: space.xl,
    paddingBottom: space.xxl,
  },
  bloodlineSection: {
    gap: space.md,
  },
  bloodlineSectionLabel: {
    ...tokens.postAuth.smallText,
    color: color.soft,
    fontSize: 12,
    letterSpacing: 1.25,
    lineHeight: 17,
    textTransform: "uppercase",
  },
  bloodlineState: {
    alignSelf: "stretch",
    gap: space.sm,
    overflow: "visible",
    paddingTop: space.xl,
    position: "relative",
  },
  bloodlineStateScrim: {
    bottom: -18,
    left: -18,
    right: 20,
    top: 6,
  },
  bloodlineStateLabel: {
    ...tokens.postAuth.smallText,
    color: color.soft,
    fontSize: 12,
    letterSpacing: 1.1,
    lineHeight: 17,
    textTransform: "uppercase",
  },
  bloodlineStateText: {
    ...tokens.postAuth.smallText,
    color: color.text,
    fontSize: 14,
    letterSpacing: 0.7,
    lineHeight: 20,
    textTransform: "uppercase",
  },
  bloodlineLineage: {
    gap: 0,
    paddingTop: space.xs,
  },
  bloodlineLineageRow: {
    flexDirection: "row",
    minHeight: 68,
  },
  bloodlineLineageRowLast: {
    minHeight: 48,
  },
  bloodlineNodeColumn: {
    alignItems: "center",
    marginRight: space.md,
    width: 18,
  },
  bloodlineNode: {
    alignItems: "center",
    backgroundColor: "transparent",
    borderColor: "rgba(178, 188, 182, 0.28)",
    borderRadius: 5,
    borderWidth: 1,
    height: 10,
    justifyContent: "center",
    marginTop: 4,
    width: 10,
  },
  bloodlineSeekerNode: {
    borderColor: "rgba(184, 230, 210, 0.42)",
  },
  bloodlineCurrentNode: {
    backgroundColor: color.accentFaint,
    borderColor: color.accent,
    borderRadius: 9,
    height: 18,
    marginTop: 0,
    shadowColor: color.accent,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    width: 18,
  },
  bloodlineCurrentNodeCore: {
    backgroundColor: color.accent,
    borderRadius: 4,
    height: 6,
    width: 6,
  },
  bloodlineNodeDim: {
    opacity: 0.46,
  },
  bloodlineConnector: {
    backgroundColor: color.line,
    flex: 1,
    marginTop: 5,
    width: 1,
  },
  bloodlineLineageCopy: {
    flex: 1,
    gap: 3,
    paddingBottom: space.lg,
  },
  bloodlineLineageName: {
    color: color.text,
    fontSize: 17,
    lineHeight: 22,
  },
  bloodlineLineageNameQuiet: {
    color: color.soft,
  },
  bloodlineLineageNameCurrent: {
    color: color.text,
    fontSize: 21,
    fontWeight: "600",
    lineHeight: 26,
  },
  bloodlineLineageMeta: {
    ...tokens.postAuth.smallText,
    color: color.muted,
    fontSize: 11,
    letterSpacing: 1,
    lineHeight: 16,
    textTransform: "uppercase",
  },
  bloodlineLineageMetaCurrent: {
    color: color.accent,
  },
  bloodlineChildren: {
    gap: 0,
    paddingTop: space.xs,
  },
  bloodlineChildRow: {
    flexDirection: "row",
    minHeight: 40,
  },
  bloodlineChildNodeColumn: {
    alignItems: "center",
    marginRight: space.md,
    width: 18,
  },
  bloodlineChildNode: {
    backgroundColor: "rgba(184, 230, 210, 0.42)",
    borderRadius: 4,
    height: 7,
    marginTop: 7,
    width: 7,
  },
  bloodlineChildConnector: {
    backgroundColor: "rgba(244, 247, 244, 0.08)",
    flex: 1,
    marginTop: 5,
    width: 1,
  },
  bloodlineChildCopy: {
    alignItems: "baseline",
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: space.md,
  },
  bloodlineChildNumber: {
    color: color.soft,
    fontSize: 15,
    lineHeight: 20,
  },
  bloodlineChildGeneration: {
    ...tokens.postAuth.smallText,
    color: color.muted,
    fontSize: 11,
    letterSpacing: 1,
    lineHeight: 16,
    textTransform: "uppercase",
  },
  bloodlineNoOffspring: {
    ...tokens.postAuth.smallText,
    color: color.soft,
    fontSize: 11,
    letterSpacing: 1,
    lineHeight: 18,
    paddingLeft: 30,
    textTransform: "uppercase",
  },
  bloodlineDescendants: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: space.sm,
    paddingTop: space.xs,
  },
  bloodlineDescendantNumber: {
    color: color.text,
    fontSize: 38,
    fontWeight: "500",
    lineHeight: 42,
  },
  bloodlineDescendantLabel: {
    ...tokens.postAuth.smallText,
    color: color.soft,
    fontSize: 11,
    letterSpacing: 1,
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
