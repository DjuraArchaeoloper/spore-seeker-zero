import { useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SEEKER_ZERO_GENOME_HEX, type GenomeInput } from "@spore/shared";

import { AppText } from "../components/AppText";
import { OrganismRenderer } from "../components/organism/OrganismRenderer";
import { PrimaryButton } from "../components/PrimaryButton";
import { tokens } from "../design/tokens";

type SpecimenOrganism = {
  // API u64 values are decimal strings. Never convert identity to Number.
  organismNumber: string;
  generation: number;
  genome: GenomeInput;
};

const canonicalOrigin: SpecimenOrganism = {
  organismNumber: "0",
  generation: 0,
  genome: SEEKER_ZERO_GENOME_HEX
};

export function getSpecimenDesignation(organismNumber: string) {
  const isOrigin = /^0+$/.test(organismNumber);
  return isOrigin
    ? { title: "SEEKER ZERO", subtitle: "The first Seekerborne case." }
    : { title: "SEEKERBORNE", subtitle: "Descendant of Seeker Zero." };
}

// The static origin is only used by visual preview; production supplies a canonical account.
export function SpecimenScreen({ organism = canonicalOrigin, onRelease, busy = false, canRelease = false, sporeStatus = "SPORE READY", error }: {
  organism?: SpecimenOrganism; onRelease?: () => void; busy?: boolean; canRelease?: boolean; sporeStatus?: string; error?: string | null;
}) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const compact = height < 740;
  const organismSize = Math.min(stageSize.width, stageSize.height, 560);
  const designation = getSpecimenDesignation(organism.organismNumber);

  return (
    <View style={[
      styles.screen,
      {
        paddingTop: insets.top + (compact ? 20 : 32),
        paddingLeft: insets.left,
        paddingRight: insets.right,
        paddingBottom: compact ? 24 : Math.min(height * 0.065, 64)
      }
    ]}>
      <View style={styles.metadata}>
        <AppText style={styles.identifier} variant="metadata">
          GEN {organism.generation} · #{organism.organismNumber.padStart(6, "0")}
        </AppText>
      </View>

      <View
        style={styles.organismStage}
        onLayout={({ nativeEvent: { layout } }) => {
          setStageSize((previous) => previous.width === layout.width && previous.height === layout.height
            ? previous
            : { width: layout.width, height: layout.height });
        }}
      >
        {organismSize > 0 ? (
          <OrganismRenderer genome={organism.genome} size={organismSize} />
        ) : null}
      </View>

      <View style={[styles.footer, { gap: compact ? 22 : 30 }]}>
        <View style={styles.identity}>
          <AppText style={[styles.name, { letterSpacing: width < 360 ? 3.5 : 5 }]} variant="title">
            {designation.title}
          </AppText>
          <AppText style={styles.subtitle} variant="metadata">
            {designation.subtitle}
          </AppText>
        </View>

        <View style={styles.readyRow}>
          <View style={styles.readyDot} />
          <AppText style={styles.status} variant="metadata">
            {sporeStatus}
          </AppText>
        </View>

        <View style={styles.action}>
          <PrimaryButton appearance="specimen" disabled={!canRelease || busy} label={busy ? "RELEASING…" : "RELEASE SPORE"} onPress={onRelease} />
          {error ? <AppText style={styles.subtitle}>{error}</AppText> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  metadata: {
    alignItems: "center",
    paddingHorizontal: tokens.spacing.xl,
    paddingBottom: tokens.spacing.sm
  },
  identifier: {
    color: tokens.specimen.secondary,
    fontSize: 11,
    fontWeight: "400",
    letterSpacing: 3,
    lineHeight: 18,
    textAlign: "center"
  },
  organismStage: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    overflow: "visible"
  },
  footer: {
    alignItems: "center",
    flexShrink: 0,
    paddingHorizontal: tokens.spacing.xl,
    paddingTop: tokens.spacing.lg
  },
  identity: {
    alignItems: "center",
    gap: tokens.spacing.sm
  },
  name: {
    color: tokens.specimen.primary,
    fontSize: 23,
    fontWeight: "400",
    lineHeight: 32,
    textAlign: "center"
  },
  subtitle: {
    color: tokens.specimen.secondary,
    fontSize: 10,
    fontWeight: "400",
    letterSpacing: 2.2,
    lineHeight: 17,
    textAlign: "center",
    textTransform: "uppercase"
  },
  readyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.md,
    justifyContent: "center"
  },
  status: {
    color: tokens.specimen.mint,
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 2.7,
    lineHeight: 16
  },
  readyDot: {
    backgroundColor: tokens.specimen.mint,
    borderRadius: tokens.radii.full,
    height: 5,
    width: 5
  },
  action: {
    width: "88%",
    maxWidth: 360
  }
});
