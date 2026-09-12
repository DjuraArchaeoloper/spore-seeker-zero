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

export function BloodlineScreen({ bloodline = previewBloodline, error, loading = false }: BloodlineScreenProps) {
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

const styles = StyleSheet.create({
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
