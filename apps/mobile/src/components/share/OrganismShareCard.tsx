import { forwardRef } from "react";
import { StyleSheet, View } from "react-native";
import { type GenomeInput } from "@spore/shared";

import { AppText } from "../AppText";
import { OrganismRenderer } from "../organism/OrganismRenderer";
import { tokens } from "../../design/tokens";

export const ORGANISM_SHARE_CARD_WIDTH = 360;
export const ORGANISM_SHARE_CARD_HEIGHT = 450;

type OrganismShareCardProps = {
  generation: number;
  genome: GenomeInput;
  onOrganismReady?: () => void;
  organismNumber: string;
};

function formatOrganismNumber(organismNumber: string) {
  return organismNumber.padStart(6, "0");
}

export const OrganismShareCard = forwardRef<View, OrganismShareCardProps>(
  ({ generation, genome, onOrganismReady, organismNumber }, ref) => {
    return (
      <View
        ref={ref}
        collapsable={false}
        pointerEvents="none"
        style={styles.card}
      >
        <View style={styles.topLine}>
          <AppText style={styles.brand} variant="metadata">
            SPOR
          </AppText>
          <AppText style={styles.origin} variant="metadata">
            SEEKER ZERO
          </AppText>
        </View>

        <View style={styles.trace} />

        <View style={styles.organismStage}>
          <OrganismRenderer
            animated={false}
            genome={genome}
            onStillImageReady={onOrganismReady}
            size={292}
          />
        </View>

        <View style={styles.metadata}>
          <AppText
            numberOfLines={1}
            style={styles.organismNumber}
            variant="metadata"
          >
            ORGANISM #{formatOrganismNumber(organismNumber)}
          </AppText>
          <AppText numberOfLines={1} style={styles.generation} variant="metadata">
            GENERATION {generation}
          </AppText>
          <AppText numberOfLines={1} style={styles.lineage} variant="metadata">
            DESCENDANT OF SEEKER ZERO
          </AppText>
        </View>

        <AppText numberOfLines={1} style={styles.hook} variant="metadata">
          THE SPECIES IS SPREADING
        </AppText>
      </View>
    );
  }
);

OrganismShareCard.displayName = "OrganismShareCard";

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#020606",
    height: ORGANISM_SHARE_CARD_HEIGHT,
    overflow: "hidden",
    paddingBottom: 26,
    paddingHorizontal: 28,
    paddingTop: 28,
    width: ORGANISM_SHARE_CARD_WIDTH,
  },
  topLine: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  brand: {
    color: tokens.postAuth.primary,
    fontFamily: "Michroma_400Regular",
    fontSize: 13,
    fontWeight: "400",
    includeFontPadding: false,
    letterSpacing: 2.8,
    lineHeight: 18,
    paddingLeft: 2.8,
  },
  origin: {
    color: tokens.postAuth.tertiary,
    fontFamily: "Michroma_400Regular",
    fontSize: 7.5,
    fontWeight: "400",
    includeFontPadding: false,
    letterSpacing: 1.7,
    lineHeight: 12,
    paddingLeft: 1.7,
    paddingTop: 3,
    textAlign: "right",
  },
  trace: {
    backgroundColor: "rgba(181, 238, 226, 0.16)",
    height: 1,
    marginTop: 18,
    width: 72,
  },
  organismStage: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    marginTop: 6,
  },
  metadata: {
    alignItems: "center",
    gap: 5,
  },
  organismNumber: {
    color: tokens.postAuth.primary,
    fontFamily: "Michroma_400Regular",
    fontSize: 13,
    fontWeight: "400",
    includeFontPadding: false,
    letterSpacing: 2.1,
    lineHeight: 18,
    paddingLeft: 2.1,
    textAlign: "center",
  },
  generation: {
    color: tokens.postAuth.secondary,
    fontFamily: "Michroma_400Regular",
    fontSize: 8.5,
    fontWeight: "400",
    includeFontPadding: false,
    letterSpacing: 1.7,
    lineHeight: 13,
    paddingLeft: 1.7,
    textAlign: "center",
  },
  lineage: {
    color: tokens.postAuth.tertiary,
    fontFamily: "Michroma_400Regular",
    fontSize: 7.5,
    fontWeight: "400",
    includeFontPadding: false,
    letterSpacing: 1.45,
    lineHeight: 12,
    paddingLeft: 1.45,
    textAlign: "center",
  },
  hook: {
    color: "rgba(247, 251, 251, 0.54)",
    fontFamily: "Michroma_400Regular",
    fontSize: 7,
    fontWeight: "400",
    includeFontPadding: false,
    letterSpacing: 1.65,
    lineHeight: 11,
    marginTop: 18,
    paddingLeft: 1.65,
    textAlign: "center",
  },
});
