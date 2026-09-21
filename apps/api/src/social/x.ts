import { TwitterApi } from "twitter-api-v2";

import { getXOauth1Credentials } from "../env";

export function createXClient() {
  const credentials = getXOauth1Credentials();

  return new TwitterApi({
    appKey: credentials.appKey,
    appSecret: credentials.appSecret,
    accessToken: credentials.accessToken,
    accessSecret: credentials.accessSecret
  });
}
