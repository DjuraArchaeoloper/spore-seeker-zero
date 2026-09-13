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
  console.warn("[AUTH MOBILE DEBUG] verify_serialize_start");

  let body: string;

  try {
    body = JSON.stringify({
      nonce,
      signInResult
    });
  } catch (error) {
    console.warn("[AUTH MOBILE DEBUG] verify_serialize_failed", {
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : "unknown"
    });

    throw error;
  }

  console.warn("[AUTH MOBILE DEBUG] verify_serialize_complete", {
    bodyLength: body.length
  });
  console.warn("[AUTH MOBILE DEBUG] verify_fetch_start");

  const response = await sporeFetch("/api/auth/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body
  });

  console.warn("[AUTH MOBILE DEBUG] verify_fetch_complete", {
    status: response.status
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

function getApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("SPORE is not configured.");
  }

  return API_BASE_URL.replace(/\/$/, "");
}

async function sporeFetch(path: string, init?: RequestInit, message = "Authentication failed.") {
  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, init);
  } catch (error) {
    const errorInfo = getSafeErrorInfo(error);

    console.warn("[AUTH MOBILE DEBUG] spore_fetch_failed", {
      path,
      ...errorInfo
    });

    if (!isTransientDnsFailure(error)) {
      throw error;
    }

    console.warn("[AUTH MOBILE DEBUG] dns_retry_wait", {
      path
    });

    await delay(DNS_RETRY_DELAY_MS);

    console.warn("[AUTH MOBILE DEBUG] dns_retry_start", {
      path
    });

    try {
      response = await fetch(`${getApiBaseUrl()}${path}`, init);
    } catch (retryError) {
      console.warn("[AUTH MOBILE DEBUG] dns_retry_failed", {
        path,
        ...getSafeErrorInfo(retryError)
      });

      throw retryError;
    }

    console.warn("[AUTH MOBILE DEBUG] dns_retry_complete", {
      path,
      status: response.status
    });
  }

  console.warn("[AUTH MOBILE DEBUG] spore_fetch_complete", {
    path,
    status: response.status
  });

  if (!response.ok) {
    console.warn("[AUTH MOBILE DEBUG] spore_fetch_non_2xx", {
      path,
      status: response.status
    });

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

function getSafeErrorInfo(error: unknown) {
  return {
    name: error instanceof Error ? error.name : "unknown",
    message: error instanceof Error ? error.message : "unknown"
  };
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
