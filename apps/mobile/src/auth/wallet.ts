import type { MobileSignInResult, SiwsPayload } from "./api";

export async function requestWalletSignIn(signInPayload: SiwsPayload): Promise<MobileSignInResult> {
  try {
    const { transact } = await import("@solana-mobile/mobile-wallet-adapter-protocol-web3js");
    const signInResult = await transact(async (wallet) => {
      const authorization = await wallet.authorize({
        chain: "solana:mainnet",
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
