import mongoose, { Types, type ClientSession } from "mongoose";

import { connectToDatabase } from "../db/mongoose";
import {
  OutbreakSeasonModel,
  type OutbreakSeason,
  type OutbreakSkrCampaign,
  type OutbreakSkrPoolMetadata,
} from "../models/OutbreakSeason";

const SEASON_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const SCORING_VERSION_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const PUBLIC_KEY_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const POSITIVE_ATOMIC_PATTERN = /^[1-9][0-9]*$/;
const MAX_U64 = 18_446_744_073_709_551_615n;
const SCHEDULE_GUARD_ID = "outbreak_campaign_schedule";

export type CampaignLifecycle = "scheduled" | "active" | "ended" | "cancelled";

export type CreateCampaignInput = {
  seasonId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  scoringVersion: string;
  skrCampaign: OutbreakSkrCampaign;
  skrPool?: OutbreakSkrPoolMetadata;
};

export type EditCampaignInput = Partial<
  Pick<CreateCampaignInput, "title" | "startsAt" | "endsAt" | "scoringVersion" | "skrCampaign" | "skrPool">
>;

export class CampaignConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampaignConfigurationError";
  }
}

/** Stored status belongs to legacy points; V1 campaign status is always derived. */
export function getCampaignLifecycle(
  campaign: Pick<OutbreakSeason, "startsAt" | "endsAt" | "cancelledAt">,
  now = new Date(),
): CampaignLifecycle {
  if (campaign.cancelledAt) return "cancelled";
  if (now < campaign.startsAt) return "scheduled";
  if (now >= campaign.endsAt) return "ended";
  return "active";
}

/** All amounts are exact token base units. No JS floating-point conversion. */
export function validateCampaignRewards(config: OutbreakSkrCampaign): bigint {
  if (!config || !PUBLIC_KEY_PATTERN.test(config.tokenMint)) {
    throw new CampaignConfigurationError("A valid SKR token mint is required.");
  }
  if (!Number.isInteger(config.decimals) || config.decimals < 0 || config.decimals > 18) {
    throw new CampaignConfigurationError("SKR decimals must be an integer from 0 to 18.");
  }

  const parent = parsePositiveAtomic(config.parentRewardAtomic, "parent reward");
  const newSeeker = parsePositiveAtomic(config.newSeekerRewardAtomic, "new-Seeker reward");
  const budget = parsePositiveAtomic(config.budgetAtomic, "budget");
  const pair = parent + newSeeker;
  if (pair > budget) {
    throw new CampaignConfigurationError("Budget must fund at least one complete reward pair.");
  }
  return budget / pair;
}

export async function createCampaign(input: CreateCampaignInput) {
  assertCampaignInput(input);
  await connectToDatabase();
  await withScheduleGuard(async (session) => {
    if (input.startsAt <= new Date()) {
      throw new CampaignConfigurationError("A new campaign must start in the future.");
    }
    const existingId = await OutbreakSeasonModel.findOne({ seasonId: input.seasonId })
      .select({ seasonId: 1 })
      .session(session)
      .lean();
    if (existingId) {
      throw new CampaignConfigurationError("Campaign ID already exists.");
    }
    await assertNoOverlappingCampaign(input.startsAt, input.endsAt, null, session);
    const [created] = await OutbreakSeasonModel.create(
      [{
        seasonId: input.seasonId,
        title: input.title,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        // V1 uses time-derived lifecycle; legacy points opt-in is unchanged.
        status: "scheduled",
        scoringVersion: input.scoringVersion,
        skrPool: input.skrPool,
        skrCampaign: input.skrCampaign,
        skrFundedBirths: Types.Decimal128.fromString("0"),
        cancelledAt: null,
      }],
      { session },
    );
    if (!created) throw new CampaignConfigurationError("Campaign creation failed.");
  });
  return getCampaign(input.seasonId);
}

export async function editScheduledCampaign(seasonId: string, patch: EditCampaignInput) {
  assertSeasonId(seasonId);
  await connectToDatabase();
  await withScheduleGuard(async (session) => {
    const current = await OutbreakSeasonModel.findOne({ seasonId, skrCampaign: { $exists: true } })
      .session(session)
      .lean();
    if (!current || getCampaignLifecycle(current) !== "scheduled") {
      throw new CampaignConfigurationError("Only a scheduled, non-cancelled campaign can be edited.");
    }
    const next = {
      title: patch.title ?? current.title ?? current.seasonId,
      startsAt: patch.startsAt ?? current.startsAt,
      endsAt: patch.endsAt ?? current.endsAt,
      scoringVersion: patch.scoringVersion ?? current.scoringVersion,
      skrCampaign: patch.skrCampaign ?? current.skrCampaign!,
    };
    assertCampaignInput({ seasonId, ...next });
    if (next.startsAt <= new Date()) {
      throw new CampaignConfigurationError("An edited campaign must start in the future.");
    }
    await assertNoOverlappingCampaign(next.startsAt, next.endsAt, seasonId, session);

    const set: Record<string, unknown> = { ...next };
    if (patch.skrPool !== undefined) set.skrPool = patch.skrPool;
    const updated = await OutbreakSeasonModel.findOneAndUpdate(
      {
        seasonId,
        skrCampaign: { $exists: true },
        cancelledAt: null,
        // Evaluate the old start against Mongo server time at the write.
        $expr: { $gt: ["$startsAt", "$$NOW"] },
      },
      { $set: set },
      { session, runValidators: true, returnDocument: "after" },
    ).lean();
    if (!updated) {
      throw new CampaignConfigurationError("Campaign has started or was cancelled.");
    }
  });
  return getCampaign(seasonId);
}

export async function cancelCampaign(seasonId: string, activeOnly = false) {
  assertSeasonId(seasonId);
  await connectToDatabase();
  const cancelled = await OutbreakSeasonModel.findOneAndUpdate(
    {
      seasonId,
      skrCampaign: { $exists: true },
      cancelledAt: null,
      $expr: activeOnly
        ? { $and: [{ $lte: ["$startsAt", "$$NOW"] }, { $gt: ["$endsAt", "$$NOW"] }] }
        : { $gt: ["$endsAt", "$$NOW"] },
    },
    [{ $set: { cancelledAt: "$$NOW" } }],
    { returnDocument: "after" },
  ).lean();
  if (!cancelled) {
    throw new CampaignConfigurationError("Campaign is missing, ended, or already cancelled.");
  }
  return { campaign: cancelled, lifecycle: getCampaignLifecycle(cancelled) };
}

export async function getCampaign(seasonId: string, now = new Date()) {
  assertSeasonId(seasonId);
  await connectToDatabase();
  const campaign = await OutbreakSeasonModel.findOne({
    seasonId,
    skrCampaign: { $exists: true },
  }).lean();
  return campaign ? { campaign, lifecycle: getCampaignLifecycle(campaign, now) } : null;
}

export async function listCampaigns(now = new Date()) {
  await connectToDatabase();
  const campaigns = await OutbreakSeasonModel.find({ skrCampaign: { $exists: true } })
    .sort({ startsAt: -1, seasonId: 1 })
    .lean();
  return campaigns.map((campaign) => ({
    campaign,
    lifecycle: getCampaignLifecycle(campaign, now),
  }));
}

/** Half-open window: start inclusive, end exclusive; cancellation is exclusive. */
export async function findQualifyingCampaign(bornAt: Date, session: ClientSession) {
  const campaigns = await OutbreakSeasonModel.find({
    skrCampaign: { $exists: true },
    startsAt: { $lte: bornAt },
    endsAt: { $gt: bornAt },
    $or: [{ cancelledAt: null }, { cancelledAt: { $gt: bornAt } }],
  })
    .limit(2)
    .session(session)
    .lean();
  if (campaigns.length > 1) {
    throw new CampaignConfigurationError("Overlapping campaigns require manual repair.");
  }
  return campaigns[0] ?? null;
}

function parsePositiveAtomic(value: string, label: string) {
  if (typeof value !== "string" || !POSITIVE_ATOMIC_PATTERN.test(value)) {
    throw new CampaignConfigurationError(`${label} must be a positive base-unit integer string.`);
  }
  const amount = BigInt(value);
  if (amount > MAX_U64) {
    throw new CampaignConfigurationError(`${label} exceeds unsigned u64 range.`);
  }
  return amount;
}

function assertCampaignInput(input: CreateCampaignInput) {
  assertSeasonId(input.seasonId);
  if (typeof input.title !== "string" || !input.title.trim() || input.title.trim().length > 80) {
    throw new CampaignConfigurationError("Campaign title must be 1 to 80 characters.");
  }
  if (!SCORING_VERSION_PATTERN.test(input.scoringVersion)) {
    throw new CampaignConfigurationError("A valid legacy scoring version is required.");
  }
  if (
    !(input.startsAt instanceof Date) ||
    !Number.isFinite(input.startsAt.getTime()) ||
    !(input.endsAt instanceof Date) ||
    !Number.isFinite(input.endsAt.getTime()) ||
    input.endsAt <= input.startsAt
  ) {
    throw new CampaignConfigurationError("Campaign end must be after its valid start date.");
  }
  validateCampaignRewards(input.skrCampaign);
}

function assertSeasonId(seasonId: string) {
  if (typeof seasonId !== "string" || !SEASON_ID_PATTERN.test(seasonId)) {
    throw new CampaignConfigurationError("Invalid campaign ID.");
  }
}

async function assertNoOverlappingCampaign(
  startsAt: Date,
  endsAt: Date,
  excludingSeasonId: string | null,
  session: ClientSession,
) {
  const conflict = await OutbreakSeasonModel.findOne({
    skrCampaign: { $exists: true },
    startsAt: { $lt: endsAt },
    endsAt: { $gt: startsAt },
    // A cancelled campaign still owns births before its cancellation time.
    $or: [{ cancelledAt: null }, { cancelledAt: { $gt: startsAt } }],
    ...(excludingSeasonId ? { seasonId: { $ne: excludingSeasonId } } : {}),
  })
    .select({ seasonId: 1 })
    .session(session)
    .lean();
  if (conflict) {
    throw new CampaignConfigurationError("Campaign window overlaps an existing reward window.");
  }
}

/** All create/edit callers serialize their overlap check on one Mongo document. */
async function withScheduleGuard(work: (session: ClientSession) => Promise<void>) {
  const guard = mongoose.connection.db!.collection<{ _id: string; revision: number }>(
    "outbreak_campaign_schedule_guard",
  );
  try {
    await guard.updateOne(
      { _id: SCHEDULE_GUARD_ID },
      { $setOnInsert: { revision: 0 } },
      { upsert: true },
    );
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await guard.updateOne(
        { _id: SCHEDULE_GUARD_ID },
        { $inc: { revision: 1 } },
        { session },
      );
      await work(session);
    });
  } finally {
    await session.endSession();
  }
}

function isDuplicateKey(error: unknown) {
  return !!error && typeof error === "object" && "code" in error && error.code === 11000;
}
