import mongoose from "mongoose";

import { connectToDatabase } from "../src/db/mongoose";
import { CampaignBirthModel } from "../src/models/CampaignBirth";
import { ORGANISM_BIRTH_ERA, OrganismIndexModel, type OrganismIndex } from "../src/models/OrganismIndex";
import { OutbreakSeasonModel } from "../src/models/OutbreakSeason";
import {
  ensureCampaignBirthReceipt,
  processVerifiedBirth,
  toVerifiedBirth,
} from "../src/outbreak/verifiedBirth";
import { finalizedOrganismFilter } from "../src/spore/organismState";

mongoose.set("autoIndex", false);

async function main() {
  await connectToDatabase();
  const campaigns = await OutbreakSeasonModel.find({ skrCampaign: { $exists: true } })
    .select({ startsAt: 1, endsAt: 1 }).lean();
  if (campaigns.length === 0) {
    console.log("No reward campaigns to reconcile.");
    return;
  }

  const firstStart = new Date(campaigns.reduce(
    (first, campaign) => Math.min(first, campaign.startsAt.getTime()), Infinity,
  ));
  const lastEnd = new Date(campaigns.reduce(
    (last, campaign) => Math.max(last, campaign.endsAt.getTime()), -Infinity,
  ));
  let afterSgt: string | null = null;
  let checked = 0;
  let failed = 0;

  while (true) {
    const organisms: OrganismIndex[] = await OrganismIndexModel.find({
      ...finalizedOrganismFilter,
      birthEra: ORGANISM_BIRTH_ERA.serverV1,
      organismNumber: { $ne: "0" },
      coreAsset: { $type: "string" },
      parentOrganismPda: { $type: "string" },
      bornAt: { $gte: firstStart, $lt: lastEnd },
      ...(afterSgt ? { sgtMint: { $gt: afterSgt } } : {}),
    }).sort({ sgtMint: 1 }).limit(100).lean();
    if (organisms.length === 0) break;

    for (const organism of organisms) {
      afterSgt = organism.sgtMint;
      const receipt = await CampaignBirthModel.findById(organism.sgtMint)
        .select({ processedAt: 1 }).lean();
      if (receipt?.processedAt) continue;
      checked += 1;
      try {
        await ensureCampaignBirthReceipt(organism.sgtMint);
        const birth = await toVerifiedBirth(organism);
        if (!birth) throw new Error("Finalized birth could not be verified for rewards.");
        await processVerifiedBirth(birth);
      } catch (error) {
        failed += 1;
        console.error("Campaign birth reconciliation failed.", {
          childSgtMint: organism.sgtMint,
          reason: error instanceof Error ? error.name : "Unknown",
        });
      }
    }
  }

  console.log(`Campaign births checked: ${checked}; failures: ${failed}.`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error("Campaign birth reconciliation stopped.", {
      reason: error instanceof Error ? error.name : "Unknown",
    });
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
