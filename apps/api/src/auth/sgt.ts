import { Connection, PublicKey } from "@solana/web3.js";
import {
  getMetadataPointerState,
  getTokenGroupMemberState,
  TOKEN_2022_PROGRAM_ID,
  unpackMint
} from "@solana/spl-token";

import { getHeliusRpcUrl } from "../env";

const SGT_MINT_AUTHORITY = "GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4";
const SGT_METADATA_ADDRESS = "GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te";
const SGT_GROUP_MINT_ADDRESS = "GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te";
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
          tokenAmount?: {
            amount?: unknown;
          };
        };
      };
    };
  };
};

type HeliusTokenAccountsResponse = {
  result?: {
    value?: {
      accounts?: HeliusTokenAccount[];
      paginationKey?: string | null;
    };
  };
  error?: unknown;
};

export type SgtVerificationResult = {
  mintAddress: string;
};

export class SgtVerificationUnavailableError extends Error {
  constructor() {
    super("SGT verification is unavailable.");
  }
}

export async function verifySeekerGenesisToken(walletAddress: string): Promise<SgtVerificationResult | null> {
  const walletPublicKey = new PublicKey(walletAddress);
  const heliusRpcUrl = getHeliusRpcUrl();
  const connection = new Connection(heliusRpcUrl, "confirmed");
  const candidateMints = await getToken2022MintsForWallet(heliusRpcUrl, walletPublicKey.toBase58());

  if (candidateMints.length === 0) {
    return null;
  }

  for (let index = 0; index < candidateMints.length; index += MINT_ACCOUNT_BATCH_SIZE) {
    const batch = candidateMints.slice(index, index + MINT_ACCOUNT_BATCH_SIZE);
    const mintAccounts = await connection.getMultipleAccountsInfo(batch, "confirmed");

    for (let mintIndex = 0; mintIndex < batch.length; mintIndex += 1) {
      const accountInfo = mintAccounts[mintIndex];
      const mintAddress = batch[mintIndex];

      if (!accountInfo || !mintAddress) {
        continue;
      }

      if (isVerifiedSgtMint(mintAddress, accountInfo)) {
        return {
          mintAddress: mintAddress.toBase58()
        };
      }
    }
  }

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

    const accounts = body.result?.value?.accounts;

    if (!Array.isArray(accounts)) {
      throw new SgtVerificationUnavailableError();
    }

    for (const tokenAccount of accounts) {
      const info = tokenAccount.account?.data?.parsed?.info;
      const mint = info?.mint;
      const owner = info?.owner;
      const amount = info?.tokenAmount?.amount;

      if (typeof mint !== "string" || typeof owner !== "string" || typeof amount !== "string") {
        continue;
      }

      if (owner !== walletAddress || amount === "0") {
        continue;
      }

      const mintPublicKey = tryPublicKey(mint);

      if (mintPublicKey) {
        mintAddresses.add(mintPublicKey.toBase58());
      }
    }

    paginationKey = body.result?.value?.paginationKey ?? null;

    if (paginationKey) {
      if (seenPaginationKeys.has(paginationKey)) {
        throw new SgtVerificationUnavailableError();
      }

      seenPaginationKeys.add(paginationKey);
    }
  } while (paginationKey);

  return Array.from(mintAddresses).map((mint) => new PublicKey(mint));
}

function isVerifiedSgtMint(mintAddress: PublicKey, accountInfo: Parameters<typeof unpackMint>[1]) {
  try {
    const mint = unpackMint(mintAddress, accountInfo, TOKEN_2022_PROGRAM_ID);
    const metadataPointer = getMetadataPointerState(mint);
    const tokenGroupMemberState = getTokenGroupMemberState(mint);

    return (
      mint.mintAuthority?.toBase58() === SGT_MINT_AUTHORITY &&
      metadataPointer?.authority?.toBase58() === SGT_MINT_AUTHORITY &&
      metadataPointer?.metadataAddress?.toBase58() === SGT_METADATA_ADDRESS &&
      tokenGroupMemberState?.group?.toBase58() === SGT_GROUP_MINT_ADDRESS
    );
  } catch {
    return false;
  }
}

function tryPublicKey(value: string) {
  try {
    return new PublicKey(value);
  } catch {
    return null;
  }
}
