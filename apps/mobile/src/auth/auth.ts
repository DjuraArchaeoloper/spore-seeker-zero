import { getCurrentIdentity, logoutSession, requestSiwsPayload, verifyWalletSignIn, type AuthIdentity } from "./api";
import { clearSessionToken, getStoredSessionToken, storeSessionToken } from "./session";

export async function restoreSession(): Promise<AuthIdentity | null> {
  const token = await getStoredSessionToken();

  if (!token) {
    return null;
  }

  try {
    return await getCurrentIdentity(token);
  } catch {
    await clearSessionToken();
    return null;
  }
}

export async function signInToSpore(): Promise<AuthIdentity> {
  try {
    const signInPayload = await requestSiwsPayload();
    const { requestWalletSignIn } = await import("./wallet");
    const signInResult = await requestWalletSignIn(signInPayload);

    console.warn("[AUTH MOBILE DEBUG] verify_about_to_start");

    const session = await verifyWalletSignIn(signInPayload.nonce, signInResult);

    console.warn("[AUTH MOBILE DEBUG] verify_complete");
    console.warn("[AUTH MOBILE DEBUG] session_store_start");

    await storeSessionToken(session.token);

    console.warn("[AUTH MOBILE DEBUG] session_store_complete");

    return session.seeker;
  } catch (error) {
    console.warn("[AUTH MOBILE DEBUG] sign_in_failed", {
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : "unknown"
    });

    throw error;
  }
}

export async function signOutOfSpore() {
  const token = await getStoredSessionToken();

  if (token) {
    try {
      await logoutSession(token);
    } finally {
      await clearSessionToken();
    }
  }
}
