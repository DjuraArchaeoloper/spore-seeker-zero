import { useCallback, useEffect, useRef, useState } from "react";
import { Michroma_400Regular } from "@expo-google-fonts/michroma";
import { useFonts } from "expo-font";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SEEKER_ZERO_GENOME_HEX, type GenomeInput } from "@spore/shared";

import { AppText } from "../components/AppText";
import { AUTH_LOGOUT_TOP_RESERVE } from "../components/AuthenticatedLogoutControl";
import { OrganismRenderer } from "../components/organism/OrganismRenderer";
import { PrimaryButton } from "../components/PrimaryButton";
import { QuietAction } from "../components/QuietAction";
import {
  ORGANISM_SHARE_CARD_HEIGHT,
  ORGANISM_SHARE_CARD_WIDTH,
  OrganismShareCard,
} from "../components/share/OrganismShareCard";
import { tokens } from "../design/tokens";
import { shareOrganismCard } from "../spore/shareOrganism";

// Art direction in logical pixels; the flexible stage absorbs height changes.
const SPECIMEN_LAYOUT = {
  creatureScale: 1.08,
  creatureMaxSize: 560,
  metaTopRatio: 0.065,
  footerBottomRatio: 0.065,
  titleSize: 22,
  titleTracking: 5,
  actionWidth: "76%",
  actionMaxWidth: 360,
} as const;

export type SpecimenOrganism = {
  // API u64 values are decimal strings. Never convert identity to Number.
  organismNumber: string;
  generation: number;
  genome: GenomeInput;
};

export const canonicalOrigin: SpecimenOrganism = {
  organismNumber: "0",
  generation: 0,
  genome: SEEKER_ZERO_GENOME_HEX,
};

export function getSpecimenDesignation(organismNumber: string) {
  const isOrigin = /^0+$/.test(organismNumber);
  return isOrigin
    ? { title: "SEEKER ZERO", subtitle: "The first Seekerborne case." }
    : { title: "SEEKERBORNE", subtitle: "Descendant of Seeker Zero." };
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

function formatPoints(points: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(points);
}

export type SpecimenSporeState = "ready" | "active" | "cooldown";

export type SpecimenScreenProps = {
  organism?: SpecimenOrganism | null;
  outbreak?: {
    points: number;
    seasonId: string;
  } | null;
  previewOrigin?: boolean;
  onRelease?: () => void;
  onViewSpore?: () => void;
  busy?: boolean;
  canRelease?: boolean;
  canViewSpore?: boolean;
  releaseLabel?: string;
  sporeState?: SpecimenSporeState;
  sporeStatus?: string;
  error?: string | null;
};

// The static origin is only used by visual preview; production supplies a canonical account.
export function SpecimenScreen({
  organism,
  outbreak,
  previewOrigin = false,
  onRelease,
  onViewSpore,
  busy = false,
  canRelease = false,
  canViewSpore = false,
  releaseLabel = "RELEASE SPORE",
  sporeState = "ready",
  sporeStatus = "SPORE READY",
  error,
}: SpecimenScreenProps) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [fontsLoaded, fontError] = useFonts({ Michroma_400Regular });
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const shareCardRef = useRef<View>(null);
  const [shareCardReadyKey, setShareCardReadyKey] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const compact = height < 740;
  const organismSize = Math.min(
    stageSize.width * SPECIMEN_LAYOUT.creatureScale,
    Math.max(0, stageSize.height - 8),
    SPECIMEN_LAYOUT.creatureMaxSize,
  );
  const horizontalScale = Math.min((width - insets.left - insets.right) / 390, 1.15);
  const topSpace = Math.max(
    insets.top + (compact ? 24 : height * SPECIMEN_LAYOUT.metaTopRatio),
    insets.top + AUTH_LOGOUT_TOP_RESERVE,
  );
  const bottomSpace = Math.max(8, compact ? 24 : Math.min(height * SPECIMEN_LAYOUT.footerBottomRatio, 64));
  const specimen = organism ?? (previewOrigin ? canonicalOrigin : null);
  const shareCardKey = specimen
    ? `${specimen.organismNumber}:${specimen.generation}:${String(specimen.genome)}`
    : null;
  const ready = sporeState === "ready";
  const showViewSpore = sporeState === "active" && canViewSpore;
  const actionLabel = busy
    ? showViewSpore
      ? "OPENING"
      : "RELEASING"
    : showViewSpore
      ? "VIEW SPORE"
      : releaseLabel;
  const actionDisabled = busy || (showViewSpore ? !canViewSpore : !canRelease);
  const actionPress = showViewSpore ? onViewSpore : onRelease;
  const shareDisabled = busy || sharing || sharingUnavailable(fontsLoaded, shareCardReadyKey === shareCardKey);
  const visibleError = shareError ?? error;
  const markShareCardReady = useCallback(() => {
    setShareCardReadyKey(shareCardKey);
  }, [shareCardKey]);

  useEffect(() => {
    setShareError(null);
  }, [shareCardKey]);

  async function handleShare() {
    if (!specimen || shareDisabled) {
      return;
    }

    setShareError(null);
    setSharing(true);

    try {
      await shareOrganismCard({
        cardRef: shareCardRef,
        generation: specimen.generation,
        organismNumber: specimen.organismNumber,
      });
    } catch (shareFailure) {
      if (__DEV__) {
        console.warn("[SPOR SHARE] Unable to share organism.", shareFailure);
      }
      setShareError("SHARING UNAVAILABLE");
    } finally {
      setSharing(false);
    }
  }

  if (fontError) throw fontError;

  if (!specimen) {
    return (
      <View
        style={[
          styles.screen,
          {
            paddingTop: topSpace,
            paddingLeft: insets.left,
            paddingRight: insets.right,
            paddingBottom: bottomSpace,
            opacity: fontsLoaded ? 1 : 0,
          },
        ]}
      >
        <View style={styles.emptyState}>
          <AppText style={[styles.identifier, styles.emptyLabel]} variant="metadata">
            SPECIMEN UNAVAILABLE
          </AppText>
          {visibleError ? <AppText style={styles.error}>{visibleError}</AppText> : null}
        </View>
      </View>
    );
  }

  const designation = getSpecimenDesignation(specimen.organismNumber);

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: topSpace,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          paddingBottom: bottomSpace,
          opacity: fontsLoaded ? 1 : 0,
        },
      ]}
    >
      <View style={styles.metadata}>
        <AppText maxFontSizeMultiplier={1.2} style={styles.identifier} variant="metadata">
          GEN {specimen.generation} · #
          {specimen.organismNumber.padStart(6, "0")}
        </AppText>
        {outbreak ? (
          <AppText maxFontSizeMultiplier={1.2} style={styles.outbreak} variant="metadata">
            {formatOutbreakSeasonLabel(outbreak.seasonId)} · {formatPoints(outbreak.points)} PTS
          </AppText>
        ) : null}
      </View>

      <View
        style={styles.organismStage}
        onLayout={({ nativeEvent: { layout } }) => {
          setStageSize((previous) =>
            previous.width === layout.width && previous.height === layout.height
              ? previous
              : { width: layout.width, height: layout.height },
          );
        }}
      >
        {organismSize > 0 ? (
          <OrganismRenderer genome={specimen.genome} size={organismSize} />
        ) : null}
      </View>

      <View style={[styles.footer, { gap: compact ? 20 : 28 }]}>
        <View style={styles.identity}>
          <AppText
            maxFontSizeMultiplier={1.2}
            numberOfLines={1}
            // adjustsFontSizeToFit
            style={[styles.name, {
              fontSize: SPECIMEN_LAYOUT.titleSize * horizontalScale,
              letterSpacing: SPECIMEN_LAYOUT.titleTracking * horizontalScale,
              paddingLeft: SPECIMEN_LAYOUT.titleTracking * horizontalScale,
            }]}
            variant="title"
          >
            {designation.title}
          </AppText>
          <AppText maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.subtitle} variant="metadata">
            {designation.subtitle}
          </AppText>
        </View>

        <View style={styles.readyRow}>
          <View style={[styles.readyDot, !ready && styles.readyDotInactive]} />
          <AppText
            maxFontSizeMultiplier={1.2}
            style={[styles.status, !ready && styles.statusInactive]}
            variant="metadata"
          >
            {sporeStatus}
          </AppText>
        </View>

        <View style={styles.action}>
          <PrimaryButton
            appearance="specimen"
            disabled={actionDisabled}
            label={actionLabel}
            loading={busy}
            loadingLabel={actionLabel}
            onPress={actionPress}
          />
          <QuietAction
            disabled={shareDisabled}
            label={sharing ? "SHARING" : "SHARE"}
            onPress={handleShare}
          />
          {visibleError ? <AppText style={styles.error}>{visibleError}</AppText> : null}
        </View>
      </View>

      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.shareCardCapture}
        pointerEvents="none"
      >
        <OrganismShareCard
          ref={shareCardRef}
          generation={specimen.generation}
          genome={specimen.genome}
          onOrganismReady={markShareCardReady}
          organismNumber={specimen.organismNumber}
        />
      </View>
    </View>
  );
}

function sharingUnavailable(fontsLoaded: boolean, shareCardReady: boolean) {
  return !fontsLoaded || !shareCardReady;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    flex: 1,
    gap: tokens.spacing.md,
    justifyContent: "center",
    paddingHorizontal: tokens.spacing.xl,
  },
  metadata: {
    alignItems: "center",
    gap: 5,
    paddingHorizontal: tokens.spacing.xl,
    paddingBottom: tokens.spacing.sm,
  },
  identifier: {
    ...tokens.postAuth.smallText,
    fontFamily: "Michroma_400Regular",
    includeFontPadding: false,
    color: tokens.postAuth.secondary,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 2.6,
    paddingLeft: 2.6,
    lineHeight: 16,
    textAlign: "center",
  },
  emptyLabel: {
    color: tokens.postAuth.primary,
    fontSize: 10,
    letterSpacing: 1.8,
    paddingLeft: 1.8,
  },
  outbreak: {
    ...tokens.postAuth.smallText,
    color: tokens.postAuth.tertiary,
    fontFamily: "Michroma_400Regular",
    fontSize: 9,
    fontWeight: "400",
    includeFontPadding: false,
    letterSpacing: 1.7,
    lineHeight: 13,
    paddingLeft: 1.7,
    textAlign: "center",
  },
  organismStage: {
    alignItems: "center",
    flex: 1,
    minHeight: 0,
    justifyContent: "center",
    overflow: "visible",
  },
  footer: {
    alignItems: "center",
    flexShrink: 0,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.xs,
  },
  identity: {
    alignItems: "center",
    width: "100%",
    gap: 8,
  },
  name: {
    color: tokens.postAuth.primary,
    fontFamily: "Michroma_400Regular",
    includeFontPadding: false,
    fontWeight: "400",
    lineHeight: 33,
    textAlign: "center",
  },
  subtitle: {
    ...tokens.postAuth.smallText,
    fontFamily: "Michroma_400Regular",
    includeFontPadding: false,
    color: tokens.postAuth.secondary,
    fontSize: 10,
    fontWeight: "400",
    letterSpacing: 1.8,
    paddingLeft: 1.8,
    lineHeight: 16,
    textAlign: "center",
    textTransform: "uppercase",
  },
  readyRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.md,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  status: {
    ...tokens.postAuth.smallText,
    fontFamily: "Michroma_400Regular",
    includeFontPadding: false,
    color: tokens.postAuth.primary,
    fontSize: 12,
    fontWeight: "400",
    letterSpacing: 2.1,
    lineHeight: 17,
    textAlign: "center",
    flexShrink: 1,
  },
  statusInactive: {
    color: tokens.postAuth.secondary,
  },
  readyDot: {
    backgroundColor: "#a5f7ff",
    boxShadow: "0 0 6px 2px rgba(85, 221, 238, 0.32)",
    borderRadius: tokens.radii.full,
    height: 6,
    shadowColor: tokens.specimen.mint,
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.36,
    shadowRadius: 6,
    width: 6,
  },
  readyDotInactive: {
    backgroundColor: "rgba(163, 171, 178, 0.34)",
    shadowOpacity: 0,
    boxShadow: "none",
  },
  action: {
    width: SPECIMEN_LAYOUT.actionWidth,
    maxWidth: SPECIMEN_LAYOUT.actionMaxWidth,
    gap: 8,
  },
  shareCardCapture: {
    height: ORGANISM_SHARE_CARD_HEIGHT,
    left: -1000,
    position: "absolute",
    top: 0,
    width: ORGANISM_SHARE_CARD_WIDTH,
  },
  error: {
    ...tokens.postAuth.smallText,
    color: tokens.postAuth.primary,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 18,
    textAlign: "center",
  },
});
