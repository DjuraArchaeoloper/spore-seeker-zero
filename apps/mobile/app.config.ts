import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const isDevnet = process.env.EXPO_PUBLIC_SPORE_ENV === "devnet";

  return {
    ...config,

    name: isDevnet ? "SPØR Dev" : "SPØR",
    slug: config.slug ?? "spore-seeker-zero",

    android: {
      ...config.android,
      package: isDevnet ? "com.spor.seekerzero.dev" : "com.spor.seekerzero",
    },
  };
};
