import type { MobileSignInResult, SiwsPayload } from "./api";
import type { AuthIdentity } from "./api";
import { Buffer } from "buffer";
import { ComputeBudgetProgram, PublicKey, Transaction, type Connection, type TransactionInstruction } from "@solana/web3.js";
import { sporeWalletChain } from "../spore/config";
import { SporeFailure } from "../spore/payload";

export async function sendWalletTransaction(connection: Connection, identity: AuthIdentity, instruction: TransactionInstruction) {
  if (process.env.EXPO_PUBLIC_SPORE_VISUAL_PREVIEW === "true") throw new SporeFailure("Reproduction is unavailable in visual preview.");
  const { transact } = await import("@solana-mobile/mobile-wallet-adapter-protocol-web3js");
  let signature: string | undefined;
  try {
    const submitted = await transact(async (wallet) => {
      const authorization = await wallet.authorize({
        chain: sporeWalletChain(),
        identity: { name: "SPORE", uri: process.env.EXPO_PUBLIC_SPORE_API_URL! },
      });
      const owner = new PublicKey(identity.walletAddress);
      if (!authorization.accounts.some((account) => new PublicKey("publicKey" in account ? account.publicKey : Buffer.from(account.address, "base64")).equals(owner))) {
        throw new SporeFailure("Select the wallet you used to sign in.");
      }
      const latest = await connection.getLatestBlockhashAndContext("confirmed");
      const transaction = new Transaction({ ...latest.value, feePayer: owner }).add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), instruction,
      );
      const signatures = await wallet.signAndSendTransactions({ transactions: [transaction], minContextSlot: latest.context.slot });
      signature = signatures[0];
      if (!signature) throw new Error();
      return { signature, ...latest.value };
    });
    const result = await connection.confirmTransaction(submitted, "confirmed");
    if (result.value.err) {
      // Retain only numeric program codes for development; no transaction/log payloads.
      const detail = result.value.err as { InstructionError?: [number, { Custom?: number }] };
      const code = detail.InstructionError?.[1]?.Custom;
      if (__DEV__ && typeof code === "number") console.warn("SPORE program failure code", code);
      const messages: Record<number, string> = {
        6004: "Your spore is not ready.", 6005: "An offer is still active. Wait for it to expire.",
        6007: "This offer was already claimed or replaced.", 6008: "This spore offer has expired.",
        6009: "This offer was already claimed or replaced.",
      };
      throw new SporeFailure(messages[code ?? -1] ?? "The transaction failed. Refresh and try again.");
    }
    return result.context.slot;
  } catch (error) {
    if (error instanceof SporeFailure) throw error;
    const code = (error as { code?: unknown } | null)?.code;
    if (code === -3 || code === 4001 || code === "ERROR_ASSOCIATION_CANCELLED") throw new SporeFailure("Wallet transaction rejected.");
    throw new SporeFailure(signature
      ? "Transaction submitted; confirmation is unavailable. Refresh to check its result before trying again."
      : "The wallet could not complete the transaction. Refresh to check its result before trying again.");
  }
}

export async function requestWalletSignIn(signInPayload: SiwsPayload): Promise<MobileSignInResult> {
  try {
    const { transact } = await import("@solana-mobile/mobile-wallet-adapter-protocol-web3js");
    const signInResult = await transact(async (wallet) => {
      const authorization = await wallet.authorize({
        chain: signInPayload.chainId,
        identity: {
          name: "SPORE",
          uri: signInPayload.uri
        },
        sign_in_payload: signInPayload
      });

      return authorization.sign_in_result;
    });

    if (!signInResult) {
      throw new Error("Authentication failed.");
    }

    return signInResult;
  } catch {
    throw new Error("Authentication failed.");
  }
}
