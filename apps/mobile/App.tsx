import { StatusBar, StyleSheet, View } from "react-native";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";

import { AuthEntryScreen } from "./src/screens/AuthEntryScreen";
import { BloodlineScreen } from "./src/screens/BloodlineScreen";
import { SpeciesScreen } from "./src/screens/SpeciesScreen";
import { SpecimenScreen } from "./src/screens/SpecimenScreen";
import { tokens } from "./src/design/tokens";
import {
  BottomNavigation,
  SurfaceKey,
} from "./src/navigation/BottomNavigation";

// Visual preview exists only to render SPORE UI in environments such as Expo Go that do not contain Solana Mobile native modules.
const VISUAL_PREVIEW = process.env.EXPO_PUBLIC_SPORE_VISUAL_PREVIEW === "true";

const screens: Record<SurfaceKey, ComponentType> = {
  specimen: SpecimenScreen,
  bloodline: BloodlineScreen,
  species: SpeciesScreen,
};

type AuthIdentity = {
  sgtMint: string;
  walletAddress: string;
};

type AuthState =
  | {
      status: "restoring" | "unauthenticated" | "authenticating";
      error?: string | null;
    }
  | {
      status: "authenticated";
      identity: AuthIdentity;
    };

export default function App() {
  const [authState, setAuthState] = useState<AuthState>({
    status: "restoring",
  });
  const [activeSurface, setActiveSurface] = useState<SurfaceKey>("specimen");
  const ActiveScreen = screens[activeSurface];

  useEffect(() => {
    if (VISUAL_PREVIEW) {
      return;
    }

    let mounted = true;

    import("./src/auth/auth")
      .then(({ restoreSession }) => restoreSession())
      .then((identity) => {
        if (!mounted) {
          return;
        }

        setAuthState(
          identity
            ? { status: "authenticated", identity }
            : { status: "unauthenticated" },
        );
      })
      .catch(() => {
        if (mounted) {
          setAuthState({
            status: "unauthenticated",
            error: "Session restore failed.",
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function enterSpore() {
    if (VISUAL_PREVIEW) {
      return;
    }

    setAuthState({
      status: "authenticating",
    });

    try {
      const { signInToSpore } = await import("./src/auth/auth");
      const identity = await signInToSpore();
      setAuthState({
        status: "authenticated",
        identity,
      });
    } catch {
      setAuthState({
        status: "unauthenticated",
        error: "Authentication failed.",
      });
    }
  }

  if (!VISUAL_PREVIEW && authState.status !== "authenticated") {
    return (
      <View style={styles.app}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={tokens.colors.background}
        />
        <AuthEntryScreen
          error={authState.error}
          onEnter={enterSpore}
          status={authState.status}
        />
      </View>
    );
  }

  return (
    <View style={styles.app}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={tokens.colors.background}
      />
      <View style={styles.surface}>
        <ActiveScreen />
      </View>
      <BottomNavigation
        activeSurface={activeSurface}
        onSurfaceChange={setActiveSurface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    backgroundColor: tokens.colors.background,
    flex: 1,
  },
  surface: {
    flex: 1,
  },
});
