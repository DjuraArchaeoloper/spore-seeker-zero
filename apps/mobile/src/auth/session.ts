import * as SecureStore from "expo-secure-store";

const SESSION_TOKEN_KEY = "spore.sessionToken";

export async function getStoredSessionToken() {
  return SecureStore.getItemAsync(SESSION_TOKEN_KEY);
}

export async function storeSessionToken(token: string) {
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
}

export async function clearSessionToken() {
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
}
