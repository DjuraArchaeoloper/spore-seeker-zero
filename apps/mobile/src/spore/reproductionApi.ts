import type { AuthIdentity, PublicOrganism } from "../auth/api";
import { getStoredSessionToken } from "../auth/session";
import { SporeFailure } from "./payload";

export type OwnOrganismResponse = PublicOrganism & {
  nextSporeAt: string;
  activeSporeCommitment: string;
  activeSporeExpiresAt: string;
};

export type ReleaseSporeResponse = {
  organismNumber: string;
  organismPda: string;
  activeSporeExpiresAt: string;
};

export type ReserveClaimResponse = {
  reservationId: string;
  status: string;
  parentOrganismPda: string;
  parentOrganismNumber: string;
  birthFeeLamports: string;
  preparedAt: string;
};

export type SettlementResponse = {
  reservationId: string;
  status: string;
  transaction: string;
  encoding: "base64";
  lastValidBlockHeight: number;
  birthFeeLamports: string;
};

export type ConfirmClaimResponse = {
  reservationId: string;
  status: string;
  organism: PublicOrganism;
};

type SporeErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

const DNS_RETRY_DELAY_MS = 500;
const CONFIRM_RETRY_ATTEMPTS = 5;
const CONFIRM_RETRY_DELAY_MS = 900;

function getApiBaseUrl() {
  const base = process.env.EXPO_PUBLIC_SPORE_API_URL;
  if (!base) throw new SporeFailure("SPØR is not configured.");
  return base.replace(/\/$/, "");
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isTransientDnsFailure(error: unknown) {
  if (!(error instanceof Error)) return false;
  const { message } = error;
  return (
    message.includes("UnknownHostException") ||
    message.includes("Unable to resolve host") ||
    message.includes("No address associated with hostname")
  );
}

async function readSporeError(response: Response): Promise<SporeFailure> {
  try {
    const body = (await response.json()) as SporeErrorBody;
    const message = body.error?.message;
    if (typeof message === "string" && message.length > 0) {
      return new SporeFailure(mapSporeUserMessage(message));
    }
  } catch {
    // Fall through to status defaults.
  }

  if (response.status === 401) {
    return new SporeFailure("Sign in again to continue.");
  }

  return new SporeFailure("Unable to reach SPØR. Please try again.");
}

function mapSporeUserMessage(message: string) {
  switch (message) {
    case "Organism spore is not ready.":
      return "Your spore is not ready.";
    case "Spore offer has expired.":
      return "This spore offer has expired.";
    case "No active spore is available.":
    case "Invalid spore secret.":
      return "This offer was already claimed or replaced.";
    case "An active spore offer already exists.":
    case "An active spore is already released.":
      return "An offer is still active. Wait for it to expire.";
    default:
      return message;
  }
}

async function sporeReproductionFetch(
  path: string,
  init: RequestInit,
  fallbackMessage = "Unable to reach SPØR. Please try again.",
) {
  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, init);
  } catch (error) {
    if (!isTransientDnsFailure(error)) {
      throw error instanceof SporeFailure
        ? error
        : new SporeFailure(fallbackMessage);
    }

    await delay(DNS_RETRY_DELAY_MS);

    try {
      response = await fetch(`${getApiBaseUrl()}${path}`, init);
    } catch {
      throw new SporeFailure(fallbackMessage);
    }
  }

  if (!response.ok) {
    throw await readSporeError(response);
  }

  return response;
}

async function requireSessionToken() {
  const token = await getStoredSessionToken();
  if (!token) throw new SporeFailure("Sign in again to continue.");
  return token;
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function fetchOwnOrganismFromApi(
  _identity: AuthIdentity,
): Promise<OwnOrganismResponse | null> {
  const token = await requireSessionToken();
  const response = await sporeReproductionFetch(
    "/api/organisms/me",
    { headers: { Authorization: `Bearer ${token}` } },
    "Your organism is unavailable.",
  );
  const body = (await response.json()) as {
    organism: OwnOrganismResponse | null;
  };
  return body.organism ?? null;
}

export async function releaseSporeViaApi(secretBase64Url: string) {
  const token = await requireSessionToken();
  const response = await sporeReproductionFetch(
    "/api/spore/release",
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ secret: secretBase64Url }),
    },
    "Unable to release spore.",
  );
  return (await response.json()) as ReleaseSporeResponse;
}

export async function reserveClaimViaApi(input: {
  parentOrganismPda: string;
  secretBase64Url: string;
}) {
  const token = await requireSessionToken();
  const response = await sporeReproductionFetch(
    "/api/spore/claim/reserve",
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        parentOrganismPda: input.parentOrganismPda,
        secret: input.secretBase64Url,
      }),
    },
    "Unable to reserve this spore.",
  );
  return (await response.json()) as ReserveClaimResponse;
}

export async function fetchClaimSettlementViaApi(reservationId: string) {
  const token = await requireSessionToken();
  const response = await sporeReproductionFetch(
    "/api/spore/claim/settlement",
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ reservationId }),
    },
    "Unable to prepare settlement.",
  );
  return (await response.json()) as SettlementResponse;
}

export async function confirmClaimViaApi(input: {
  reservationId: string;
  transactionSignature: string;
}) {
  const token = await requireSessionToken();
  const response = await sporeReproductionFetch(
    "/api/spore/claim/confirm",
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        reservationId: input.reservationId,
        transactionSignature: input.transactionSignature,
      }),
    },
    "Unable to confirm birth.",
  );
  return (await response.json()) as ConfirmClaimResponse;
}

export async function confirmClaimWithRetry(input: {
  reservationId: string;
  transactionSignature: string;
}) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < CONFIRM_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await confirmClaimViaApi(input);
    } catch (error) {
      lastError = error;
      if (error instanceof SporeFailure) {
        const message = error.message.toLowerCase();
        // Deterministic terminal failures should not spin.
        if (
          message.includes("already owns") ||
          message.includes("expired") ||
          message.includes("invalid spore") ||
          message.includes("no active spore") ||
          message.includes("unauthorized") ||
          message.includes("sign in")
        ) {
          throw error;
        }
      }

      if (attempt < CONFIRM_RETRY_ATTEMPTS - 1) {
        await delay(CONFIRM_RETRY_DELAY_MS);
      }
    }
  }

  throw lastError instanceof SporeFailure
    ? lastError
    : new SporeFailure(
        "Transaction submitted; confirmation is unavailable. Refresh to check its result before trying again.",
      );
}

export async function abandonClaimViaApi(reservationId: string) {
  const token = await requireSessionToken();
  await sporeReproductionFetch(
    "/api/spore/claim/abandon",
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ reservationId }),
    },
    "Unable to abandon reservation.",
  );
}
