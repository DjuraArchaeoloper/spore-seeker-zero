import crypto from "node:crypto";

import { isPlainObject, type JsonObject } from "../http/request";
import type { OutbreakSkrCampaign } from "../models/OutbreakSeason";
import { CampaignConfigurationError, type CreateCampaignInput, type EditCampaignInput } from "../outbreak/campaigns";

const DECIMAL_PATTERN = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/;
const MAX_U64 = 18_446_744_073_709_551_615n;

/** Admin transport uses decimal SKR strings; persisted rewards use exact base units. */
export function parseCampaignForm(body: JsonObject): CreateCampaignInput;
export function parseCampaignForm(body: JsonObject, seasonId: string): EditCampaignInput;
export function parseCampaignForm(body: JsonObject, seasonId?: string): CreateCampaignInput | EditCampaignInput {
  if (!isPlainObject(body)) throw new CampaignConfigurationError("Invalid campaign form.");
  const title = requiredString(body.title, "title", 80);
  const startsAt = requiredDate(body.startsAt, "start");
  const endsAt = requiredDate(body.endsAt, "end");
  const decimals = body.decimals;
  if (typeof decimals !== "number" || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new CampaignConfigurationError("SKR decimals must be an integer from 0 to 18.");
  }
  const skrCampaign: OutbreakSkrCampaign = {
    parentRewardAtomic: toAtomic(body.parentReward, decimals, "parent reward"),
    newSeekerRewardAtomic: toAtomic(body.newSeekerReward, decimals, "new-Seeker reward"),
    budgetAtomic: toAtomic(body.budget, decimals, "budget"),
    tokenMint: requiredString(body.tokenMint, "SKR mint", 44),
    decimals,
  };
  const common = { title, startsAt, endsAt, skrCampaign };
  return seasonId
    ? common
    : { ...common, seasonId: `campaign-${crypto.randomUUID()}`, scoringVersion: "skr-v1" };
}

function requiredString(value: unknown, label: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new CampaignConfigurationError(`A valid ${label} is required.`);
  }
  return value.trim();
}

function requiredDate(value: unknown, label: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    throw new CampaignConfigurationError(`A valid ${label} time is required.`);
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new CampaignConfigurationError(`A valid ${label} time is required.`);
  }
  return date;
}

function toAtomic(value: unknown, decimals: number, label: string) {
  if (typeof value !== "string" || value.length > 80) {
    throw new CampaignConfigurationError(`${label} must be an exact decimal string.`);
  }
  const match = DECIMAL_PATTERN.exec(value);
  if (!match) throw new CampaignConfigurationError(`${label} must be an exact decimal string.`);
  const fraction = match[1] ?? "";
  if (fraction.length > decimals) {
    throw new CampaignConfigurationError(`${label} has more than ${decimals} decimal places.`);
  }
  const atomic = BigInt(match[0].split(".")[0]) * 10n ** BigInt(decimals) +
    BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
  if (atomic <= 0n || atomic > MAX_U64) {
    throw new CampaignConfigurationError(`${label} must be positive and fit unsigned u64 base units.`);
  }
  return atomic.toString();
}
