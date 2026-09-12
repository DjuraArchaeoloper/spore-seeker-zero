import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  BackHandler,
  Linking,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import qrcode from "qrcode-generator";
import { Buffer } from "buffer";
import type { AuthIdentity } from "../auth/api";
import {
  getBloodline,
  getSpecies,
  type BloodlineResponse,
  type SpeciesResponse,
} from "../auth/api";
import { AppText } from "../components/AppText";
import { PrimaryButton } from "../components/PrimaryButton";
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

function formatRemaining(seconds: number) {
  const remaining = Math.max(0, seconds);
  const minutes = Math.floor(remaining / 60);
  const secondsPart = remaining % 60;

  return `${minutes.toString().padStart(2, "0")}:${secondsPart.toString().padStart(2, "0")} REMAINING`;
}

export default function Reproduction({
  identity,
  surface,
  setSurface,
}: {
  identity: AuthIdentity;
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

  const clearSecret = useCallback(() => {
    secret.current?.secret.fill(0);
    secret.current = null;
    setOffer(null);
  }, []);
  const refresh = useCallback(async () => {
    const value = await fetchOwnOrganism(identity, birthSlot.current);
    if (mounted.current) setOrganism(value);
    return value;
  }, [identity]);
  useEffect(() => {
    mounted.current = true;
    void refresh().catch((e) => setError(sporeMessage(e)));
    const timer = setInterval(() => setNow(nowSeconds()), 1000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setNow(nowSeconds());
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
    };
  }, [refresh]);

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
      clearSecret();
      const bytes = new Uint8Array(32);
      try {
        // Existing index.js installs react-native-get-random-values before App loads.
        do {
          globalThis.crypto.getRandomValues(bytes);
        } while (!bytes.some(Boolean));
        const parent = await releaseSpore(identity, bytes);
        if (!mounted.current) {
          bytes.fill(0);
          return;
        }
        secret.current = { parent: parent.address, secret: bytes };
        setOrganism(parent);
        setOffer(parent);
        setStage("offer");
      } catch (e) {
        bytes.fill(0);
        await refresh().catch(() => {});
        throw e;
      }
    });
  }
  function scan(data: string) {
    if (scanned.current || locked.current) return;
    scanned.current = true;
    void run(async () => {
      let payload: ClaimPayload | null = null;
      let alreadyOwnsOrganism = false;
      try {
        payload = parseClaim(data);
        if (await refresh()) {
          alreadyOwnsOrganism = true;
          throw new SporeFailure("This Seeker already owns an organism.");
        }
        const parent = await preflightOffer(payload);
        if (!mounted.current) {
          payload.secret.fill(0);
          return;
        }
        secret.current = payload;
        setOffer(parent);
        setStage("accept");
      } catch (e) {
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
      <Screen title="SPORE RELEASED">
        <View style={styles.center}>
          <SporeQr payload={secret.current} size={Math.min(width - 64, 320)} />
          <AppText>Let another Seeker scan this spore.</AppText>
          <AppText>
            {formatRemaining(offer.activeSporeExpiresAt - now)}
          </AppText>
        </View>
        <QuietAction label="BACK TO SPECIMEN" onPress={returnToSpecimen} />
      </Screen>
    );
  if (stage === "scan")
    return (
      <Screen title="SCAN SPORE">
        {permission?.granted ? (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onMountError={() => {
              setError(
                "The camera is unavailable. Close the scanner and try again.",
              );
            }}
            onBarcodeScanned={busy ? undefined : ({ data }) => scan(data)}
          />
        ) : (
          <View style={styles.center}>
            <AppText>Camera access is needed to scan a spore.</AppText>
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
        )}
        {error ? <AppText style={styles.message}>{error}</AppText> : null}
        {busy ? (
          <AppText style={styles.pending}>CHECKING SPORE…</AppText>
        ) : (
          <QuietAction label="CANCEL" onPress={close} />
        )}
      </Screen>
    );
  if (stage === "accept" || stage === "recover")
    return (
      <Screen
        title={stage === "recover" ? "LIFE IS BORN" : "A SPORE FOUND YOU"}
      >
        <View style={styles.center}>
          <AppText>
            {stage === "recover"
              ? "Your organism is still emerging."
              : "Descend from Seeker Zero."}
          </AppText>
          {error ? <AppText style={styles.message}>{error}</AppText> : null}
        </View>
        <PrimaryButton
          label={
            busy
              ? stage === "recover"
                ? "REVEALING…"
                : "ACCEPTING LIFE…"
              : stage === "recover"
                ? "REVEAL ORGANISM"
                : "ACCEPT LIFE"
          }
          disabled={busy}
          onPress={() => {
            void (stage === "recover" ? run(readBirth) : accept());
          }}
        />
        {stage === "accept" ? (
          <QuietAction label="CANCEL" disabled={busy} onPress={close} />
        ) : null}
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
          <PrimaryButton
            label="SCAN SPORE"
            disabled={busy}
            onPress={() => {
              scanned.current = false;
              setError(null);
              setStage("scan");
            }}
          />
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
    now < offer.activeSporeExpiresAt &&
    Buffer.from(organism.activeSporeCommitment).equals(
      Buffer.from(commitment(secret.current.secret)),
    );
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
            onRelease={() => {
              void release();
            }}
            busy={busy}
            sporeState={specimenSporeState}
            sporeStatus={specimenSporeStatus}
            canRelease={specimenSporeState === "ready"}
            canViewSpore={localOfferActive}
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

function QuietAction({
  disabled = false,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quietAction,
        disabled && styles.quietActionDisabled,
        pressed && !disabled && styles.quietActionPressed,
      ]}
    >
      <AppText style={styles.quietActionLabel} variant="metadata">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 24 },
  content: { flex: 1 },
  camera: { flex: 1, marginBottom: 24 },
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
  quietAction: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: tokens.spacing.xl,
  },
  quietActionDisabled: {
    opacity: 0.42,
  },
  quietActionPressed: {
    opacity: tokens.opacity.muted,
  },
  quietActionLabel: {
    color: tokens.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
});
