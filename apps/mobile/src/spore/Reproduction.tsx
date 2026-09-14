import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  BackHandler,
  Linking,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import qrcode from "qrcode-generator";
import { Buffer } from "buffer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AuthIdentity } from "../auth/api";
import {
  getBloodline,
  getSpecies,
  type BloodlineResponse,
  type SpeciesResponse,
} from "../auth/api";
import { AppText } from "../components/AppText";
import { PrimaryButton } from "../components/PrimaryButton";
import { QuietAction } from "../components/QuietAction";
import { Screen } from "../components/Screen";
import { tokens } from "../design/tokens";
import { OrganismRenderer } from "../components/organism/OrganismRenderer";
import { SpecimenScreen } from "../screens/SpecimenScreen";
import { BloodlineScreen } from "../screens/BloodlineScreen";
import { SpeciesScreen } from "../screens/SpeciesScreen";
import {
  BottomNavigation,
  type SurfaceKey,
} from "../navigation/BottomNavigation";
import {
  claimSpore,
  connection,
  fetchOwnOrganism,
  hasOffer,
  nowSeconds,
  preflightOffer,
  releaseSpore,
  type Organism,
} from "./chain";
import {
  commitment,
  parseClaim,
  serializeClaim,
  sporeMessage,
  SporeFailure,
  type ClaimPayload,
} from "./payload";

type Stage = "home" | "scan" | "accept" | "offer" | "recover" | "birth";
type ScanDebugMetadata = Record<string, string | number | boolean | null>;

function scanDebug(phase: string, metadata: ScanDebugMetadata = {}) {
  console.warn("[SPORE SCAN DEBUG]", { phase, ...metadata });
}

function scanErrorMetadata(error: unknown) {
  return {
    errorName: error instanceof Error ? error.name : "unknown",
    errorMessage: error instanceof Error ? error.message : "unknown",
  };
}

function formatRemaining(seconds: number) {
  const remaining = Math.max(0, seconds);
  const minutes = Math.floor(remaining / 60);
  const secondsPart = remaining % 60;

  return `${minutes.toString().padStart(2, "0")}:${secondsPart.toString().padStart(2, "0")} REMAINING`;
}

export default function Reproduction({
  identity,
  onSignOut,
  surface,
  setSurface,
}: {
  identity: AuthIdentity;
  onSignOut: () => void;
  surface: SurfaceKey;
  setSurface: (surface: SurfaceKey) => void;
}) {
  const [organism, setOrganism] = useState<Organism | null | undefined>();
  const [stage, setStage] = useState<Stage>("home");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(nowSeconds);
  const [permission, requestPermission] = useCameraPermissions();
  const secret = useRef<ClaimPayload | null>(null);
  const releaseCandidate = useRef<ClaimPayload | null>(null);
  const releaseForegroundReconcile = useRef(false);
  const locked = useRef(false);
  const scanned = useRef(false);
  const mounted = useRef(true);
  const birthSlot = useRef<number | undefined>(undefined);
  const [offer, setOffer] = useState<Organism | null>(null);
  const [bloodline, setBloodline] = useState<{
    data?: BloodlineResponse | null;
    error?: string | null;
  }>({});
  const [species, setSpecies] = useState<{
    data?: SpeciesResponse | null;
    error?: string | null;
  }>({});
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const clearReleaseCandidate = useCallback((preserve?: ClaimPayload | null) => {
    if (releaseCandidate.current && releaseCandidate.current !== preserve) {
      releaseCandidate.current.secret.fill(0);
    }

    releaseCandidate.current = null;
  }, []);
  const clearSecret = useCallback(() => {
    const currentSecret = secret.current;

    currentSecret?.secret.fill(0);
    secret.current = null;
    clearReleaseCandidate(currentSecret);
    setOffer(null);
  }, [clearReleaseCandidate]);
  const refresh = useCallback(async () => {
    const value = await fetchOwnOrganism(identity, birthSlot.current);
    if (mounted.current) setOrganism(value);
    return value;
  }, [identity]);
  const activateCandidateOffer = useCallback((candidate: ClaimPayload, parent: Organism) => {
    if (!mounted.current) {
      return;
    }

    if (secret.current && secret.current !== candidate) {
      secret.current.secret.fill(0);
    }

    secret.current = candidate;
    clearReleaseCandidate(candidate);
    setOrganism(parent);
    setOffer(parent);
    setStage("offer");
    setError(null);
  }, [clearReleaseCandidate]);
  const candidateMatchesOffer = useCallback((candidate: ClaimPayload, parent: Organism) => (
    parent.address.equals(candidate.parent) &&
    parent.activeSporeExpiresAt > nowSeconds() &&
    Buffer.from(parent.activeSporeCommitment).equals(Buffer.from(commitment(candidate.secret)))
  ), []);
  const reconcileReleaseCandidate = useCallback(async (
    candidate: ClaimPayload,
    canonicalParent?: Organism | null,
  ) => {
    const parent = canonicalParent ?? await fetchOwnOrganism(identity, birthSlot.current);

    if (parent && candidateMatchesOffer(candidate, parent)) {
      activateCandidateOffer(candidate, parent);
      return true;
    }

    return false;
  }, [activateCandidateOffer, candidateMatchesOffer, identity]);
  useEffect(() => {
    mounted.current = true;
    void refresh().catch((e) => setError(sporeMessage(e)));
    const timer = setInterval(() => setNow(nowSeconds()), 1000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setNow(nowSeconds());
        const candidate = releaseCandidate.current;

        if (candidate && !releaseForegroundReconcile.current) {
          releaseForegroundReconcile.current = true;
          void reconcileReleaseCandidate(candidate)
            .catch(() => {})
            .finally(() => {
              releaseForegroundReconcile.current = false;
            });
        }

        if (!locked.current)
          void refresh().catch((e) => setError(sporeMessage(e)));
      }
    });
    return () => {
      mounted.current = false;
      clearInterval(timer);
      listener.remove();
      secret.current?.secret.fill(0);
      secret.current = null;
      clearReleaseCandidate();
    };
  }, [clearReleaseCandidate, reconcileReleaseCandidate, refresh]);

  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      if (mounted.current) setError(sporeMessage(e));
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const returnToSpecimen = useCallback(() => {
    if (locked.current) return;
    scanned.current = false;
    setSurface("specimen");
    setStage("home");
    setError(null);
    void refresh().catch((e) => setError(sporeMessage(e)));
  }, [refresh, setSurface]);

  const close = useCallback(() => {
    if (locked.current) return;
    clearSecret();
    scanned.current = false;
    setStage("home");
    setError(null);
    void refresh().catch((e) => setError(sporeMessage(e)));
  }, [clearSecret, refresh]);
  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (locked.current || stage === "recover" || stage === "birth")
        return true;
      if (stage !== "home") {
        if (stage === "offer") returnToSpecimen();
        else close();
        return true;
      }
      return false;
    });
    return () => back.remove();
  }, [stage, close, returnToSpecimen]);
  useEffect(() => {
    if (!(stage === "offer" || stage === "home") || !offer || !secret.current) return;
    let live = true;
    // Refetch via the same validated decoder; polling also covers dropped websocket notifications.
    const observe = async () => {
      try {
        const parent = await refresh();
        if (!live || !parent || !secret.current) return;
        const stillMatches = Buffer.from(parent.activeSporeCommitment).equals(
          Buffer.from(commitment(secret.current.secret)),
        );
        const expired = parent.activeSporeExpiresAt <= nowSeconds();
        if (!stillMatches || expired) {
          clearSecret();
          setStage("home");
          if (expired) setError("This spore offer has expired.");
        }
      } catch {
        /* Keep the canonical expiry timer working during RPC interruption. */
      }
    };
    const subscription = connection().onAccountChange(
      offer.address,
      () => {
        void observe();
      },
      "confirmed",
    );
    const poll = setInterval(() => {
      void observe();
    }, 4000);
    return () => {
      live = false;
      clearInterval(poll);
      void connection()
        .removeAccountChangeListener(subscription)
        .catch(() => {});
    };
  }, [stage, offer, refresh, clearSecret]);
  useEffect(() => {
    if (
      (stage === "offer" || stage === "accept" || stage === "home") &&
      offer &&
      secret.current &&
      now >= offer.activeSporeExpiresAt
    ) {
      clearSecret();
      setStage("home");
      setError("This spore offer has expired.");
      void refresh().catch(() => {});
    }
  }, [now, stage, offer, clearSecret, refresh]);
  useEffect(() => {
    if (surface !== "bloodline" || !organism) return;
    let live = true;
    setBloodline({});
    void getBloodline(organism.organismNumber)
      .then((data) => {
        if (live) setBloodline({ data });
      })
      .catch((e: unknown) => {
        if (live)
          setBloodline({
            data: null,
            error: e instanceof Error ? e.message : "Bloodline is unavailable.",
          });
      });
    return () => {
      live = false;
    };
  }, [surface, organism]);
  useEffect(() => {
    if (surface !== "species") return;
    let live = true;
    setSpecies({});
    void getSpecies()
      .then((data) => {
        if (live) setSpecies({ data });
      })
      .catch((e: unknown) => {
        if (live)
          setSpecies({
            data: null,
            error: e instanceof Error ? e.message : "Species is unavailable.",
          });
      });
    return () => {
      live = false;
    };
  }, [surface]);

  async function release() {
    await run(async () => {
      if (!organism) {
        throw new SporeFailure("Your spore is not ready.");
      }

      clearSecret();
      const bytes = new Uint8Array(32);
      // Existing index.js installs react-native-get-random-values before App loads.
      do {
        globalThis.crypto.getRandomValues(bytes);
      } while (!bytes.some(Boolean));

      const candidate: ClaimPayload = {
        parent: organism.address,
        secret: bytes,
      };

      releaseCandidate.current = candidate;

      try {
        const parent = await releaseSpore(identity, candidate.secret);
        if (!mounted.current) {
          return;
        }
        if (!await reconcileReleaseCandidate(candidate, parent)) {
          clearReleaseCandidate(candidate);
          candidate.secret.fill(0);
          throw new SporeFailure(
            "The released offer is no longer available. Refresh your organism.",
          );
        }
      } catch (e) {
        let checkedCanonicalState = false;
        let recovered = false;

        try {
          recovered = await reconcileReleaseCandidate(candidate);
          checkedCanonicalState = true;
        } catch {
          // Keep the candidate in memory; foreground recovery may still reconcile after wallet return.
        }

        if (recovered) {
          return;
        }

        if (checkedCanonicalState) {
          clearReleaseCandidate(candidate);
          candidate.secret.fill(0);
        }

        await refresh().catch(() => {});
        throw e;
      }
    });
  }
  function scan(data: string) {
    if (scanned.current || locked.current) return;
    scanned.current = true;
    scanDebug("scan_received", { currentStage: stage });
    void run(async () => {
      let payload: ClaimPayload | null = null;
      let alreadyOwnsOrganism = false;
      let scanStage = "scan_received";
      try {
        scanStage = "parse_start";
        scanDebug("parse_start", { currentStage: stage });
        try {
          payload = parseClaim(data);
        } catch (e) {
          scanDebug("parse_failed", {
            currentStage: stage,
            ...scanErrorMetadata(e),
          });
          throw e;
        }
        scanDebug("parse_success", {
          currentStage: stage,
          parent: payload.parent.toBase58(),
        });
        scanStage = "ownership_refresh_start";
        scanDebug("ownership_refresh_start", { currentStage: stage });
        const ownedOrganism = await refresh();
        scanDebug("ownership_refresh_complete", {
          currentStage: stage,
          hasOrganism: Boolean(ownedOrganism),
          organismNumber: ownedOrganism?.organismNumber ?? null,
        });
        if (ownedOrganism) {
          alreadyOwnsOrganism = true;
          scanDebug("already_has_organism", {
            currentStage: stage,
            organismNumber: ownedOrganism.organismNumber,
          });
          throw new SporeFailure("This Seeker already owns an organism.");
        }
        scanStage = "preflight_start";
        scanDebug("preflight_start", {
          currentStage: stage,
          parent: payload.parent.toBase58(),
        });
        const parent = await preflightOffer(payload, (phase, metadata) => {
          scanStage = phase;
          scanDebug(phase, metadata);
        });
        scanDebug("preflight_success", {
          currentStage: stage,
          parent: parent.address.toBase58(),
          organismNumber: parent.organismNumber,
        });
        if (!mounted.current) {
          payload.secret.fill(0);
          return;
        }
        secret.current = payload;
        setOffer(parent);
        setStage("accept");
        scanDebug("accept_stage_entered", {
          currentStage: "accept",
          parent: parent.address.toBase58(),
          organismNumber: parent.organismNumber,
        });
      } catch (e) {
        scanDebug("scan_failed", {
          currentStage: stage,
          scanStage,
          ...scanErrorMetadata(e),
        });
        payload?.secret.fill(0);
        clearSecret();
        scanned.current = false;
        if (alreadyOwnsOrganism) {
          setStage("home");
          throw e;
        }
        if (mounted.current) {
          setStage("scan");
          setError(sporeMessage(e));
        }
      }
    });
  }
  async function readBirth() {
    const child = await fetchOwnOrganism(identity, birthSlot.current);
    if (!child)
      throw new SporeFailure(
        "Life is born. Your organism is still emerging.",
      );
    if (mounted.current) {
      setOrganism(child);
      setStage("birth");
    }
  }
  async function accept() {
    await run(async () => {
      const payload = secret.current;
      if (!payload) throw new SporeFailure("Scan a fresh spore offer.");
      try {
        birthSlot.current = await claimSpore(identity, payload);
      } catch (e) {
        // A wallet/RPC timeout may happen after landing. Reconcile before another signature.
        clearSecret();
        setStage("home");
        const child = await refresh().catch(() => null);
        if (child) {
          setStage("birth");
          return;
        }
        throw e;
      }
      clearSecret();
      setStage("recover");
      try {
        await readBirth();
      } catch {
        throw new SporeFailure(
          "Life is born. Your organism is still emerging.",
        );
      }
    });
  }

  if (stage === "birth" && organism)
    return (
      <Screen
        title={`GEN ${organism.generation} · #${organism.organismNumber.padStart(6, "0")}`}
      >
        <View style={styles.center}>
          <OrganismRenderer
            genome={organism.genome}
            size={Math.min(width - 48, 380)}
          />
          <AppText variant="title">SEEKERBORNE</AppText>
          <AppText>Descendant of Seeker Zero.</AppText>
        </View>
        <PrimaryButton
          label="CONTINUE"
          onPress={() => {
            setSurface("specimen");
            setStage("home");
            void refresh().catch(() => {});
          }}
        />
      </Screen>
    );
  if (
    stage === "offer" &&
    offer &&
    secret.current &&
    now < offer.activeSporeExpiresAt
  )
    return (
      <View
        style={[
          styles.offerScreen,
          {
            paddingTop: insets.top + tokens.spacing.xl,
            paddingBottom: Math.max(insets.bottom + tokens.spacing.lg, tokens.spacing.xxl),
          },
        ]}
      >
        <View style={styles.offerHeader}>
          <AppText style={styles.offerTitle} variant="title">
            SPORE RELEASED
          </AppText>
        </View>

        <View style={styles.offerContent}>
          <SporeQr payload={secret.current} size={Math.min(width - 64, 320)} />
          <View style={styles.offerCopy}>
            <AppText style={styles.offerInstruction}>
              Let another Seeker scan this spore.
            </AppText>
            <AppText style={styles.offerTimer} variant="metadata">
              {formatRemaining(offer.activeSporeExpiresAt - now)}
            </AppText>
          </View>
        </View>

        <View style={styles.offerAction}>
          <QuietAction label="BACK TO SPECIMEN" onPress={returnToSpecimen} />
        </View>
      </View>
    );
  if (stage === "scan")
    return permission?.granted ? (
      <View style={styles.scanLiveScreen}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onMountError={() => {
            setError(
              "The camera is unavailable. Close the scanner and try again.",
            );
          }}
          onBarcodeScanned={busy ? undefined : ({ data }) => scan(data)}
        />

        <View
          pointerEvents="none"
          style={[
            styles.scanLiveHeader,
            { paddingTop: insets.top + tokens.spacing.xl },
          ]}
        >
          <AppText style={styles.scanLiveTitle} variant="title">
            SCAN SPORE
          </AppText>
          <AppText style={styles.scanLiveHint} variant="metadata">
            POINT AT A SPORE
          </AppText>
        </View>

        <View
          style={[
            styles.scanLiveFooter,
            { paddingBottom: Math.max(insets.bottom + tokens.spacing.lg, tokens.spacing.xxl) },
          ]}
        >
          {error ? <AppText style={styles.scanLiveMessage}>{error}</AppText> : null}
          {busy ? (
            <AppText style={styles.scanLivePending}>CHECKING SPORE…</AppText>
          ) : (
            <QuietAction label="CANCEL" onPress={close} />
          )}
        </View>
      </View>
    ) : (
      <Screen
        title="SCAN SPORE"
        style={{ paddingBottom: Math.max(insets.bottom + tokens.spacing.lg, tokens.spacing.xl) }}
      >
        <View style={styles.scanPermissionContent}>
          <View style={styles.scanPermissionBlock}>
            <AppText style={styles.scanPermissionText}>
              Camera access is needed to scan a spore.
            </AppText>
            <PrimaryButton
              label={
                permission?.canAskAgain === false
                  ? "OPEN SETTINGS"
                  : "ALLOW CAMERA"
              }
              onPress={() => {
                if (permission?.canAskAgain === false)
                  void Linking.openSettings().catch(() =>
                    setError("Camera settings are unavailable."),
                  );
                else
                  void requestPermission().catch(() =>
                    setError("Camera permission is unavailable."),
                  );
              }}
            />
          </View>
        </View>
        {error ? <AppText style={styles.message}>{error}</AppText> : null}
        {busy ? (
          <AppText style={styles.pending}>CHECKING SPORE…</AppText>
        ) : (
          <QuietAction label="CANCEL" onPress={close} />
        )}
      </Screen>
    );
  if (stage === "accept")
    return (
      <View
        style={[
          styles.acceptLifeScreen,
          {
            paddingTop: insets.top + tokens.spacing.xl,
            paddingBottom: Math.max(insets.bottom + tokens.spacing.lg, tokens.spacing.xxl),
          },
        ]}
      >
        <View style={styles.acceptLifeContent}>
          <View style={styles.acceptLifeCopy}>
            <AppText style={styles.acceptLifeTitle} variant="title">
              A SPORE FOUND YOU
            </AppText>
            <AppText style={styles.acceptLifeText} tone="secondary">
              Descend from Seeker Zero.
            </AppText>
            {error ? <AppText style={styles.acceptLifeMessage}>{error}</AppText> : null}
          </View>

          <View style={styles.acceptLifeActions}>
            <PrimaryButton
              label={busy ? "ACCEPTING LIFE…" : "ACCEPT LIFE"}
              disabled={busy}
              onPress={() => {
                void accept();
              }}
            />
            <QuietAction label="CANCEL" disabled={busy} onPress={close} />
          </View>
        </View>
      </View>
    );
  if (stage === "recover")
    return (
      <Screen title="LIFE IS BORN">
        <View style={styles.center}>
          <AppText>Your organism is still emerging.</AppText>
          {error ? <AppText style={styles.message}>{error}</AppText> : null}
        </View>
        <PrimaryButton
          label={busy ? "REVEALING…" : "REVEAL ORGANISM"}
          disabled={busy}
          onPress={() => {
            void run(readBirth);
          }}
        />
      </Screen>
    );
  if (!organism)
    return (
      <Screen
        title={
          organism === undefined ? "FINDING LIFE" : "LIFE STARTS WITH A SPORE"
        }
      >
        <View style={styles.center}>
          <AppText>
            {organism === undefined
              ? "Finding your organism."
              : "Receive a spore from another Seeker."}
          </AppText>
          {error ? <AppText style={styles.message}>{error}</AppText> : null}
        </View>
        {organism === undefined ? (
          error ? (
            <PrimaryButton
              label="RETRY"
              disabled={busy}
              onPress={() => {
                void run(async () => {
                  await refresh();
                });
              }}
            />
          ) : null
        ) : (
          <View style={styles.homeActions}>
            <PrimaryButton
              label="SCAN SPORE"
              disabled={busy}
              onPress={() => {
                scanned.current = false;
                setError(null);
                setStage("scan");
              }}
            />
            <QuietAction label="LOG OUT" onPress={onSignOut} />
          </View>
        )}
      </Screen>
    );
  const hasActiveOffer = hasOffer(organism);
  const specimenSporeState = hasActiveOffer
    ? "active"
    : organism.nextSporeAt > now
      ? "cooldown"
      : "ready";
  const localOfferActive =
    specimenSporeState === "active" &&
    !!offer &&
    !!secret.current &&
    organism.address.equals(secret.current.parent) &&
    now < offer.activeSporeExpiresAt &&
    Buffer.from(organism.activeSporeCommitment).equals(
      Buffer.from(commitment(secret.current.secret)),
    );
  const activeOfferWithoutLocalSecret =
    specimenSporeState === "active" && !localOfferActive;
  const specimenSporeStatus =
    specimenSporeState === "active"
      ? "SPORE OFFER ACTIVE"
      : specimenSporeState === "cooldown"
        ? `SPORE IN ${Math.ceil((organism.nextSporeAt - now) / 60)} MIN`
        : "SPORE READY";
  return (
    <>
      <View style={styles.content}>
        {surface === "specimen" ? (
          <SpecimenScreen
            organism={organism}
            onLogout={onSignOut}
            onRelease={() => {
              void release();
            }}
            busy={busy}
            sporeState={specimenSporeState}
            sporeStatus={specimenSporeStatus}
            canRelease={specimenSporeState === "ready" || activeOfferWithoutLocalSecret}
            canViewSpore={localOfferActive}
            releaseLabel={activeOfferWithoutLocalSecret ? "RELEASE NEW SPORE" : "RELEASE SPORE"}
            onViewSpore={() => {
              if (!localOfferActive) return;
              setOffer(organism);
              setStage("offer");
              setError(null);
            }}
            error={error}
          />
        ) : surface === "bloodline" ? (
          <BloodlineScreen
            bloodline={bloodline.data}
            error={bloodline.error}
            loading={bloodline.data === undefined && !bloodline.error}
          />
        ) : (
          <SpeciesScreen
            species={species.data}
            error={species.error}
            loading={species.data === undefined && !species.error}
          />
        )}
      </View>
      <BottomNavigation
        activeSurface={surface}
        onSurfaceChange={(next) => {
          if (!locked.current) {
            setSurface(next);
            void refresh().catch((e) => setError(sporeMessage(e)));
          }
        }}
      />
    </>
  );
}

function SporeQr({ payload, size }: { payload: ClaimPayload; size: number }) {
  const { path, modules } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(serializeClaim(payload), "Byte");
    qr.make();
    const modules = qr.getModuleCount() + 8;
    const path = Skia.Path.Make();
    for (let row = 0; row < modules - 8; row++)
      for (let col = 0; col < modules - 8; col++) {
        if (qr.isDark(row, col))
          path.addRect(Skia.XYWHRect(col + 4, row + 4, 1, 1));
      }
    return { path, modules };
  }, [payload]);
  return (
    <View
      accessibilityLabel="Active spore QR"
      style={{ backgroundColor: "white", padding: 0 }}
    >
      <Canvas style={{ width: size, height: size }}>
        <Path
          path={path}
          color="black"
          transform={[{ scale: size / modules }]}
        />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 24 },
  content: { flex: 1 },
  homeActions: {
    gap: tokens.spacing.sm,
  },
  scanLiveScreen: {
    backgroundColor: "black",
    flex: 1,
  },
  scanLiveHeader: {
    alignItems: "center",
    left: 0,
    paddingHorizontal: tokens.spacing.xl,
    position: "absolute",
    right: 0,
    top: 0,
  },
  scanLiveTitle: {
    color: tokens.colors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 2,
    lineHeight: 28,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.62)",
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 8,
  },
  scanLiveHint: {
    color: "rgba(244, 247, 244, 0.68)",
    fontSize: 10,
    letterSpacing: 2.4,
    lineHeight: 16,
    marginTop: tokens.spacing.xs,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.62)",
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 8,
  },
  scanLiveFooter: {
    alignItems: "center",
    bottom: 0,
    gap: tokens.spacing.md,
    left: 0,
    paddingHorizontal: tokens.spacing.xl,
    position: "absolute",
    right: 0,
  },
  scanLiveMessage: {
    color: tokens.colors.textPrimary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.7)",
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 8,
  },
  scanLivePending: {
    color: tokens.specimen.mint,
    fontSize: 11,
    letterSpacing: 2,
    lineHeight: 16,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.7)",
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 8,
    textTransform: "uppercase",
  },
  scanPermissionContent: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingBottom: tokens.spacing.xxl,
  },
  scanPermissionBlock: {
    gap: tokens.spacing.xl,
    maxWidth: 360,
    width: "100%",
  },
  scanPermissionText: {
    color: tokens.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  acceptLifeScreen: {
    flex: 1,
    paddingHorizontal: tokens.spacing.xl,
  },
  acceptLifeContent: {
    alignItems: "center",
    flex: 1,
    gap: tokens.spacing.xxl,
    justifyContent: "center",
    paddingBottom: tokens.spacing.xxxl,
    paddingTop: tokens.spacing.xxl,
  },
  acceptLifeCopy: {
    alignItems: "center",
    gap: tokens.spacing.sm,
    maxWidth: 360,
    width: "100%",
  },
  acceptLifeTitle: {
    color: tokens.colors.textPrimary,
    textAlign: "center",
  },
  acceptLifeText: {
    textAlign: "center",
  },
  acceptLifeMessage: {
    color: tokens.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: tokens.spacing.xs,
    textAlign: "center",
  },
  acceptLifeActions: {
    gap: tokens.spacing.sm,
    maxWidth: 360,
    width: "100%",
  },
  offerScreen: {
    flex: 1,
    paddingHorizontal: tokens.spacing.xl,
  },
  offerHeader: {
    alignItems: "center",
    paddingBottom: tokens.spacing.lg,
  },
  offerTitle: {
    color: tokens.colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 1.8,
    lineHeight: 30,
    textAlign: "center",
  },
  offerContent: {
    alignItems: "center",
    flex: 1,
    gap: tokens.spacing.xl,
    justifyContent: "center",
    paddingBottom: tokens.spacing.xl,
  },
  offerCopy: {
    alignItems: "center",
    gap: tokens.spacing.sm,
  },
  offerInstruction: {
    color: tokens.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  offerTimer: {
    color: tokens.specimen.mint,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
    letterSpacing: 2.2,
    lineHeight: 17,
    textAlign: "center",
  },
  offerAction: {
    paddingTop: tokens.spacing.sm,
  },
  message: {
    color: tokens.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: tokens.spacing.xl,
    textAlign: "center",
  },
  pending: {
    color: tokens.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    textTransform: "uppercase",
  },
});
