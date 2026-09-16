import { Connection, PublicKey } from "@solana/web3.js";
import {
  getGroupMemberPointerState,
  getMetadataPointerState,
  getTokenGroupMemberState,
  TOKEN_2022_PROGRAM_ID,
  unpackMint
} from "@solana/spl-token";

import { getHeliusRpcUrl, getSgtVerificationConfig, getSolanaCluster } from "../env";
const TOKEN_ACCOUNT_PAGE_LIMIT = 1000;
const MINT_ACCOUNT_BATCH_SIZE = 100;
const MAX_TOKEN_ACCOUNT_PAGES = 50;

type HeliusTokenAccount = {
  account?: {
    data?: {
      parsed?: {
        info?: {
          mint?: unknown;
          owner?: unknown;
          state?: unknown;
          tokenAmount?: {
            amount?: unknown;
          };
        };
      };
    };
  };
};

type HeliusTokenAccountsValue =
  | HeliusTokenAccount[]
  | {
      accounts?: HeliusTokenAccount[];
      paginationKey?: string | null;
    };

type HeliusTokenAccountsResponse = {
  result?: {
    value?: HeliusTokenAccountsValue;
  };
  error?: unknown;
};

export type SgtVerificationResult = {
  mintAddress: string;
};

type SgtVerificationOptions = {
  expectedMintAddress?: string;
};

export class SgtVerificationUnavailableError extends Error {
  constructor() {
    super("SGT verification is unavailable.");
  }
}

export async function verifySeekerGenesisToken(
  walletAddress: string,
  options: SgtVerificationOptions = {}
): Promise<SgtVerificationResult | null> {
  const walletPublicKey = new PublicKey(walletAddress);
  const normalizedWalletAddress = walletPublicKey.toBase58();
  const cluster = getSolanaCluster();
  const expectedMintAddress = options.expectedMintAddress
    ? new PublicKey(options.expectedMintAddress).toBase58()
    : null;

  console.log("[SGT DEBUG]", {
    phase: "lookup_start",
    walletAddress: normalizedWalletAddress,
    cluster,
    expectedMintAddress
  });

  const heliusRpcUrl = getHeliusRpcUrl();
  const connection = new Connection(heliusRpcUrl, "confirmed");
  const candidateMints = (await getToken2022MintsForWallet(heliusRpcUrl, normalizedWalletAddress)).filter(
    (mint) => !expectedMintAddress || mint.toBase58() === expectedMintAddress
  );
  const candidateMintAddresses = candidateMints.map((mint) => mint.toBase58());

  console.log("[SGT DEBUG]", {
    phase: "candidates_found",
    walletAddress: normalizedWalletAddress,
    candidateCount: candidateMintAddresses.length,
    candidateMintAddresses
  });

  if (candidateMints.length === 0) {
    console.log("[SGT DEBUG]", {
      phase: "no_candidates",
      walletAddress: normalizedWalletAddress,
      cluster
    });
    console.log("[SGT DEBUG]", {
      phase: "sgt_lookup_complete",
      walletAddress: normalizedWalletAddress,
      cluster,
      expectedMintAddress,
      candidateCount: 0,
      verified: false,
      mintAddress: null
    });

    return null;
  }

  let checkedCandidateCount = 0;

  for (let index = 0; index < candidateMints.length; index += MINT_ACCOUNT_BATCH_SIZE) {
    const batch = candidateMints.slice(index, index + MINT_ACCOUNT_BATCH_SIZE);
    const mintAccounts = await connection.getMultipleAccountsInfo(batch, "confirmed");

    for (let mintIndex = 0; mintIndex < batch.length; mintIndex += 1) {
      const accountInfo = mintAccounts[mintIndex];
      const mintAddress = batch[mintIndex];

      if (!accountInfo || !mintAddress) {
        console.log("[SGT ERROR DEBUG]", {
          phase: "candidate_account_missing",
          candidateMintAddress: mintAddress?.toBase58() ?? null
        });

        continue;
      }

      checkedCandidateCount += 1;

      if (safeIsVerifiedSgtMint(mintAddress, accountInfo)) {
        console.log("[SGT DEBUG]", {
          phase: "sgt_lookup_complete",
          walletAddress: normalizedWalletAddress,
          cluster,
          expectedMintAddress,
          candidateCount: candidateMintAddresses.length,
          checkedCandidateCount,
          verified: true,
          mintAddress: mintAddress.toBase58()
        });

        return {
          mintAddress: mintAddress.toBase58()
        };
      }
    }
  }

  console.log("[SGT DEBUG]", {
    phase: "sgt_lookup_complete",
    walletAddress: normalizedWalletAddress,
    cluster,
    expectedMintAddress,
    candidateCount: candidateMintAddresses.length,
    checkedCandidateCount,
    verified: false,
    mintAddress: null
  });

  return null;
}

async function getToken2022MintsForWallet(heliusRpcUrl: string, walletAddress: string) {
  const mintAddresses = new Set<string>();
  const seenPaginationKeys = new Set<string>();
  let paginationKey: string | null = null;
  let page = 0;

  do {
    page += 1;

    if (page > MAX_TOKEN_ACCOUNT_PAGES) {
      throw new SgtVerificationUnavailableError();
    }

    let response: Response;

    try {
      response = await fetch(heliusRpcUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "spore-sgt-lookup",
          method: "getTokenAccountsByOwnerV2",
          params: [
            walletAddress,
            {
              programId: TOKEN_2022_PROGRAM_ID.toBase58()
            },
            {
              encoding: "jsonParsed",
              limit: TOKEN_ACCOUNT_PAGE_LIMIT,
              withContext: true,
              ...(paginationKey ? { paginationKey } : {})
            }
          ]
        })
      });
    } catch {
      throw new SgtVerificationUnavailableError();
    }

    if (!response.ok) {
      throw new SgtVerificationUnavailableError();
    }

    let body: HeliusTokenAccountsResponse;

    try {
      body = (await response.json()) as HeliusTokenAccountsResponse;
    } catch {
      throw new SgtVerificationUnavailableError();
    }

    if (body.error) {
      throw new SgtVerificationUnavailableError();
    }

    const pageResult = getTokenAccountsPage(body.result?.value);

    if (!pageResult) {
      throw new SgtVerificationUnavailableError();
    }

    const { accounts } = pageResult;

    for (const tokenAccount of accounts) {
      const info = tokenAccount.account?.data?.parsed?.info;
      const mint = info?.mint;
      const owner = info?.owner;
      const state = info?.state;
      const amount = info?.tokenAmount?.amount;

      if (typeof mint !== "string" || typeof owner !== "string" || typeof amount !== "string" || typeof state !== "string") {
        continue;
      }

      if (owner !== walletAddress || amount !== "1" || !isInitializedTokenAccountState(state)) {
        continue;
      }

      const mintPublicKey = tryPublicKey(mint);

      if (mintPublicKey) {
        mintAddresses.add(mintPublicKey.toBase58());
      }
    }

    paginationKey = pageResult.paginationKey;

    if (paginationKey) {
      if (seenPaginationKeys.has(paginationKey)) {
        throw new SgtVerificationUnavailableError();
      }

      seenPaginationKeys.add(paginationKey);
    }
  } while (paginationKey);

  return Array.from(mintAddresses).map((mint) => new PublicKey(mint));
}

function getTokenAccountsPage(value: HeliusTokenAccountsValue | undefined) {
  if (Array.isArray(value)) {
    return {
      accounts: value,
      paginationKey: null
    };
  }

  if (!value || typeof value !== "object" || !("accounts" in value)) {
    return null;
  }

  const { accounts, paginationKey } = value;

  if (!Array.isArray(accounts)) {
    return null;
  }

  return {
    accounts,
    paginationKey: typeof paginationKey === "string" ? paginationKey : null
  };
}

function isInitializedTokenAccountState(state: string) {
  return state === "initialized" || state === "frozen";
}

function safeIsVerifiedSgtMint(mintAddress: PublicKey, accountInfo: Parameters<typeof unpackMint>[1]) {
  try {
    return isVerifiedSgtMint(mintAddress, accountInfo);
  } catch (error) {
    console.log("[SGT ERROR DEBUG]", {
      phase: "candidate_verify_error",
      candidateMintAddress: mintAddress.toBase58(),
      errorMessage: getSafeErrorMessage(error)
    });

    return false;
  }
}

function isVerifiedSgtMint(mintAddress: PublicKey, accountInfo: Parameters<typeof unpackMint>[1]) {
  try {
    const config = getSgtVerificationConfig();
    const mint = unpackMint(mintAddress, accountInfo, TOKEN_2022_PROGRAM_ID);
    const metadataPointer = getMetadataPointerState(mint);
    const groupMemberPointer = getGroupMemberPointerState(mint);
    const tokenGroupMemberState = getTokenGroupMemberState(mint);
    const candidateMintAddress = mintAddress.toBase58();
    const actual = {
      mintAuthority: mint.mintAuthority?.toBase58() ?? null,
      metadataPointerAuthority: metadataPointer?.authority?.toBase58() ?? null,
      metadataAddress: metadataPointer?.metadataAddress?.toBase58() ?? null,
      groupMemberPointerAuthority: groupMemberPointer?.authority?.toBase58() ?? null,
      groupMemberPointerMemberAddress: groupMemberPointer?.memberAddress?.toBase58() ?? null,
      tokenGroupMemberMint: tokenGroupMemberState?.mint?.toBase58() ?? null,
      tokenGroupMemberGroup: tokenGroupMemberState?.group?.toBase58() ?? null
    };
    const expected = {
      mintAuthority: config.mintAuthority,
      metadataAddress: config.metadataAddress,
      groupAddress: config.groupAddress,
      groupMemberPointerMemberAddress: candidateMintAddress,
      tokenGroupMemberMint: candidateMintAddress
    };
    const checks = {
      mintAuthority: actual.mintAuthority === expected.mintAuthority,
      metadataPointerAuthority: actual.metadataPointerAuthority === expected.mintAuthority,
      metadataAddress: actual.metadataAddress === expected.metadataAddress,
      groupMemberPointerAuthority: actual.groupMemberPointerAuthority === expected.mintAuthority,
      groupMemberPointerMemberAddress: groupMemberPointer?.memberAddress?.equals(mintAddress) === true,
      tokenGroupMemberMint: tokenGroupMemberState?.mint?.equals(mintAddress) === true,
      tokenGroupMemberGroup: actual.tokenGroupMemberGroup === expected.groupAddress
    };

    console.log("[SGT CANDIDATE DEBUG]", {
      phase: "candidate_decoded",
      candidateMintAddress,
      actual,
      expected,
      checks
    });

    return (
      checks.mintAuthority &&
      checks.metadataPointerAuthority &&
      checks.metadataAddress &&
      checks.groupMemberPointerAuthority &&
      checks.groupMemberPointerMemberAddress &&
      checks.tokenGroupMemberMint &&
      checks.tokenGroupMemberGroup
    );
  } catch (error) {
    console.log("[SGT ERROR DEBUG]", {
      phase: "candidate_decode_error",
      candidateMintAddress: mintAddress.toBase58(),
      errorMessage: getSafeErrorMessage(error)
    });

    return false;
  }
}

function getSafeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown SGT decode error.";
}

function tryPublicKey(value: string) {
  try {
    return new PublicKey(value);
  } catch {
    return null;
  }
}
