import { connectToDatabase } from "../db/mongoose";
import { CANONICAL_SPECIES_KEY, SpeciesStateModel } from "../models/SpeciesState";
import { OrganismIndexModel } from "../models/OrganismIndex";
import { OrganismDescendantCounterModel } from "../models/OrganismDescendantCounter";
import { OutbreakContributionModel } from "../models/OutbreakContribution";
import { OutbreakSeasonModel, type OutbreakSeason } from "../models/OutbreakSeason";
import { SkrRewardModel, SKR_PAYOUT_STATUSES, SKR_REWARD_ROLES } from "../models/SkrReward";
import { finalizedOrganismFilter } from "../spore/organismState";
import { getCampaign, listCampaigns, type CampaignLifecycle } from "../outbreak/campaigns";

type RewardGroup = { _id: { role: string; status: string }; count: number };
type PointGroup = { _id: string; points: number; events: number };

export function campaignView(campaign: OutbreakSeason, lifecycle: CampaignLifecycle) {
  const config = campaign.skrCampaign!;
  const fundedBirths = campaign.skrFundedBirths?.toString() ?? "0";
  const pair = BigInt(config.parentRewardAtomic) + BigInt(config.newSeekerRewardAtomic);
  const committedAtomic = (BigInt(fundedBirths) * pair).toString();
  const remainingAtomic = (BigInt(config.budgetAtomic) - BigInt(committedAtomic)).toString();
  const budgetUsageBps = Number(BigInt(committedAtomic) * 10_000n / BigInt(config.budgetAtomic));
  return {
    seasonId: campaign.seasonId,
    title: campaign.title || campaign.seasonId,
    startsAt: campaign.startsAt.toISOString(),
    endsAt: campaign.endsAt.toISOString(),
    cancelledAt: campaign.cancelledAt?.toISOString() ?? null,
    lifecycle,
    parentRewardAtomic: config.parentRewardAtomic,
    newSeekerRewardAtomic: config.newSeekerRewardAtomic,
    budgetAtomic: config.budgetAtomic,
    tokenMint: config.tokenMint,
    decimals: config.decimals,
    fundedBirths,
    committedAtomic,
    remainingAtomic,
    budgetUsageBps,
  };
}

export async function listCampaignViews() {
  return (await listCampaigns()).map(({ campaign, lifecycle }) => campaignView(campaign, lifecycle));
}

export async function getCampaignDetail(seasonId: string) {
  const found = await getCampaign(seasonId);
  if (!found) return null;
  const { campaign, lifecycle } = found;
  const qualifiedEnd = campaign.cancelledAt && campaign.cancelledAt < campaign.endsAt
    ? campaign.cancelledAt : campaign.endsAt;
  const [qualifyingBirths, groups, uniqueRecipients, points] = await Promise.all([
    OrganismIndexModel.countDocuments({
      ...finalizedOrganismFilter,
      organismNumber: { $ne: "0" },
      parentOrganismPda: { $type: "string" },
      coreAsset: { $type: "string" },
      bornAt: { $gte: campaign.startsAt, $lt: qualifiedEnd },
    }),
    SkrRewardModel.aggregate<RewardGroup>([
      { $match: { campaignId: seasonId } },
      { $group: { _id: { role: "$role", status: "$payoutStatus" }, count: { $sum: 1 } } },
    ]),
    SkrRewardModel.aggregate<{ count: number }>([
      { $match: { campaignId: seasonId } },
      { $group: { _id: "$recipientSgtMint" } },
      { $count: "count" },
    ]),
    OutbreakContributionModel.aggregate<PointGroup>([
      { $match: { seasonId } },
      { $group: { _id: "$eventType", points: { $sum: "$points" }, events: { $sum: 1 } } },
    ]),
  ]);
  const count = (role: string) => groups.filter((row) => row._id.role === role).reduce((sum, row) => sum + row.count, 0);
  const statusCount = (status: string) => groups.filter((row) => row._id.status === status).reduce((sum, row) => sum + row.count, 0);
  return {
    ...campaignView(campaign, lifecycle),
    qualifyingBirths,
    uniqueRewardedSgts: uniqueRecipients[0]?.count ?? 0,
    parentRewards: count("parent"),
    newSeekerRewards: count("newSeeker"),
    parentRewardTotalAtomic: (BigInt(count("parent")) * BigInt(campaign.skrCampaign!.parentRewardAtomic)).toString(),
    newSeekerRewardTotalAtomic: (BigInt(count("newSeeker")) * BigInt(campaign.skrCampaign!.newSeekerRewardAtomic)).toString(),
    payoutCounts: Object.fromEntries(SKR_PAYOUT_STATUSES.map((status) => [status, statusCount(status)])),
    points: {
      total: points.reduce((sum, row) => sum + row.points, 0),
      direct: points.find((row) => row._id === "direct_birth")?.points ?? 0,
      lineage: points.find((row) => row._id === "lineage_continuation")?.points ?? 0,
    },
  };
}

export async function getOverview() {
  await connectToDatabase();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const birthsFilter = {
    ...finalizedOrganismFilter,
    organismNumber: { $ne: "0" },
    parentOrganismPda: { $type: "string" as const },
    coreAsset: { $type: "string" as const },
  };
  const [species, indexedPopulation, births, recentBirths, parents, points, rewardGroups, leaders, campaigns] = await Promise.all([
    SpeciesStateModel.findOne({ key: CANONICAL_SPECIES_KEY }).select({ totalOrganisms: 1 }).lean(),
    OrganismIndexModel.countDocuments(finalizedOrganismFilter),
    OrganismIndexModel.countDocuments(birthsFilter),
    OrganismIndexModel.countDocuments({ ...birthsFilter, bornAt: { $gte: since } }),
    OrganismIndexModel.aggregate<{ count: number }>([
      { $match: birthsFilter }, { $group: { _id: "$parentOrganismPda" } }, { $count: "count" },
    ]),
    OutbreakContributionModel.aggregate<{ _id: null; total: number }>([
      { $group: { _id: null, total: { $sum: "$points" } } },
    ]),
    SkrRewardModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$payoutStatus", count: { $sum: 1 } } },
    ]),
    OrganismDescendantCounterModel.find({ totalDescendants: { $gt: 0 } })
      .sort({ totalDescendants: -1, organismNumberSortKey: 1 }).limit(5)
      .select({ organismNumber: 1, totalDescendants: 1 }).lean(),
    listCampaignViews(),
  ]);
  const activeCampaign = campaigns.find((campaign) => campaign.lifecycle === "active");
  return {
    totalPopulation: species?.totalOrganisms ?? String(indexedPopulation),
    births,
    directReproduction: { last30Days: recentBirths, uniqueParents: parents[0]?.count ?? 0 },
    pointsTotal: points[0]?.total ?? 0,
    payoutCounts: Object.fromEntries(SKR_PAYOUT_STATUSES.map((status) => [status, rewardGroups.find((row) => row._id === status)?.count ?? 0])),
    campaignCounts: Object.fromEntries((["scheduled", "active", "ended", "cancelled"] as const).map((status) => [status, campaigns.filter((campaign) => campaign.lifecycle === status).length])),
    activeCampaign: activeCampaign ? await getCampaignDetail(activeCampaign.seasonId) : null,
    nextScheduled: campaigns.filter((campaign) => campaign.lifecycle === "scheduled").sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null,
    topDescendants: leaders.map((leader) => ({ organismNumber: leader.organismNumber, totalDescendants: leader.totalDescendants })),
  };
}

export async function listRewardLedger(search: URLSearchParams) {
  await connectToDatabase();
  const campaignId = search.get("campaignId") ?? "";
  const status = search.get("status") ?? "";
  const role = search.get("role") ?? "";
  if (campaignId && !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(campaignId)) throw new Error("Invalid campaign filter.");
  if (status && !SKR_PAYOUT_STATUSES.includes(status as typeof SKR_PAYOUT_STATUSES[number])) throw new Error("Invalid status filter.");
  if (role && !SKR_REWARD_ROLES.includes(role as typeof SKR_REWARD_ROLES[number])) throw new Error("Invalid role filter.");
  const filter = {
    ...(campaignId ? { campaignId } : {}),
    ...(status ? { payoutStatus: status } : {}),
    ...(role ? { role } : {}),
  };
  const pageRaw = search.get("page") ?? "1";
  if (!/^[1-9][0-9]{0,5}$/.test(pageRaw)) throw new Error("Invalid page.");
  const page = Number(pageRaw);
  const limit = 50;
  const [total, rewards] = await Promise.all([
    SkrRewardModel.countDocuments(filter),
    SkrRewardModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  const titles = new Map((await OutbreakSeasonModel.find({ seasonId: { $in: [...new Set(rewards.map((reward) => reward.campaignId))] } })
    .select({ seasonId: 1, title: 1 }).lean()).map((campaign) => [campaign.seasonId, campaign.title || campaign.seasonId]));
  return {
    page, limit, total,
    rows: rewards.map((reward) => ({
      id: reward._id,
      campaignId: reward.campaignId,
      campaignTitle: titles.get(reward.campaignId) ?? reward.campaignId,
      birth: reward.birthReference ?? reward.childSgtMint,
      recipientSgtMint: reward.recipientSgtMint,
      role: reward.role,
      amountAtomic: reward.amountAtomic,
      decimals: reward.decimals,
      payoutStatus: reward.payoutStatus,
      createdAt: reward.createdAt.toISOString(),
    })),
  };
}
