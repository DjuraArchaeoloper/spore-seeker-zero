export type SiwsPayload = {
  domain: string;
  statement: string;
  uri: string;
  version: "1";
  chainId: "solana:mainnet" | "solana:devnet";
  nonce: string;
  issuedAt: string;
  expirationTime: string;
};

export type MobileSignInResult = {
  address: string;
  signed_message: string;
  signature: string;
  signature_type?: string;
};

export type AuthIdentity = {
  sgtMint: string;
  walletAddress: string;
};

type VerifyResponse = {
  token: string;
  expiresAt: string;
  seeker: AuthIdentity;
};

const API_BASE_URL = process.env.EXPO_PUBLIC_SPORE_API_URL;
const DNS_RETRY_DELAY_MS = 500;

export type PublicOrganism = {
  organismPda: string;
  organismNumber: string;
  sgtMint: string;
  generation: number;
  genome: string;
  parent: { organismPda: string; organismNumber: string } | null;
  parentOrganismPda: string | null;
  bornAt: string;
  coreAsset: string;
};

export type BloodlineResponse = {
  organism: PublicOrganism;
  ancestors: PublicOrganism[];
  directChildren: PublicOrganism[];
  totalDescendants: number;
};

export type SpeciesResponse = {
  population: number;
  deepestGeneration: number;
  seekerZero: PublicOrganism | null;
};

export type SpeciesMapRegion = {
  key: string;
  label: string;
  countryCode: string | null;
  latitude: number;
  longitude: number;
  births: number;
};

export type SpeciesMapResponse = {
  populationWithLocation: number;
  minimumRegionBirths: number;
  regions: SpeciesMapRegion[];
};

export type SpeciesLeaderboardEntry = {
  organismNumber: string;
  generation: number;
  totalDescendants: number;
};

export type SpeciesLeaderboardResponse = {
  limit: number;
  leaders: SpeciesLeaderboardEntry[];
};

export type BirthLocationSubmission = {
  organismNumber: string;
  transactionSignature: string;
  latitude: number;
  longitude: number;
  countryCode?: string | null;
  countryName?: string | null;
  regionLabel?: string | null;
  cityLabel?: string | null;
};

export type OutbreakSkrPool = {
  tokenMint?: string;
  totalAmount?: string;
  decimals?: number;
  label?: string;
  notes?: string;
};

export type OutbreakResponse =
  | {
      active: false;
    }
  | {
      active: true;
      season: {
        seasonId: string;
        startsAt: string;
        endsAt: string;
        scoringVersion: string;
        skrPool?: OutbreakSkrPool;
      };
      user: {
        points: number;
      };
      global: {
        totalPoints: number;
      };
    };

export async function requestSiwsPayload() {
  const response = await sporeFetch("/api/auth/nonce", {
    method: "POST"
  });
  const body = (await response.json()) as { signInPayload?: SiwsPayload };

  if (!body.signInPayload) {
    throw new Error("Authentication failed.");
  }

  return body.signInPayload;
}

export async function verifyWalletSignIn(nonce: string, signInResult: MobileSignInResult) {
  const body = JSON.stringify({
    nonce,
    signInResult
  });

  const response = await sporeFetch("/api/auth/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body
  });

  return (await response.json()) as VerifyResponse;
}

export async function getCurrentIdentity(token: string) {
  const response = await sporeFetch("/api/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return (await response.json()) as AuthIdentity;
}

export async function logoutSession(token: string) {
  await sporeFetch("/api/auth/logout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function getBloodline(organismNumber: string) {
  const response = await sporeFetch(`/api/organisms/${encodeURIComponent(organismNumber)}`, undefined, "Bloodline is unavailable.");

  return (await response.json()) as BloodlineResponse;
}

export async function getSpecies() {
  const response = await sporeFetch("/api/species", undefined, "Species is unavailable.");

  return (await response.json()) as SpeciesResponse;
}

export async function getSpeciesMap() {
  const response = await sporeFetch("/api/species/map", undefined, "Species map is unavailable.");

  return (await response.json()) as SpeciesMapResponse;
}

export async function getSpeciesLeaderboard(limit = 10) {
  const response = await sporeFetch(
    `/api/species/leaderboard?limit=${encodeURIComponent(String(limit))}`,
    undefined,
    "Species leaderboard is unavailable.",
  );

  return (await response.json()) as SpeciesLeaderboardResponse;
}

export async function submitBirthLocation(token: string, location: BirthLocationSubmission) {
  await sporeFetch(
    "/api/species/birth-location",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(location),
    },
    "Birth location is unavailable.",
  );
}

export async function getOutbreak(token: string) {
  const response = await sporeFetch(
    "/api/outbreak",
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    },
    "Outbreak is unavailable."
  );

  return (await response.json()) as OutbreakResponse;
}

function getApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("SPØR is not configured.");
  }

  return API_BASE_URL.replace(/\/$/, "");
}

async function sporeFetch(path: string, init?: RequestInit, message = "Authentication failed.") {
  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, init);
  } catch (error) {
    if (!isTransientDnsFailure(error)) {
      throw error;
    }

    await delay(DNS_RETRY_DELAY_MS);

    response = await fetch(`${getApiBaseUrl()}${path}`, init);
  }

  if (!response.ok) {
    throw new Error(message);
  }

  return response;
}

function isTransientDnsFailure(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const { message } = error;

  return (
    message.includes("UnknownHostException") ||
    message.includes("Unable to resolve host") ||
    message.includes("No address associated with hostname")
  );
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
