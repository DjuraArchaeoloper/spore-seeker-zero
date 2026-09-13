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
  const signInPayload = await requestSiwsPayload();
  const { requestWalletSignIn } = await import("./wallet");
  const signInResult = await requestWalletSignIn(signInPayload);

  const session = await verifyWalletSignIn(signInPayload.nonce, signInResult);

  await storeSessionToken(session.token);

  return session.seeker;
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
