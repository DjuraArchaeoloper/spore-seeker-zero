import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Alert,
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
  getOutbreak,
  getSpecies,
  getSpeciesLeaderboard,
  getSpeciesMap,
  type BloodlineResponse,
  type OutbreakResponse,
  type SpeciesLeaderboardResponse,
  type SpeciesMapResponse,
  type SpeciesResponse,
} from "../auth/api";
import { getStoredSessionToken } from "../auth/session";
import { AppText } from "../components/AppText";
import {
  AuthenticatedLogoutControl,
  AUTH_LOGOUT_TOP_OFFSET,
} from "../components/AuthenticatedLogoutControl";
import { PrimaryButton } from "../components/PrimaryButton";
import { QuietAction } from "../components/QuietAction";
import { Screen } from "../components/Screen";
import { SporeLoader } from "../components/SporeLoader";
import { tokens } from "../design/tokens";
import { SpecimenScreen } from "../screens/SpecimenScreen";
import { BloodlineScreen } from "../screens/BloodlineScreen";
import { RankScreen } from "../screens/RankScreen";
import { SpreadScreen } from "../screens/SpreadScreen";
import {
  BottomNavigation,
  type SurfaceKey,
} from "../navigation/BottomNavigation";
import {
  claimSporeWithSignature,
  fetchDevnetGenesisStatus,
  fetchOwnOrganism,
  hasOffer,
  initializeDevnetGenesis,
  nowSeconds,
  preflightOffer,
  recoverActiveClaim,
  releaseSpore,
  resumeClaimSettlement,
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
import {
  BirthRevealPendingStage,
  BirthRevealStage,
  type BirthRevealPayload,
} from "./BirthRevealStage";
import { submitOptionalBirthLocation } from "./birthLocation";
import {
  consumePropagationMoment,
  type PropagationMoment,
} from "./propagationMoments";

type Stage = "home" | "scan" | "accept" | "offer" | "recover";
type BirthRevealState =
  | { status: "idle" }
  | { status: "submittingClaim"; parent: Organism | null }
  | { status: "awaitingNewborn"; parent: Organism | null }
  | { status: "newbornResolved"; payload: BirthRevealPayload }
  | { status: "showingReveal"; payload: BirthRevealPayload }
  | { status: "revealComplete"; payload: BirthRevealPayload };
type ScanDebugMetadata = Record<string, string | number | boolean | null>;
type DevnetGenesisControl =
  | { status: "hidden" }
  | { status: "fresh" | "retry" | "pending" };

const NEWBORN_RESOLVE_ATTEMPTS = 6;
const NEWBORN_RESOLVE_DELAY_MS = 700;

function scanDebug(phase: string, metadata: ScanDebugMetadata = {}) {
  console.warn("[SPØR SCAN DEBUG]", { phase, ...metadata });
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

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default function Reproduction({
  identity,
  onSignOut,
  surface,
  setSurface,
}: {
  identity: AuthIdentity;
  onSignOut: () => Promise<void> | void;
  surface: SurfaceKey;
  setSurface: (surface: SurfaceKey) => void;
}) {
  const [organism, setOrganism] = useState<Organism | null | undefined>();
  const [stage, setStage] = useState<Stage>("home");
  const [birthReveal, setBirthReveal] = useState<BirthRevealState>({
    status: "idle",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signOutPending, setSignOutPending] = useState(false);
  const [devnetGenesis, setDevnetGenesis] = useState<DevnetGenesisControl>({
    status: "hidden",
  });
  const [now, setNow] = useState(nowSeconds);
  const [permission, requestPermission] = useCameraPermissions();
  const secret = useRef<ClaimPayload | null>(null);
  const releaseCandidate = useRef<ClaimPayload | null>(null);
  const releaseForegroundReconcile = useRef(false);
  const locked = useRef(false);
  const scanned = useRef(false);
  const mounted = useRef(true);
  const birthSlot = useRef<number | undefined>(undefined);
  const pendingClaimSignature = useRef<string | null>(null);
  const pendingClaimParent = useRef<Organism | null>(null);
  const [resumingClaim, setResumingClaim] = useState(false);
  const pendingResumeClaim = useRef<{
    reservationId: string;
    transaction: string;
    lastValidBlockHeight: number;
  } | null>(null);
  const claimRecoveryChecked = useRef(false);
  const [claimRecoveryTick, setClaimRecoveryTick] = useState(0);
  const [offer, setOffer] = useState<Organism | null>(null);
  const [bloodline, setBloodline] = useState<{
    data?: BloodlineResponse | null;
    error?: string | null;
  }>({});
  const [propagationMoment, setPropagationMoment] = useState<PropagationMoment | null>(null);
  const [species, setSpecies] = useState<{
    data?: SpeciesResponse | null;
    error?: string | null;
  }>({});
  const [speciesMap, setSpeciesMap] = useState<{
    data?: SpeciesMapResponse | null;
    error?: string | null;
  }>({});
  const [speciesLeaderboard, setSpeciesLeaderboard] = useState<{
    data?: SpeciesLeaderboardResponse | null;
    error?: string | null;
  }>({});
  const [outbreak, setOutbreak] = useState<{
    data?: OutbreakResponse | null;
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
  const refreshDevnetGenesis = useCallback(async () => {
    if (organism !== null) {
      if (mounted.current) setDevnetGenesis({ status: "hidden" });
      return;
    }

    try {
      const status = await fetchDevnetGenesisStatus(identity);

      if (!mounted.current) {
        return;
      }

      setDevnetGenesis(
        status.visible
          ? {
              status:
                status.mode === "fresh" ? "fresh" : "retry",
            }
          : { status: "hidden" },
      );
    } catch {
      if (mounted.current) setDevnetGenesis({ status: "hidden" });
    }
  }, [identity, organism]);
  const refreshOutbreak = useCallback(async () => {
    try {
      const token = await getStoredSessionToken();

      if (!token) {
        if (mounted.current) setOutbreak({ data: null });
        return null;
      }

      const value = await getOutbreak(token);
      if (mounted.current) setOutbreak({ data: value });
      return value;
    } catch (error) {
      console.warn(
        "[SPØR OUTBREAK] State refresh failed.",
        error instanceof Error ? error.message : "Unknown outbreak error.",
      );

      if (mounted.current) {
        setOutbreak((current) => (current.data ? current : { data: null }));
      }

      return null;
    }
  }, []);
  const refreshSpecies = useCallback(async () => {
    try {
      const value = await getSpecies();
      if (mounted.current) setSpecies({ data: value });
      return value;
    } catch (error) {
      if (mounted.current) {
        setSpecies({
          data: null,
          error: error instanceof Error ? error.message : "Species is unavailable.",
        });
      }

      return null;
    }
  }, []);
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
    void refreshOutbreak();
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

        if (!locked.current) {
          void refresh().catch((e) => setError(sporeMessage(e)));
          void refreshOutbreak();
        }
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
  }, [clearReleaseCandidate, reconcileReleaseCandidate, refresh, refreshOutbreak]);
  useEffect(() => {
    void refreshDevnetGenesis();
  }, [refreshDevnetGenesis]);

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
  const resolveNewborn = useCallback(async (attempts = NEWBORN_RESOLVE_ATTEMPTS) => {
    let lastReadError: unknown = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const child = await fetchOwnOrganism(identity, birthSlot.current);
        lastReadError = null;

        if (child) {
          return child;
        }
      } catch (error) {
        if (error instanceof SporeFailure) {
          throw error;
        }

        lastReadError = error;
      }

      if (attempt < attempts - 1) {
        await delay(NEWBORN_RESOLVE_DELAY_MS);
      }
    }

    if (lastReadError) {
      throw lastReadError;
    }

    throw new SporeFailure("Life is born. Your organism is still emerging.");
  }, [identity]);
  const completeDevnetGenesis = useCallback((seekerZero: Organism) => {
    if (!mounted.current) {
      return;
    }

    setBirthReveal({ status: "idle" });
    setOrganism(seekerZero);
    setSurface("specimen");
    setStage("home");
    setError(null);
    setDevnetGenesis({ status: "hidden" });
    void refreshSpecies();
    void refreshOutbreak();
  }, [refreshOutbreak, refreshSpecies, setSurface]);
  const runDevnetGenesis = useCallback(async () => {
    await run(async () => {
      let completed = false;

      setDevnetGenesis({ status: "pending" });

      try {
        const result = await initializeDevnetGenesis(identity);

        if (result.slot) {
          birthSlot.current = result.slot;
        }

        const refreshedOrganism = await refresh().catch(() => null);
        const seekerZero = refreshedOrganism ?? result.organism;

        if (!seekerZero) {
          throw new SporeFailure("Seeker Zero is confirmed. Refreshing organism.");
        }

        completed = true;
        completeDevnetGenesis(seekerZero);
      } catch (error) {
        const seekerZero = await refresh().catch(() => null);

        if (seekerZero && mounted.current) {
          completed = true;
          completeDevnetGenesis(seekerZero);
          return;
        }

        throw error;
      } finally {
        if (!completed) {
          await refreshDevnetGenesis();
        }
      }
    });
  }, [completeDevnetGenesis, identity, refresh, refreshDevnetGenesis]);
  useEffect(() => {
    if (devnetGenesis.status !== "pending" || busy) {
      return;
    }

    let live = true;

    void refresh()
      .then((seekerZero) => {
        if (live && seekerZero) {
          completeDevnetGenesis(seekerZero);
        }
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, [busy, completeDevnetGenesis, devnetGenesis.status, refresh]);
  const confirmDevnetGenesis = useCallback(() => {
    if (devnetGenesis.status === "pending") {
      return;
    }

    const retry = devnetGenesis.status === "retry";

    Alert.alert(
      "DEVNET GENESIS",
      retry
        ? "Species is already initialized for this devnet. Retry Seeker Zero only with this wallet and its Test SGT?"
        : "This initializes the fresh devnet Species and Seeker Zero with this wallet as authority, treasury, Test SGT owner, and Core NFT owner.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: retry ? "Retry" : "Initialize",
          style: "destructive",
          onPress: () => {
            void runDevnetGenesis();
          },
        },
      ],
    );
  }, [devnetGenesis.status, runDevnetGenesis]);
  const beginBirthReveal = useCallback((
    newborn: Organism,
    parent: Organism | null,
    birthTransactionSignature?: string | null,
  ) => {
    const payload: BirthRevealPayload = {
      birthTransactionSignature: birthTransactionSignature ?? null,
      newborn,
      parent,
    };

    if (!mounted.current) {
      return;
    }

    setOrganism(newborn);
    setBirthReveal({ status: "newbornResolved", payload });
  }, []);
  useEffect(() => {
    if (claimRecoveryChecked.current || organism === undefined) {
      return;
    }

    claimRecoveryChecked.current = true;

    if (organism !== null || birthReveal.status !== "idle") {
      return;
    }

    void (async () => {
      try {
        const recovered = await recoverActiveClaim(identity);
        if (!mounted.current || recovered.kind === "none") {
          return;
        }

        if (recovered.kind === "organism") {
          pendingClaimSignature.current = recovered.transactionSignature || null;
          beginBirthReveal(
            recovered.organism,
            null,
            recovered.transactionSignature || null,
          );
          void refreshSpecies();
          void refresh().catch(() => {});
          return;
        }

        pendingResumeClaim.current = {
          reservationId: recovered.reservationId,
          transaction: recovered.transaction,
          lastValidBlockHeight: recovered.lastValidBlockHeight,
        };
        setResumingClaim(true);
        setStage("accept");
        setError(null);
      } catch (e) {
        if (mounted.current) {
          setError(sporeMessage(e));
          // Allow one more automatic retry after a short delay.
          if (claimRecoveryTick < 1) {
            claimRecoveryChecked.current = false;
            setTimeout(() => {
              if (mounted.current) {
                setClaimRecoveryTick((tick) => tick + 1);
              }
            }, 1500);
          }
        }
      }
    })();
  }, [
    beginBirthReveal,
    birthReveal.status,
    claimRecoveryTick,
    identity,
    organism,
    refresh,
    refreshSpecies,
  ]);
  const completeBirthReveal = useCallback((payload: BirthRevealPayload) => {
    if (!mounted.current) {
      return;
    }

    pendingClaimParent.current = null;
    setBirthReveal({ status: "revealComplete", payload });
    setOrganism(payload.newborn);
    setSurface("specimen");
    setStage("home");
    setError(null);
    void refreshOutbreak();
    void submitOptionalBirthLocation({
      newborn: payload.newborn,
      transactionSignature: payload.birthTransactionSignature,
    });
    pendingClaimSignature.current = null;

    setTimeout(() => {
      if (mounted.current) {
        setBirthReveal((current) =>
          current.status === "revealComplete" &&
          current.payload.newborn.organismNumber === payload.newborn.organismNumber
            ? { status: "idle" }
            : current,
        );
      }
    }, 0);
  }, [refreshOutbreak, setSurface]);
  useEffect(() => {
    if (birthReveal.status !== "newbornResolved") {
      return;
    }

    const timer = setTimeout(() => {
      if (mounted.current) {
        setBirthReveal({
          status: "showingReveal",
          payload: birthReveal.payload,
        });
      }
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [birthReveal]);
  const requestSignOut = useCallback(() => {
    if (busy || signOutPending || locked.current) {
      return;
    }

    setSignOutPending(true);
    setError(null);

    void Promise.resolve(onSignOut())
      .catch(() => {
        if (mounted.current) {
          setError("Log out failed. Please try again.");
        }
      })
      .finally(() => {
        if (mounted.current) {
          setSignOutPending(false);
        }
      });
  }, [busy, onSignOut, signOutPending]);
  const returnToSpecimen = useCallback(() => {
    if (locked.current) return;
    scanned.current = false;
    setSurface("specimen");
    setStage("home");
    setError(null);
    void refresh().catch((e) => setError(sporeMessage(e)));
    void refreshOutbreak();
  }, [refresh, refreshOutbreak, setSurface]);

  const close = useCallback(() => {
    if (locked.current) return;
    clearSecret();
    pendingResumeClaim.current = null;
    setResumingClaim(false);
    scanned.current = false;
    setStage("home");
    setError(null);
    void refresh().catch((e) => setError(sporeMessage(e)));
    void refreshOutbreak();
  }, [clearSecret, refresh, refreshOutbreak]);
  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (locked.current || stage === "recover" || birthReveal.status !== "idle")
        return true;
      if (stage !== "home") {
        if (stage === "offer") returnToSpecimen();
        else close();
        return true;
      }
      return false;
    });
    return () => back.remove();
  }, [birthReveal.status, stage, close, returnToSpecimen]);
  useEffect(() => {
    if (!(stage === "offer" || stage === "home") || !offer || !secret.current) return;
    let live = true;
    // Poll authenticated organism state; server era has no on-chain Organism account updates.
    const observe = async () => {
      try {
        const parent = await refresh();
        if (!live || !parent || !secret.current) return;
        const stillMatches = Buffer.from(parent.activeSporeCommitment).equals(
          Buffer.from(commitment(secret.current.secret)),
        );
        const expired = parent.activeSporeExpiresAt <= nowSeconds();
        if (!stillMatches || expired) {
          const claimed = !stillMatches && !expired;
          clearSecret();
          setStage("home");
          if (expired) setError("This spore offer has expired.");
          if (claimed) void refreshOutbreak();
        }
      } catch {
        /* Keep the canonical expiry timer working during interruption. */
      }
    };
    const poll = setInterval(() => {
      void observe();
    }, 4000);
    void observe();
    return () => {
      live = false;
      clearInterval(poll);
    };
  }, [stage, offer, refresh, clearSecret, refreshOutbreak]);
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
    setPropagationMoment(null);
    void getBloodline(organism.organismNumber)
      .then((data) => {
        if (live) {
          setBloodline({ data });
          void consumePropagationMoment(data)
            .then((moment) => {
              if (live && moment) {
                setPropagationMoment(moment);
              }
            })
            .catch(() => {});
        }
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
    if (!propagationMoment) return;

    const timer = setTimeout(() => {
      setPropagationMoment(null);
    }, 7000);

    return () => {
      clearTimeout(timer);
    };
  }, [propagationMoment]);
  useEffect(() => {
    if (surface !== "spread") return;
    let live = true;
    setSpecies({});
    setSpeciesMap({});
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
    void getSpeciesMap()
      .then((data) => {
        if (live) setSpeciesMap({ data });
      })
      .catch((e: unknown) => {
        if (live)
          setSpeciesMap({
            data: null,
            error: e instanceof Error ? e.message : "Species map is unavailable.",
          });
      });
    return () => {
      live = false;
    };
  }, [surface]);
  useEffect(() => {
    if (surface !== "rank") return;
    let live = true;
    setSpeciesLeaderboard({});
    void getSpeciesLeaderboard(10)
      .then((data) => {
        if (live) setSpeciesLeaderboard({ data });
      })
      .catch((e: unknown) => {
        if (live)
          setSpeciesLeaderboard({
            data: null,
            error: e instanceof Error ? e.message : "Species leaderboard is unavailable.",
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
    const parent = pendingClaimParent.current;
    const transactionSignature = pendingClaimSignature.current;

    setBirthReveal({ status: "awaitingNewborn", parent });

    try {
      const child = await resolveNewborn();
      beginBirthReveal(child, parent, transactionSignature);
    } catch {
      if (mounted.current) {
        setBirthReveal({ status: "idle" });
      }

      throw new SporeFailure(
        "Life is born. Your organism is still emerging.",
      );
    }
  }
  async function accept() {
    await run(async () => {
      const resume = pendingResumeClaim.current;
      const payload = secret.current;

      if (!resume && !payload) {
        throw new SporeFailure("Scan a fresh spore offer.");
      }

      const parent = offer;
      const revealParent =
        parent && parent.organismNumber.length > 0 ? parent : null;
      pendingClaimParent.current = revealParent;
      pendingClaimSignature.current = null;
      setBirthReveal({ status: "submittingClaim", parent: revealParent });
      try {
        const claim = resume
          ? await resumeClaimSettlement(identity, resume)
          : await claimSporeWithSignature(identity, payload!);

        birthSlot.current = claim.slot;
        pendingClaimSignature.current = claim.transactionSignature;
        pendingResumeClaim.current = null;
        setResumingClaim(false);
        clearSecret();
        setStage("home");
        beginBirthReveal(claim.organism, revealParent, claim.transactionSignature);
        void refreshSpecies();
        void refresh().catch(() => {});
      } catch (e) {
        const recoverable = e as SporeFailure & {
          reservationId?: string;
          transactionSignature?: string;
        };
        if (
          recoverable.reservationId &&
          recoverable.transactionSignature
        ) {
          pendingClaimSignature.current = recoverable.transactionSignature;
          try {
            const { confirmClaimWithRetry } = await import("./reproductionApi");
            const confirmed = await confirmClaimWithRetry({
              reservationId: recoverable.reservationId,
              transactionSignature: recoverable.transactionSignature,
            });
            const { organismFromPublic } = await import("./chain");
            pendingResumeClaim.current = null;
            setResumingClaim(false);
            clearSecret();
            setStage("home");
            beginBirthReveal(
              organismFromPublic(confirmed.organism),
              revealParent,
              recoverable.transactionSignature,
            );
            void refreshSpecies();
            void refresh().catch(() => {});
            return;
          } catch {
            // Fall through to newborn reconcile / recover.
          }
        }

        // A wallet/API timeout may happen after landing. Reconcile before another signature.
        // Keep resume claim when settlement was already prepared without a signature.
        if (!pendingResumeClaim.current) {
          clearSecret();
        }
        setStage(pendingResumeClaim.current ? "accept" : "home");
        setBirthReveal({ status: "idle" });
        const child = await resolveNewborn(2).catch(() => null);
        if (child) {
          pendingResumeClaim.current = null;
          setResumingClaim(false);
          beginBirthReveal(child, revealParent, pendingClaimSignature.current);
          void refreshSpecies();
          return;
        }
        if (pendingClaimSignature.current) {
          if (mounted.current) {
            setStage("recover");
          }
          throw new SporeFailure(
            "Life is born. Your organism is still emerging.",
          );
        }
        pendingClaimParent.current = null;
        pendingClaimSignature.current = null;
        throw e;
      }
    });
  }

  if (
    birthReveal.status === "submittingClaim" ||
    birthReveal.status === "awaitingNewborn" ||
    birthReveal.status === "newbornResolved"
  ) {
    return (
      <BirthRevealPendingStage status={birthReveal.status} />
    );
  }

  if (birthReveal.status === "showingReveal") {
    return (
      <BirthRevealStage
        birthTransactionSignature={birthReveal.payload.birthTransactionSignature}
        newborn={birthReveal.payload.newborn}
        onComplete={completeBirthReveal}
        parent={birthReveal.payload.parent}
      />
    );
  }

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
          style={StyleSheet.absoluteFill}
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
            <View style={styles.scanLivePendingRow}>
              <SporeLoader mode="inline" size={22} />
              <AppText style={styles.scanLivePending}>CHECKING SPORE</AppText>
            </View>
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
          <View style={styles.pendingRow}>
            <SporeLoader mode="inline" size={22} />
            <AppText style={styles.pending}>CHECKING SPORE</AppText>
          </View>
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
              {resumingClaim ? "FINISH YOUR CLAIM" : "A SPORE FOUND YOU"}
            </AppText>
            <AppText style={styles.acceptLifeText} tone="secondary">
              {resumingClaim
                ? "Your reservation is still active. Continue settlement."
                : "Descend from Seeker Zero."}
            </AppText>
            {error ? <AppText style={styles.acceptLifeMessage}>{error}</AppText> : null}
          </View>

          <View style={styles.acceptLifeActions}>
            <PrimaryButton
              disabled={busy}
              appearance="specimen"
              label="ACCEPT LIFE"
              loading={busy}
              loadingLabel="ACCEPTING LIFE"
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
          disabled={busy}
          label="REVEAL ORGANISM"
          loading={busy}
          loadingLabel="REVEALING"
          onPress={() => {
            void run(readBirth);
          }}
        />
      </Screen>
    );
  const renderAuthenticatedSurface = (children: ReactNode, includeNavigation = false) => (
    <>
      <View style={styles.content}>{children}</View>
      <AuthenticatedLogoutControl
        busy={signOutPending}
        disabled={busy || signOutPending}
        onPress={requestSignOut}
        style={[
          styles.logoutControl,
          {
            top: insets.top + AUTH_LOGOUT_TOP_OFFSET,
            right: Math.max(insets.right + tokens.spacing.sm, tokens.spacing.lg),
          },
        ]}
      />
      {includeNavigation ? (
        <BottomNavigation
          activeSurface={surface}
          onSurfaceChange={(next) => {
            if (!locked.current) {
              setSurface(next);
              void refresh().catch((e) => setError(sporeMessage(e)));
              if (next === "specimen") {
                void refreshOutbreak();
              }
            }
          }}
        />
      ) : null}
    </>
  );

  if (!organism)
    return renderAuthenticatedSurface(
      <Screen
        title={
          organism === undefined ? "FINDING LIFE" : "LIFE STARTS WITH A SPORE"
        }
      >
        <View style={styles.center}>
          {organism === undefined && !error ? (
            <SporeLoader mode="screen" label="FINDING LIFE" />
          ) : (
            <AppText>
              {organism === undefined
                ? "Finding your organism."
                : "Receive a spore from another Seeker."}
            </AppText>
          )}
          {error ? <AppText style={styles.message}>{error}</AppText> : null}
        </View>
        {organism === undefined ? (
          error ? (
            <PrimaryButton
              label="RETRY"
              disabled={busy}
              loading={busy}
              loadingLabel="RETRYING"
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
              appearance="specimen"
              label="SCAN SPORE"
              disabled={busy}
              onPress={() => {
                scanned.current = false;
                setError(null);
                setStage("scan");
              }}
            />
            {devnetGenesis.status !== "hidden" ? (
              <View style={styles.devnetGenesis}>
                <AppText style={styles.devnetGenesisLabel} variant="metadata">
                  DEVNET ONLY
                </AppText>
                {devnetGenesis.status === "retry" ? (
                  <AppText style={styles.devnetGenesisText}>
                    Species exists. Retry Seeker Zero.
                  </AppText>
                ) : null}
                <QuietAction
                  disabled={busy || devnetGenesis.status === "pending"}
                  label={
                    devnetGenesis.status === "pending"
                      ? "DEVNET GENESIS PENDING"
                      : devnetGenesis.status === "retry"
                        ? "RETRY DEVNET GENESIS"
                        : "DEVNET GENESIS"
                  }
                  onPress={confirmDevnetGenesis}
                />
              </View>
            ) : null}
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
  const activeOutbreak = outbreak.data && outbreak.data.active ? outbreak.data : null;
  return renderAuthenticatedSurface(
    surface === "specimen" ? (
      <SpecimenScreen
        organism={organism}
        onRelease={() => {
          void release();
        }}
        busy={busy}
        sporeState={specimenSporeState}
        sporeStatus={specimenSporeStatus}
        canRelease={specimenSporeState === "ready" || activeOfferWithoutLocalSecret}
        canViewSpore={localOfferActive}
        releaseLabel={activeOfferWithoutLocalSecret ? "RELEASE NEW SPORE" : "RELEASE SPORE"}
        outbreak={
          activeOutbreak
            ? {
                points: activeOutbreak.user.points,
                seasonId: activeOutbreak.season.seasonId,
              }
            : null
        }
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
        moment={propagationMoment}
        onDismissMoment={() => setPropagationMoment(null)}
      />
    ) : surface === "spread" ? (
      <SpreadScreen
        species={species.data}
        speciesMap={speciesMap.data}
        speciesMapError={speciesMap.error}
        speciesMapLoading={speciesMap.data === undefined && !speciesMap.error}
        error={species.error}
        loading={species.data === undefined && !species.error}
      />
    ) : (
      <RankScreen
        leaderboard={speciesLeaderboard.data}
        error={speciesLeaderboard.error}
        loading={speciesLeaderboard.data === undefined && !speciesLeaderboard.error}
      />
    ),
    true,
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
  logoutControl: {
    elevation: 20,
    position: "absolute",
  },
  homeActions: {
    gap: tokens.spacing.sm,
  },
  devnetGenesis: {
    alignItems: "center",
    gap: tokens.spacing.xs,
    paddingTop: tokens.spacing.md,
  },
  devnetGenesisLabel: {
    color: tokens.colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
  },
  devnetGenesisText: {
    color: tokens.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
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
  scanLivePendingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "center",
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
  pendingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "center",
  },
});
