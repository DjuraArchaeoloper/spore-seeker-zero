import mongoose, { Types, type ClientSession } from "mongoose";

import { connectToDatabase } from "../db/mongoose";
import { CampaignBirthModel } from "../models/CampaignBirth";
import { OrganismIndexModel, type OrganismIndex } from "../models/OrganismIndex";
import { OutbreakSeasonModel } from "../models/OutbreakSeason";
import { getSkrRewardId, SkrRewardModel, type SkrReward } from "../models/SkrReward";
import { getBirthReference, normalizeTransactionSignature } from "../organisms/identifiers";
import {
  finalizedOrganismFilter,
  isFinalizedOrganismStatus,
} from "../spore/organismState";
import { findQualifyingCampaign, validateCampaignRewards } from "./campaigns";

const CAMPAIGN_OPERATION_TIMEOUT_MS = 2_000;

/** Internal input only: callers must verify/finalize the birth before delivery. */
export type VerifiedBirth = {
  childOrganismPda: string;
  childOrganismNumber: string;
  childSgtMint: string;
  parentOrganismPda: string;
  parentOrganismNumber: string | null;
  parentSgtMint: string | null;
  bornAt: Date;
  transactionSignature: string | null;
  birthReference: string | null;
};

/** Normalize a canonical finalized record, never wallet/client claim data. */
export async function toVerifiedBirth(
  organism: OrganismIndex,
): Promise<VerifiedBirth | null> {
  if (
    !isFinalizedOrganismStatus(organism.status) ||
    !organism.coreAsset ||
    !organism.parentOrganismPda ||
    organism.organismNumber === "0"
  ) {
    return null;
  }

  const parent = await OrganismIndexModel.findOne({
    organismPda: organism.parentOrganismPda,
    ...finalizedOrganismFilter,
  })
    .select({ sgtMint: 1, organismNumber: 1 })
    .setOptions({ timeoutMS: CAMPAIGN_OPERATION_TIMEOUT_MS })
    .lean();

  if (
    parent &&
    ((organism.parentSgtMint && organism.parentSgtMint !== parent.sgtMint) ||
      (organism.parentOrganismNumber &&
        organism.parentOrganismNumber !== parent.organismNumber))
  ) {
    throw new Error("Canonical campaign birth parent mismatch.");
  }

  const transactionSignature = organism.transactionSignature ?? null;
  return {
    childOrganismPda: organism.organismPda,
    childOrganismNumber: organism.organismNumber,
    childSgtMint: organism.sgtMint,
    parentOrganismPda: organism.parentOrganismPda,
    parentOrganismNumber: parent?.organismNumber ?? organism.parentOrganismNumber ?? null,
    parentSgtMint: parent?.sgtMint ?? organism.parentSgtMint ?? null,
    bornAt: organism.bornAt,
    transactionSignature,
    birthReference: transactionSignature
      ? getBirthReference(organism.organismNumber, transactionSignature)
      : null,
  };
}

/** Persist a retryable receipt before reward work; the child SGT is the idempotency key. */
export async function ensureCampaignBirthReceipt(childSgtMint: string): Promise<void> {
  try {
    await CampaignBirthModel.updateOne(
      { _id: childSgtMint },
      { $setOnInsert: { createdAt: new Date(), processedAt: null } },
      {
        upsert: true,
        runValidators: true,
        timeoutMS: CAMPAIGN_OPERATION_TIMEOUT_MS,
      },
    );
  } catch (error) {
    // Concurrent first deliveries can race on Mongo's built-in unique _id index.
    if (!isDuplicateBirthReceipt(error, childSgtMint)) {
      throw error;
    }
  }
}

/** Shared post-birth entry point for server finalization and future verified indexing. */
export async function processVerifiedBirth(birth: VerifiedBirth): Promise<void> {
  await connectToDatabase();
  await ensureCampaignBirthReceipt(birth.childSgtMint);

  // The receipt never gates accrual. Rewards and the funded slot commit together;
  // only a completed reward decision marks the receipt processed afterward.
  const session = await mongoose.startSession();
  try {
    const processed = await session.withTransaction(async (): Promise<boolean> => {
      if (!(birth.bornAt instanceof Date) || !Number.isFinite(birth.bornAt.getTime())) {
        throw new Error("Verified birth timestamp is invalid.");
      }
      const campaign = await findQualifyingCampaign(birth.bornAt, session);
      if (!campaign) return false;

      const config = campaign.skrCampaign;
      if (!config || !campaign.skrFundedBirths) {
        throw new Error("Campaign reward configuration is incomplete.");
      }
      const maxFundedBirths = validateCampaignRewards(config);
      const fundedBirths = campaign.skrFundedBirths.toString();
      if (!/^(0|[1-9][0-9]*)$/.test(fundedBirths) || BigInt(fundedBirths) > maxFundedBirths) {
        throw new Error("Campaign funded-birth counter is invalid.");
      }
      const canonical = await resolveCanonicalBirth(birth, session);
      if (!canonical) throw new Error("Canonical campaign birth verification failed.");

      const parentId = getSkrRewardId({
        campaignId: campaign.seasonId,
        childSgtMint: canonical.child.sgtMint,
        role: "parent",
      });
      const newSeekerId = getSkrRewardId({
        campaignId: campaign.seasonId,
        childSgtMint: canonical.child.sgtMint,
        role: "newSeeker",
      });
      const existing = await SkrRewardModel.find({ _id: { $in: [parentId, newSeekerId] } })
        .session(session)
        .lean();
      if (existing.length === 2) {
        const validPair = existing.some((reward) =>
          matchesReward(reward, parentId, "parent", canonical.parent.sgtMint, config.parentRewardAtomic, canonical.birthReference, config)
        ) && existing.some((reward) =>
          matchesReward(reward, newSeekerId, "newSeeker", canonical.child.sgtMint, config.newSeekerRewardAtomic, canonical.birthReference, config)
        );
        if (!validPair) throw new Error("Existing campaign reward pair does not match canonical data.");
        return true;
      }
      if (existing.length !== 0) {
        throw new Error("Campaign reward pair is incomplete and needs repair.");
      }

      const reserved = await OutbreakSeasonModel.updateOne(
        {
          seasonId: campaign.seasonId,
          startsAt: { $lte: canonical.child.bornAt },
          endsAt: { $gt: canonical.child.bornAt },
          $or: [
            { cancelledAt: null },
            { cancelledAt: { $gt: canonical.child.bornAt } },
          ],
          skrFundedBirths: {
            $lt: Types.Decimal128.fromString(maxFundedBirths.toString()),
          },
        },
        { $inc: { skrFundedBirths: Types.Decimal128.fromString("1") } },
        { session },
      );
      if (reserved.modifiedCount !== 1) return false; // Retry if budget or campaign data is repaired.

      const createdAt = new Date();
      const common = {
        campaignId: campaign.seasonId,
        childSgtMint: canonical.child.sgtMint,
        birthReference: canonical.birthReference,
        tokenMint: config.tokenMint,
        decimals: config.decimals,
        payoutStatus: "pending" as const,
        createdAt,
      };
      await SkrRewardModel.create(
        [
          {
            ...common,
            _id: parentId,
            recipientSgtMint: canonical.parent.sgtMint,
            role: "parent",
            amountAtomic: config.parentRewardAtomic,
          },
          {
            ...common,
            _id: newSeekerId,
            recipientSgtMint: canonical.child.sgtMint,
            role: "newSeeker",
            amountAtomic: config.newSeekerRewardAtomic,
          },
        ] satisfies SkrReward[],
        { session },
      );
      return true;
    });
    if (processed) {
      await CampaignBirthModel.updateOne(
        { _id: birth.childSgtMint },
        { $set: { processedAt: new Date() } },
        { timeoutMS: CAMPAIGN_OPERATION_TIMEOUT_MS },
      );
    }
  } finally {
    await session.endSession();
  }
}

function matchesReward(
  reward: SkrReward,
  id: string,
  role: SkrReward["role"],
  recipientSgtMint: string,
  amountAtomic: string,
  birthReference: string | null,
  config: { tokenMint: string; decimals: number },
) {
  return (
    reward._id === id &&
    reward.role === role &&
    reward.recipientSgtMint === recipientSgtMint &&
    reward.amountAtomic === amountAtomic &&
    reward.birthReference === birthReference &&
    reward.tokenMint === config.tokenMint &&
    reward.decimals === config.decimals
  );
}

async function resolveCanonicalBirth(birth: VerifiedBirth, session: ClientSession) {
  const child = await OrganismIndexModel.findOne({
    organismPda: birth.childOrganismPda,
    sgtMint: birth.childSgtMint,
    ...finalizedOrganismFilter,
  })
    .session(session)
    .lean();
  if (
    !child ||
    !child.coreAsset ||
    !child.parentOrganismPda ||
    child.organismNumber === "0" ||
    child.organismNumber !== birth.childOrganismNumber ||
    child.parentOrganismPda !== birth.parentOrganismPda ||
    child.bornAt.getTime() !== birth.bornAt.getTime()
  ) {
    return null;
  }

  const parent = await OrganismIndexModel.findOne({
    organismPda: child.parentOrganismPda,
    ...finalizedOrganismFilter,
  })
    .session(session)
    .lean();
  if (
    !parent ||
    !parent.sgtMint ||
    parent.sgtMint === child.sgtMint ||
    child.generation !== parent.generation + 1 ||
    (child.parentSgtMint && child.parentSgtMint !== parent.sgtMint) ||
    (child.parentOrganismNumber && child.parentOrganismNumber !== parent.organismNumber) ||
    (birth.parentSgtMint && birth.parentSgtMint !== parent.sgtMint) ||
    (birth.parentOrganismNumber && birth.parentOrganismNumber !== parent.organismNumber)
  ) {
    return null;
  }

  const signature = normalizeTransactionSignature(child.transactionSignature);
  const birthReference = signature
    ? getBirthReference(child.organismNumber, signature)
    : null;
  if (
    (birth.transactionSignature && birth.transactionSignature !== child.transactionSignature) ||
    (birth.birthReference && birth.birthReference !== birthReference)
  ) {
    return null;
  }
  return { child, parent, birthReference };
}

function isDuplicateBirthReceipt(error: unknown, childSgtMint: string) {
  if (!error || typeof error !== "object") {
    return false;
  }
  const duplicate = error as {
    code?: unknown;
    keyPattern?: { _id?: unknown };
    keyValue?: { _id?: unknown };
  };
  return (
    duplicate.code === 11000 &&
    duplicate.keyPattern?._id === 1 &&
    duplicate.keyValue?._id === childSgtMint
  );
}
