import * as SecureStore from "expo-secure-store";

import type { BloodlineResponse } from "../auth/api";

export type PropagationMoment = {
  id: "first-child" | "ten-descendants" | "hundred-descendants" | "new-generation";
  title: string;
  detail: string;
};

type SeenPropagationMoments = {
  firstChild?: boolean;
  tenDescendants?: boolean;
  hundredDescendants?: boolean;
  deepestGeneration?: number;
};

const STORAGE_KEY_PREFIX = "spore.propagationMoments.";

export async function consumePropagationMoment(
  bloodline: BloodlineResponse,
): Promise<PropagationMoment | null> {
  const storageKey = getStorageKey(bloodline);

  if (!storageKey) {
    return null;
  }

  const seen = await readSeenMoments(storageKey);
  const nextSeen: SeenPropagationMoments = { ...seen };
  const organismGeneration = bloodline.organism.generation;
  const directChildrenCount = Math.max(
    0,
    bloodline.directChildrenCount ?? bloodline.directChildren?.length ?? 0,
  );
  const totalDescendants = Math.max(0, bloodline.totalDescendants ?? 0);
  const deepestGeneration = Math.max(
    organismGeneration,
    bloodline.deepestDescendantGeneration ?? organismGeneration,
  );
  const candidates: PropagationMoment[] = [];

  if (directChildrenCount > 0 && !seen.firstChild) {
    nextSeen.firstChild = true;
    candidates.push({
      id: "first-child",
      title: "THE BLOODLINE CONTINUES",
      detail: "Your first child was born.",
    });
  }

  if (totalDescendants >= 10 && !seen.tenDescendants) {
    nextSeen.tenDescendants = true;
    candidates.push({
      id: "ten-descendants",
      title: "YOUR BLOODLINE GREW",
      detail: "10 descendants",
    });
  }

  if (totalDescendants >= 100 && !seen.hundredDescendants) {
    nextSeen.hundredDescendants = true;
    candidates.push({
      id: "hundred-descendants",
      title: "YOUR BLOODLINE SPREAD",
      detail: "100 descendants",
    });
  }

  if (deepestGeneration > (seen.deepestGeneration ?? organismGeneration)) {
    nextSeen.deepestGeneration = deepestGeneration;
    candidates.push({
      id: "new-generation",
      title: "NEW GENERATION",
      detail: `Your lineage reached Generation ${deepestGeneration}`,
    });
  } else {
    nextSeen.deepestGeneration = Math.max(
      deepestGeneration,
      seen.deepestGeneration ?? organismGeneration,
    );
  }

  await writeSeenMoments(storageKey, nextSeen);

  return chooseMoment(candidates);
}

function getStorageKey(bloodline: BloodlineResponse) {
  const identity =
    bloodline.organism.organismPda ||
    bloodline.organism.sgtMint ||
    bloodline.organism.organismNumber;

  return identity ? `${STORAGE_KEY_PREFIX}${identity}` : null;
}

async function readSeenMoments(storageKey: string): Promise<SeenPropagationMoments> {
  try {
    const raw = await SecureStore.getItemAsync(storageKey);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!isRecord(parsed)) {
      return {};
    }

    return {
      firstChild: parsed.firstChild === true,
      tenDescendants: parsed.tenDescendants === true,
      hundredDescendants: parsed.hundredDescendants === true,
      deepestGeneration:
        typeof parsed.deepestGeneration === "number" && Number.isFinite(parsed.deepestGeneration)
          ? parsed.deepestGeneration
          : undefined,
    };
  } catch {
    return {};
  }
}

async function writeSeenMoments(storageKey: string, seen: SeenPropagationMoments) {
  try {
    await SecureStore.setItemAsync(storageKey, JSON.stringify(seen));
  } catch {
    // Moment acknowledgement is local polish; never interrupt Bloodline reads for it.
  }
}

function chooseMoment(candidates: PropagationMoment[]) {
  return (
    candidates.find((candidate) => candidate.id === "first-child") ??
    candidates.find((candidate) => candidate.id === "hundred-descendants") ??
    candidates.find((candidate) => candidate.id === "ten-descendants") ??
    candidates.find((candidate) => candidate.id === "new-generation") ??
    null
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
