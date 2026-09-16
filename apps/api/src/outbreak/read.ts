import {
  OutbreakSeasonModel,
  type OutbreakSeason,
  type OutbreakSkrPoolMetadata
} from "../models/OutbreakSeason";
import { OutbreakContributionModel } from "../models/OutbreakContribution";

export type PublicOutbreakSeason = {
  seasonId: string;
  startsAt: string;
  endsAt: string;
  scoringVersion: string;
  skrPool?: OutbreakSkrPoolMetadata;
};

export type OutbreakReadState =
  | {
      active: false;
    }
  | {
      active: true;
      season: PublicOutbreakSeason;
      user: {
        points: number;
      };
      global: {
        totalPoints: number;
      };
    };

export class OutbreakConfigurationError extends Error {
  constructor() {
    super("Outbreak season configuration is invalid.");
  }
}

export async function findActiveOutbreakSeason(now = new Date()) {
  const seasons = await OutbreakSeasonModel.find({
    status: "active",
    startsAt: { $lte: now },
    endsAt: { $gt: now }
  })
    .sort({ startsAt: -1 })
    .limit(2)
    .lean();

  if (seasons.length > 1) {
    throw new OutbreakConfigurationError();
  }

  return seasons[0] ?? null;
}

export async function getOutbreakStateForSeeker(input: {
  sgtMint: string;
  now?: Date;
}): Promise<OutbreakReadState> {
  const season = await findActiveOutbreakSeason(input.now);

  if (!season) {
    return {
      active: false
    };
  }

  const [userPoints, totalPoints] = await Promise.all([
    sumSeasonPoints(season.seasonId, input.sgtMint),
    sumSeasonPoints(season.seasonId)
  ]);

  return {
    active: true,
    season: toPublicSeason(season),
    user: {
      points: userPoints
    },
    global: {
      totalPoints
    }
  };
}

async function sumSeasonPoints(seasonId: string, contributorSgtMint?: string) {
  const match: Record<string, string> = {
    seasonId
  };

  if (contributorSgtMint) {
    match.contributorSgtMint = contributorSgtMint;
  }

  const [result] = await OutbreakContributionModel.aggregate<{ totalPoints: number }>([
    {
      $match: match
    },
    {
      $group: {
        _id: null,
        totalPoints: {
          $sum: "$points"
        }
      }
    }
  ]);

  return result?.totalPoints ?? 0;
}

function toPublicSeason(
  season: Pick<OutbreakSeason, "seasonId" | "startsAt" | "endsAt" | "scoringVersion" | "skrPool">
): PublicOutbreakSeason {
  const publicSeason: PublicOutbreakSeason = {
    seasonId: season.seasonId,
    startsAt: season.startsAt.toISOString(),
    endsAt: season.endsAt.toISOString(),
    scoringVersion: season.scoringVersion
  };
  const skrPool = toPublicSkrPool(season.skrPool);

  if (skrPool) {
    publicSeason.skrPool = skrPool;
  }

  return publicSeason;
}

function toPublicSkrPool(skrPool: OutbreakSkrPoolMetadata | undefined) {
  if (!skrPool) {
    return null;
  }

  const publicPool: OutbreakSkrPoolMetadata = {};

  if (skrPool.tokenMint) {
    publicPool.tokenMint = skrPool.tokenMint;
  }

  if (skrPool.totalAmount) {
    publicPool.totalAmount = skrPool.totalAmount;
  }

  if (typeof skrPool.decimals === "number") {
    publicPool.decimals = skrPool.decimals;
  }

  if (skrPool.label) {
    publicPool.label = skrPool.label;
  }

  if (skrPool.notes) {
    publicPool.notes = skrPool.notes;
  }

  return Object.keys(publicPool).length > 0 ? publicPool : null;
}
