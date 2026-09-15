import { Image, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { ComponentType } from "react";
import { lazy, Suspense, useEffect, useState } from "react";
import { PostAuthReadabilityVeil } from "./src/components/PostAuthReadabilityVeil";
import { SporeLoader } from "./src/components/SporeLoader";

import { AuthEntryScreen } from "./src/screens/AuthEntryScreen";
import { BloodlineScreen } from "./src/screens/BloodlineScreen";
import { SpeciesScreen } from "./src/screens/SpeciesScreen";
import { SpecimenScreen } from "./src/screens/SpecimenScreen";
import { tokens } from "./src/design/tokens";
import {
  BottomNavigation,
  SurfaceKey,
} from "./src/navigation/BottomNavigation";

// Visual preview exists only to render SPOR UI in environments such as Expo Go that do not contain Solana Mobile native modules.
const VISUAL_PREVIEW = process.env.EXPO_PUBLIC_SPORE_VISUAL_PREVIEW === "true";
// Camera and wallet flow modules are never evaluated by visual preview.
const Reproduction = lazy(() => import("./src/spore/Reproduction"));

const previewScreens: Record<SurfaceKey, ComponentType> = {
  specimen: PreviewSpecimenScreen,
  bloodline: BloodlineScreen,
  species: SpeciesScreen,
};

function PreviewSpecimenScreen() {
  return <SpecimenScreen previewOrigin canRelease />;
}

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
  return (
    <SafeAreaProvider>
      <SporeApp />
    </SafeAreaProvider>
  );
}

function SporeApp() {
  const [authState, setAuthState] = useState<AuthState>({
    status: "restoring",
  });
  const [activeSurface, setActiveSurface] = useState<SurfaceKey>("specimen");
  const ActivePreviewScreen = previewScreens[activeSurface];

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

  async function leaveSpore() {
    if (VISUAL_PREVIEW) {
      return;
    }

    const { signOutOfSpore } = await import("./src/auth/auth");
    let signOutError: unknown = null;

    try {
      await signOutOfSpore();
    } catch (error) {
      signOutError = error;
      console.warn(
        "[SPOR AUTH] Logout failed during session revocation.",
        error instanceof Error ? error.message : "Unknown logout error.",
      );
    }

    setActiveSurface("specimen");
    setAuthState({
      status: "unauthenticated",
    });

    if (signOutError) {
      throw new Error("Log out failed. Please try again.");
    }
  }

  if (!VISUAL_PREVIEW && authState.status !== "authenticated") {
    return (
      <View style={styles.app}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="transparent"
          translucent
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
      <Image
        accessible={false}
        source={require("./assets/backgrounds/specimen-biological-bg.png")}
        resizeMode="cover"
        style={styles.postAuthBackground}
      />
      <PostAuthReadabilityVeil />
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      {!VISUAL_PREVIEW && authState.status === "authenticated" ? (
        <Suspense
          fallback={
            <View style={styles.surface}>
              <SporeLoader mode="screen" label="READING SEEKER" style={styles.fullSurfaceLoader} />
            </View>
          }
        >
          <Reproduction
            identity={authState.identity}
            onSignOut={leaveSpore}
            surface={activeSurface}
            setSurface={setActiveSurface}
          />
        </Suspense>
      ) : (
        <>
          <View style={styles.surface}>
            <ActivePreviewScreen />
          </View>
          <BottomNavigation
            activeSurface={activeSurface}
            onSurfaceChange={setActiveSurface}
          />
        </>
      )}
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
    backgroundColor: "transparent",
  },

  fullSurfaceLoader: {
    flex: 1,
  },

  postAuthBackground: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: "100%",
    height: "100%",
    opacity: 0.5
  },
});
