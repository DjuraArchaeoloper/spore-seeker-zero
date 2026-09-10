export type SiwsPayload = {
  domain: string;
  statement: string;
  uri: string;
  version: "1";
  chainId: "solana:mainnet";
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
  const response = await sporeFetch("/api/auth/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      nonce,
      signInResult
    })
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

function getApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("SPORE is not configured.");
  }

  return API_BASE_URL.replace(/\/$/, "");
}

async function sporeFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, init);

  if (!response.ok) {
    throw new Error("Authentication failed.");
  }

  return response;
}
