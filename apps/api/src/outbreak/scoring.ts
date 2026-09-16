import { OrganismIndexModel, type OrganismIndex } from "../models/OrganismIndex";
import {
  OUTBREAK_EVENT_TYPES,
  OutbreakContributionModel,
  type OutbreakEventType
} from "../models/OutbreakContribution";
import type { OutbreakSeason } from "../models/OutbreakSeason";
import { findActiveOutbreakSeason } from "./read";
import {
  fetchCanonicalOrganismByPda,
  verifyCanonicalBirth,
  type CanonicalOrganismAccount
} from "./solana";

const DIRECT_BIRTH_EVENT_TYPE = OUTBREAK_EVENT_TYPES[0];
const LINEAGE_CONTINUATION_EVENT_TYPE = OUTBREAK_EVENT_TYPES[1];
const DIRECT_BIRTH_POINTS_BY_SLOT = new Map([
  [1, 100],
  [2, 70],
  [3, 40]
]);
const LINEAGE_CONTINUATION_POINTS = 25;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type IndexedBirth = Pick<
  OrganismIndex,
  | "organismPda"
  | "organismNumber"
  | "sgtMint"
  | "parentOrganismPda"
  | "generation"
  | "genome"
  | "bornAt"
  | "coreAsset"
  | "transactionSignature"
>;

type QualifyingSeason = Pick<OutbreakSeason, "seasonId" | "scoringVersion">;
type ContributionStatus = "created" | "existing" | "skipped";

export type OutbreakScoringStatus = "scored" | "skipped";

export class OutbreakScoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutbreakScoringError";
  }
}

export async function ensureOutbreakContributionsForBirth(
  indexedBirth: IndexedBirth
): Promise<OutbreakScoringStatus> {
  if (!indexedBirth.parentOrganismPda) {
    return "skipped";
  }

  const verifiedChild = await verifyCanonicalBirth(indexedBirth);
  const season = await findActiveOutbreakSeason(verifiedChild.bornAt);
  if (!season) {
    return "skipped";
  }

  const canonicalParent = await fetchCanonicalOrganismByPda(indexedBirth.parentOrganismPda);
  assertParentRelationship(verifiedChild, canonicalParent);

  const directStatus = await ensureDirectBirthContribution({
    indexedBirth,
    season,
    verifiedChild,
    canonicalParent
  });
  const lineageStatus = await ensureLineageContinuationContribution({
    indexedBirth,
    season,
    triggerChild: verifiedChild,
    reproducingParent: canonicalParent
  });

  return directStatus === "skipped" && lineageStatus === "skipped" ? "skipped" : "scored";
}

async function ensureDirectBirthContribution({
  indexedBirth,
  season,
  verifiedChild,
  canonicalParent
}: {
  indexedBirth: IndexedBirth;
  season: QualifyingSeason;
  verifiedChild: CanonicalOrganismAccount;
  canonicalParent: CanonicalOrganismAccount;
}): Promise<ContributionStatus> {
  const birthEventKey = `direct_birth:${verifiedChild.organismPda}`;
  const existing = await findExistingContribution(DIRECT_BIRTH_EVENT_TYPE, birthEventKey);
  if (existing) {
    return "existing";
  }

  const rewardWindowKey = getUtcWeekStartKey(verifiedChild.bornAt);

  for (const [rewardSlot, points] of DIRECT_BIRTH_POINTS_BY_SLOT.entries()) {
    const status = await tryCreateDirectBirthContribution({
      indexedBirth,
      season,
      verifiedChild,
      canonicalParent,
      birthEventKey,
      rewardWindowKey,
      rewardSlot,
      points
    });

    if (status !== "skipped") {
      return status;
    }
  }

  return tryCreateDirectBirthContribution({
    indexedBirth,
    season,
    verifiedChild,
    canonicalParent,
    birthEventKey,
    rewardWindowKey,
    rewardSlot: null,
    points: 0
  });
}

async function tryCreateDirectBirthContribution({
  indexedBirth,
  season,
  verifiedChild,
  canonicalParent,
  birthEventKey,
  rewardWindowKey,
  rewardSlot,
  points
}: {
  indexedBirth: IndexedBirth;
  season: QualifyingSeason;
  verifiedChild: CanonicalOrganismAccount;
  canonicalParent: CanonicalOrganismAccount;
  birthEventKey: string;
  rewardWindowKey: string;
  rewardSlot: number | null;
  points: number;
}): Promise<ContributionStatus> {
  try {
    await OutbreakContributionModel.create({
      seasonId: season.seasonId,
      eventType: DIRECT_BIRTH_EVENT_TYPE,
      birthEventKey,
      birthTransactionSignature: indexedBirth.transactionSignature,
      childOrganismPda: verifiedChild.organismPda,
      childOrganismNumber: verifiedChild.organismNumber,
      childSgtMint: verifiedChild.sgtMint,
      parentOrganismPda: canonicalParent.organismPda,
      contributorOrganismNumber: canonicalParent.organismNumber,
      contributorSgtMint: canonicalParent.sgtMint,
      points,
      scoringVersion: season.scoringVersion,
      birthBornAt: verifiedChild.bornAt,
      rewardWindowKey,
      rewardSlot,
      createdAt: new Date()
    });

    return "created";
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const existing = await findExistingContribution(DIRECT_BIRTH_EVENT_TYPE, birthEventKey);
    if (existing) {
      return "existing";
    }

    if (rewardSlot !== null) {
      return "skipped";
    }

    throw error;
  }
}

async function ensureLineageContinuationContribution({
  indexedBirth,
  season,
  triggerChild,
  reproducingParent
}: {
  indexedBirth: IndexedBirth;
  season: QualifyingSeason;
  triggerChild: CanonicalOrganismAccount;
  reproducingParent: CanonicalOrganismAccount;
}): Promise<ContributionStatus> {
  if (!reproducingParent.parentOrganismPda) {
    return "skipped";
  }

  const existing = await findExistingContribution(
    LINEAGE_CONTINUATION_EVENT_TYPE,
    getLineageContinuationEventKey(reproducingParent.organismPda)
  );
  if (existing) {
    return "existing";
  }

  const previousIndexedChild = await OrganismIndexModel.findOne({
    parentOrganismPda: reproducingParent.organismPda,
    organismPda: { $ne: triggerChild.organismPda }
  })
    .select({ organismPda: 1 })
    .lean();

  if (previousIndexedChild) {
    return "skipped";
  }

  const lineageContributor = await fetchCanonicalOrganismByPda(reproducingParent.parentOrganismPda);
  assertParentRelationship(reproducingParent, lineageContributor);

  try {
    await OutbreakContributionModel.create({
      seasonId: season.seasonId,
      eventType: LINEAGE_CONTINUATION_EVENT_TYPE,
      birthEventKey: getLineageContinuationEventKey(reproducingParent.organismPda),
      birthTransactionSignature: indexedBirth.transactionSignature,
      childOrganismPda: reproducingParent.organismPda,
      childOrganismNumber: reproducingParent.organismNumber,
      childSgtMint: reproducingParent.sgtMint,
      parentOrganismPda: lineageContributor.organismPda,
      contributorOrganismNumber: lineageContributor.organismNumber,
      contributorSgtMint: lineageContributor.sgtMint,
      points: LINEAGE_CONTINUATION_POINTS,
      scoringVersion: season.scoringVersion,
      birthBornAt: triggerChild.bornAt,
      rewardWindowKey: null,
      rewardSlot: null,
      createdAt: new Date()
    });

    return "created";
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const existingAfterRace = await findExistingContribution(
      LINEAGE_CONTINUATION_EVENT_TYPE,
      getLineageContinuationEventKey(reproducingParent.organismPda)
    );

    if (existingAfterRace) {
      return "existing";
    }

    throw error;
  }
}

function assertParentRelationship(
  child: CanonicalOrganismAccount,
  parent: CanonicalOrganismAccount
) {
  if (child.parentOrganismPda !== parent.organismPda) {
    throw new OutbreakScoringError("canonical parent relationship mismatch");
  }

  if (child.generation !== parent.generation + 1) {
    throw new OutbreakScoringError("canonical generation relationship mismatch");
  }
}

async function findExistingContribution(eventType: OutbreakEventType, birthEventKey: string) {
  return OutbreakContributionModel.findOne({ eventType, birthEventKey })
    .select({ _id: 1 })
    .lean();
}

function getLineageContinuationEventKey(organismPda: string) {
  return `lineage_continuation:${organismPda}`;
}

function getUtcWeekStartKey(date: Date) {
  const midnightUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const dayOfWeek = new Date(midnightUtc).getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const mondayUtc = new Date(midnightUtc - daysSinceMonday * MS_PER_DAY);
  const year = mondayUtc.getUTCFullYear();
  const month = String(mondayUtc.getUTCMonth() + 1).padStart(2, "0");
  const day = String(mondayUtc.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}
