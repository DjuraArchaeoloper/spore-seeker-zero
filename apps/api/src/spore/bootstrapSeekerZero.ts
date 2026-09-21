import {
  Keypair,
  PublicKey,
  Transaction,
  type Connection
} from "@solana/web3.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  addPlugin,
  create,
  fetchAsset,
  mplCore,
  safeFetchAssetV1,
  update,
  updateAuthority,
  type AssetV1
} from "@metaplex-foundation/mpl-core";
import {
  createSignerFromKeypair,
  publicKey as umiPublicKey,
  signerIdentity,
  some,
  type Umi
} from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";
import {
  fromWeb3JsKeypair,
  fromWeb3JsPublicKey,
  toWeb3JsInstruction
} from "@metaplex-foundation/umi-web3js-adapters";
import { SEEKER_ZERO_GENOME_HEX } from "@spore/shared";

import {
  SgtVerificationUnavailableError,
  verifySeekerGenesisToken
} from "../auth/sgt";
import { connectToDatabase } from "../db/mongoose";
import {
  ORGANISM_STATUS,
  OrganismIndexModel,
  type OrganismIndex
} from "../models/OrganismIndex";
import { SpeciesStateModel } from "../models/SpeciesState";
import {
  EMPTY_SPORE_COMMITMENT_HEX,
  dateFromUnixSeconds
} from "./bytes";
import {
  formatOrganismName,
  formatOrganismUri,
  isValidMetadataBaseUri
} from "./core";
import { deriveOrganismIdentity } from "./encoding";
import { SporeDomainError } from "./errors";
import {
  deriveCoreAssetKeypair,
  getSporeServerAuthorityKeypair
} from "./serverAuthority";
import { getSolanaConnection } from "./solanaConnection";
import { insertCanonicalSpeciesOnce } from "./species";

const SEEKER_ZERO_NUMBER = "0";
const SEEKER_ZERO_GENERATION = 0;
const BOOTSTRAP_RESERVATION_ID = "seeker-zero-bootstrap";
const BOOTSTRAP_ATTEMPT_ID = "v1";
const CORE_ACCOUNT_POLL_ATTEMPTS = 16;
const CORE_ACCOUNT_POLL_MS = 500;

export type BootstrapSeekerZeroResult = {
  organism: OrganismIndex;
  speciesKey: "canonical";
  coreAsset: string;
  coreFinalizationSignature: string;
};

/**
 * One-time server-era Seeker Zero bootstrap.
 *
 * - Hard-coded organism #0 / generation 0 / canonical genome
 * - Requires a real verified SGT + owning wallet (from config, not client body)
 * - Creates Core birth certificate without inventing a parent birth
 * - Idempotent: resumes from an existing deterministic Core asset / partial Mongo state
 */
export async function bootstrapSeekerZero(input: {
  seekerZeroSgtMint: string;
  seekerZeroWallet: string;
  treasury: string;
  birthFeeLamports: string;
  metadataBaseUri: string;
}): Promise<BootstrapSeekerZeroResult> {
  await connectToDatabase();

  const sgtMint = assertPubkey(input.seekerZeroSgtMint, "Seeker Zero SGT");
  const wallet = assertPubkey(input.seekerZeroWallet, "Seeker Zero wallet");
  const treasury = assertPubkey(input.treasury, "treasury");
  assertBirthFee(input.birthFeeLamports);
  assertMetadataBaseUri(input.metadataBaseUri);

  await assertConfiguredSgtOwnership(wallet, sgtMint);

  const organismPda = deriveOrganismIdentity(sgtMint);
  const metadataBaseUri = input.metadataBaseUri.replace(/\/+$/, "");
  const assetKeypair = deriveCoreAssetKeypair({
    reservationId: BOOTSTRAP_RESERVATION_ID,
    attemptId: BOOTSTRAP_ATTEMPT_ID
  });
  const expectedCoreAsset = assetKeypair.publicKey.toBase58();
  const serverAuthority = getSporeServerAuthorityKeypair();

  const existingZero = await OrganismIndexModel.findOne({
    organismNumber: SEEKER_ZERO_NUMBER
  }).lean();

  if (existingZero) {
    assertExistingSeekerZero(existingZero, {
      organismPda,
      sgtMint,
      expectedCoreAsset,
      wallet
    });
  }

  const existingBySgt = await OrganismIndexModel.findOne({ sgtMint }).lean();
  if (
    existingBySgt &&
    existingBySgt.organismNumber !== SEEKER_ZERO_NUMBER
  ) {
    throw new SporeDomainError(
      "organism_already_exists",
      "This SGT already has a non-zero organism."
    );
  }

  const existingSpecies = await SpeciesStateModel.findOne({ key: "canonical" }).lean();
  if (
    existingSpecies &&
    existingSpecies.seekerZeroOrganismPda &&
    existingSpecies.seekerZeroOrganismPda !== organismPda
  ) {
    throw new SporeDomainError(
      "species_not_ready",
      "Canonical species state already exists for a different Seeker Zero."
    );
  }

  const coreFinalizationSignature = await ensureSeekerZeroCoreCertificate({
    assetKeypair,
    serverAuthority,
    ownerWallet: wallet,
    metadataBaseUri,
    sgtMint
  });

  let organism =
    existingZero ??
    (await insertSeekerZeroOrganism({
      organismPda,
      sgtMint,
      coreAsset: expectedCoreAsset,
      transactionSignature: coreFinalizationSignature
    }));

  if (
    existingZero &&
    (existingZero.coreAsset !== expectedCoreAsset || !existingZero.transactionSignature)
  ) {
    const updated = await OrganismIndexModel.findOneAndUpdate(
      {
        organismNumber: SEEKER_ZERO_NUMBER,
        organismPda,
        sgtMint
      },
      {
        $set: {
          coreAsset: expectedCoreAsset,
          ...(existingZero.transactionSignature
            ? {}
            : { transactionSignature: coreFinalizationSignature }),
          status: ORGANISM_STATUS.finalized
        }
      },
      { new: true }
    ).lean();

    if (updated) {
      organism = updated;
    }
  }

  if (!existingSpecies) {
    await insertCanonicalSpeciesOnce({
      seekerZeroOrganismPda: organismPda,
      nextOrganismNumber: "1",
      totalOrganisms: "1",
      treasury,
      birthFeeLamports: input.birthFeeLamports,
      metadataBaseUri
    });
  }

  return {
    organism,
    speciesKey: "canonical",
    coreAsset: expectedCoreAsset,
    coreFinalizationSignature
  };
}

async function ensureSeekerZeroCoreCertificate(input: {
  assetKeypair: Keypair;
  serverAuthority: Keypair;
  ownerWallet: string;
  metadataBaseUri: string;
  sgtMint: string;
}): Promise<string> {
  const connection = getSolanaConnection();
  const umi = createUmi(connection.rpcEndpoint).use(mplCore());
  const authoritySigner = createSignerFromKeypair(
    umi,
    fromWeb3JsKeypair(input.serverAuthority)
  );
  umi.use(signerIdentity(authoritySigner));

  const assetSigner = createSignerFromKeypair(
    umi,
    fromWeb3JsKeypair(input.assetKeypair)
  );
  // Single source of truth: the deterministic asset signer pubkey.
  const assetAddress = umiPublicKey(assetSigner.publicKey);
  const expectedCoreAsset = String(assetSigner.publicKey);
  const serverAuthorityPubkey = umiPublicKey(
    input.serverAuthority.publicKey.toBase58()
  );
  const name = formatOrganismName(0n);
  const uri = formatOrganismUri(input.metadataBaseUri, 0n);
  const signatures: string[] = [];
  const bornAtUnix = Math.floor(Date.now() / 1000);

  // 1) Core asset exists (create once; never remint on retry).
  let asset = await safeFetchAssetV1(umi, assetAddress, {
    commitment: "confirmed"
  });

  if (!asset) {
    const createSignature = await createAndConfirmSeekerZeroAsset({
      umi,
      connection,
      assetKeypair: input.assetKeypair,
      assetSigner,
      serverAuthority: input.serverAuthority,
      ownerWallet: input.ownerWallet,
      name,
      uri,
      sgtMint: input.sgtMint,
      bornAtUnix
    });
    signatures.push(createSignature);

    asset = await waitForCoreAsset(umi, expectedCoreAsset);
  }

  // Resume-safe: if already fully immutable and valid, do not touch the asset.
  if (isRootUpdateAuthorityNone(asset)) {
    assertFinalizedSeekerZeroCore(asset, {
      name,
      uri,
      ownerWallet: input.ownerWallet,
      sgtMint: input.sgtMint,
      expectedCoreAsset
    });
    return signatures.length > 0
      ? signatures.join(",")
      : `seeker-zero-already-finalized:${expectedCoreAsset}`;
  }

  assertServerStillUpdateAuthority(asset, serverAuthorityPubkey);

  // 2) Final name / URI correct (do not revoke UA here).
  if (asset.name !== name || asset.uri !== uri) {
    const renamed = await update(umi, {
      asset,
      name,
      uri,
      authority: authoritySigner,
      payer: authoritySigner
    }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });

    signatures.push(base58.deserialize(renamed.signature)[0]);
    asset = await fetchAsset(umi, assetAddress, { commitment: "confirmed" });
    assertServerStillUpdateAuthority(asset, serverAuthorityPubkey);
  }

  if (asset.name !== name || asset.uri !== uri) {
    throw new SporeDomainError(
      "finalization_conflict",
      "Seeker Zero Core name/URI finalization did not apply."
    );
  }

  // 3) Attributes correct and immutable.
  if (!asset.attributes) {
    const added = await addPlugin(umi, {
      asset: assetAddress,
      authority: authoritySigner,
      payer: authoritySigner,
      plugin: {
        type: "Attributes",
        attributeList: buildSeekerZeroAttributes({
          sgtMint: input.sgtMint,
          bornAtUnix
        }),
        authority: { type: "None" }
      }
    }).sendAndConfirm(umi, { confirm: { commitment: "confirmed" } });

    signatures.push(base58.deserialize(added.signature)[0]);
    asset = await fetchAsset(umi, assetAddress, { commitment: "confirmed" });
    assertServerStillUpdateAuthority(asset, serverAuthorityPubkey);
  } else if (asset.attributes.authority.type !== "None") {
    throw new SporeDomainError(
      "finalization_conflict",
      "Seeker Zero Core Attributes exist without None authority."
    );
  }

  if (!asset.attributes || asset.attributes.authority.type !== "None") {
    throw new SporeDomainError(
      "finalization_conflict",
      "Seeker Zero Core Attributes are not permanently immutable."
    );
  }
  assertSeekerZeroAttributes(asset, input.sgtMint);

  // 4) PermanentFreezeDelegate frozen with authority None.
  assertPermanentFreeze(asset);

  // 5) ONLY THEN revoke root update authority to None.
  //    Server authority must still be the current UA and must sign.
  const revokeSignature = await revokeRootUpdateAuthorityToNone({
    umi,
    connection,
    asset,
    authoritySigner,
    serverAuthority: input.serverAuthority,
    serverAuthorityPubkey
  });
  signatures.push(revokeSignature);

  // 6) Refetch and verify root UA is actually None (and full final state).
  const finalAsset = await waitForRootUpdateAuthorityNone(umi, expectedCoreAsset);
  assertFinalizedSeekerZeroCore(finalAsset, {
    name,
    uri,
    ownerWallet: input.ownerWallet,
    sgtMint: input.sgtMint,
    expectedCoreAsset
  });

  return signatures.join(",");
}

async function revokeRootUpdateAuthorityToNone(input: {
  umi: Umi;
  connection: Connection;
  asset: AssetV1;
  authoritySigner: ReturnType<typeof createSignerFromKeypair>;
  serverAuthority: Keypair;
  serverAuthorityPubkey: ReturnType<typeof umiPublicKey>;
}): Promise<string> {
  assertServerStillUpdateAuthority(
    input.asset,
    input.serverAuthorityPubkey
  );

  // Dedicated immutability update — only newUpdateAuthority, no other mutations.
  const revokeBuilder = update(input.umi, {
    asset: input.asset,
    newUpdateAuthority: some(updateAuthority("None")),
    authority: input.authoritySigner,
    payer: input.authoritySigner
  });

  const { blockhash, lastValidBlockHeight } =
    await input.connection.getLatestBlockhash("confirmed");

  const transaction = new Transaction({
    feePayer: input.serverAuthority.publicKey,
    blockhash,
    lastValidBlockHeight
  });

  for (const ix of revokeBuilder.getInstructions()) {
    transaction.add(toWeb3JsInstruction(ix));
  }

  // Server authority signs while it is still the current update authority.
  transaction.sign(input.serverAuthority);

  const signature = await input.connection.sendRawTransaction(
    transaction.serialize(),
    {
      skipPreflight: false,
      preflightCommitment: "confirmed"
    }
  );

  const confirmation = await input.connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  if (confirmation.value.err) {
    throw new SporeDomainError(
      "finalization_conflict",
      `Seeker Zero Core update-authority revoke failed: ${JSON.stringify(confirmation.value.err)}`
    );
  }

  return signature;
}

async function createAndConfirmSeekerZeroAsset(input: {
  umi: Umi;
  connection: Connection;
  assetKeypair: Keypair;
  assetSigner: ReturnType<typeof createSignerFromKeypair>;
  serverAuthority: Keypair;
  ownerWallet: string;
  name: string;
  uri: string;
  sgtMint: string;
  bornAtUnix: number;
}): Promise<string> {
  const authoritySigner = createSignerFromKeypair(
    input.umi,
    fromWeb3JsKeypair(input.serverAuthority)
  );

  // Build against the SAME asset signer that will sign the web3.js transaction.
  const createBuilder = create(input.umi, {
    asset: input.assetSigner,
    name: input.name,
    uri: input.uri,
    owner: fromWeb3JsPublicKey(new PublicKey(input.ownerWallet)),
    updateAuthority: fromWeb3JsPublicKey(input.serverAuthority.publicKey),
    payer: authoritySigner,
    authority: authoritySigner,
    plugins: [
      {
        type: "PermanentFreezeDelegate",
        frozen: true,
        authority: { type: "None" }
      },
      {
        type: "Attributes",
        attributeList: buildSeekerZeroAttributes({
          sgtMint: input.sgtMint,
          bornAtUnix: input.bornAtUnix
        }),
        authority: { type: "None" }
      }
    ]
  });

  const { blockhash, lastValidBlockHeight } =
    await input.connection.getLatestBlockhash("confirmed");

  const transaction = new Transaction({
    feePayer: input.serverAuthority.publicKey,
    blockhash,
    lastValidBlockHeight
  });

  for (const ix of createBuilder.getInstructions()) {
    transaction.add(toWeb3JsInstruction(ix));
  }

  // Explicit dual-sign — same pattern as settlement Core create.
  transaction.sign(input.serverAuthority, input.assetKeypair);

  const signature = await input.connection.sendRawTransaction(
    transaction.serialize(),
    {
      skipPreflight: false,
      preflightCommitment: "confirmed"
    }
  );

  const confirmation = await input.connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  if (confirmation.value.err) {
    throw new SporeDomainError(
      "finalization_conflict",
      `Seeker Zero Core create transaction failed: ${JSON.stringify(confirmation.value.err)}`
    );
  }

  return signature;
}

async function waitForCoreAsset(umi: Umi, assetAddress: string): Promise<AssetV1> {
  for (let attempt = 0; attempt < CORE_ACCOUNT_POLL_ATTEMPTS; attempt += 1) {
    const asset = await safeFetchAssetV1(umi, umiPublicKey(assetAddress), {
      commitment: "confirmed"
    });

    if (asset) {
      return asset;
    }

    await sleep(CORE_ACCOUNT_POLL_MS);
  }

  throw new SporeDomainError(
    "finalization_conflict",
    `Seeker Zero Core asset was not found after confirmed create at ${assetAddress}.`
  );
}

async function waitForRootUpdateAuthorityNone(
  umi: Umi,
  assetAddress: string
): Promise<AssetV1> {
  for (let attempt = 0; attempt < CORE_ACCOUNT_POLL_ATTEMPTS; attempt += 1) {
    const asset = await fetchAsset(umi, umiPublicKey(assetAddress), {
      commitment: "confirmed"
    });

    if (isRootUpdateAuthorityNone(asset)) {
      return asset;
    }

    await sleep(CORE_ACCOUNT_POLL_MS);
  }

  throw new SporeDomainError(
    "finalization_conflict",
    "Seeker Zero Core update authority was not revoked to None."
  );
}

function isRootUpdateAuthorityNone(asset: AssetV1): boolean {
  return asset.updateAuthority.type === "None";
}

function assertServerStillUpdateAuthority(
  asset: AssetV1,
  serverAuthorityPubkey: ReturnType<typeof umiPublicKey>
) {
  if (isRootUpdateAuthorityNone(asset)) {
    throw new SporeDomainError(
      "finalization_conflict",
      "Seeker Zero Core update authority is already None; cannot modify further."
    );
  }

  if (
    asset.updateAuthority.type !== "Address" ||
    asset.updateAuthority.address !== serverAuthorityPubkey
  ) {
    throw new SporeDomainError(
      "finalization_conflict",
      "Seeker Zero Core update authority is not the server authority; cannot safely finalize."
    );
  }
}

function assertPermanentFreeze(asset: AssetV1) {
  const freeze = asset.permanentFreezeDelegate;

  if (!freeze || freeze.frozen !== true || freeze.authority.type !== "None") {
    throw new SporeDomainError(
      "finalization_conflict",
      "Seeker Zero Core PermanentFreezeDelegate is not permanently frozen."
    );
  }
}

async function insertSeekerZeroOrganism(input: {
  organismPda: string;
  sgtMint: string;
  coreAsset: string;
  transactionSignature: string;
}): Promise<OrganismIndex> {
  const bornAt = new Date();
  const organismDocument: OrganismIndex = {
    organismPda: input.organismPda,
    organismNumber: SEEKER_ZERO_NUMBER,
    sgtMint: input.sgtMint,
    parentOrganismPda: null,
    generation: SEEKER_ZERO_GENERATION,
    genome: SEEKER_ZERO_GENOME_HEX,
    bornAt,
    mutationSlot: null,
    nextSporeAt: bornAt,
    activeSporeCommitment: EMPTY_SPORE_COMMITMENT_HEX,
    activeSporeExpiresAt: dateFromUnixSeconds(0),
    claimedOfferCommitment: null,
    activeClaimReservationId: null,
    status: ORGANISM_STATUS.finalized,
    coreAsset: input.coreAsset,
    transactionSignature: input.transactionSignature,
    ancestorNumbers: [],
    indexedAt: new Date(),
    createdAt: new Date()
  };

  try {
    await OrganismIndexModel.create(organismDocument);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const existing = await OrganismIndexModel.findOne({
        organismNumber: SEEKER_ZERO_NUMBER
      }).lean();

      if (existing) {
        assertExistingSeekerZero(existing, {
          organismPda: input.organismPda,
          sgtMint: input.sgtMint,
          expectedCoreAsset: input.coreAsset,
          wallet: null
        });
        return existing;
      }
    }

    throw error;
  }

  return organismDocument;
}

function buildSeekerZeroAttributes(input: {
  sgtMint: string;
  bornAtUnix: number;
}) {
  return [
    { key: "organism_number", value: SEEKER_ZERO_NUMBER },
    { key: "sgt_mint", value: input.sgtMint },
    { key: "parent_organism_number", value: "" },
    { key: "parent_sgt_mint", value: "" },
    { key: "generation", value: String(SEEKER_ZERO_GENERATION) },
    { key: "genome", value: SEEKER_ZERO_GENOME_HEX },
    { key: "born_at", value: String(input.bornAtUnix) },
    { key: "mutation_slot", value: "" }
  ];
}

function assertSeekerZeroAttributes(asset: AssetV1, sgtMint: string) {
  const attributeMap = new Map(
    asset.attributes!.attributeList.map((entry) => [entry.key, entry.value])
  );

  if (
    attributeMap.get("organism_number") !== SEEKER_ZERO_NUMBER ||
    attributeMap.get("sgt_mint") !== sgtMint ||
    attributeMap.get("generation") !== String(SEEKER_ZERO_GENERATION) ||
    attributeMap.get("genome") !== SEEKER_ZERO_GENOME_HEX ||
    attributeMap.get("parent_organism_number") !== "" ||
    attributeMap.get("parent_sgt_mint") !== "" ||
    attributeMap.get("mutation_slot") !== ""
  ) {
    throw new SporeDomainError(
      "finalization_conflict",
      "Existing Seeker Zero Core Attributes do not match canonical identity."
    );
  }
}

function assertFinalizedSeekerZeroCore(
  finalAsset: AssetV1,
  input: {
    name: string;
    uri: string;
    ownerWallet: string;
    sgtMint: string;
    expectedCoreAsset: string;
  }
) {
  if (String(finalAsset.publicKey) !== input.expectedCoreAsset) {
    throw new SporeDomainError(
      "finalization_conflict",
      "Seeker Zero Core address does not match the deterministic asset signer."
    );
  }

  if (finalAsset.name !== input.name || finalAsset.uri !== input.uri) {
    throw new SporeDomainError(
      "finalization_conflict",
      "Seeker Zero Core name/URI finalization did not apply."
    );
  }

  if (!isRootUpdateAuthorityNone(finalAsset)) {
    throw new SporeDomainError(
      "finalization_conflict",
      "Seeker Zero Core update authority was not revoked to None."
    );
  }

  if (!finalAsset.attributes || finalAsset.attributes.authority.type !== "None") {
    throw new SporeDomainError(
      "finalization_conflict",
      "Seeker Zero Core Attributes are not permanently immutable."
    );
  }

  assertSeekerZeroAttributes(finalAsset, input.sgtMint);
  assertPermanentFreeze(finalAsset);

  if (finalAsset.owner !== umiPublicKey(input.ownerWallet)) {
    throw new SporeDomainError(
      "finalization_conflict",
      "Seeker Zero Core owner is not the configured wallet."
    );
  }
}

function assertExistingSeekerZero(
  existing: OrganismIndex,
  input: {
    organismPda: string;
    sgtMint: string;
    expectedCoreAsset: string;
    wallet: string | null;
  }
) {
  if (
    existing.organismPda !== input.organismPda ||
    existing.sgtMint !== input.sgtMint ||
    existing.generation !== SEEKER_ZERO_GENERATION ||
    existing.genome !== SEEKER_ZERO_GENOME_HEX ||
    existing.parentOrganismPda !== null
  ) {
    throw new SporeDomainError(
      "organism_already_exists",
      "Organism #0 already exists with a conflicting identity."
    );
  }

  if (existing.coreAsset && existing.coreAsset !== input.expectedCoreAsset) {
    throw new SporeDomainError(
      "organism_already_exists",
      "Organism #0 already exists with a different Core asset."
    );
  }

  void input.wallet;
}

async function assertConfiguredSgtOwnership(wallet: string, sgtMint: string) {
  let verified;

  try {
    verified = await verifySeekerGenesisToken(wallet, {
      expectedMintAddress: sgtMint
    });
  } catch (error) {
    if (error instanceof SgtVerificationUnavailableError) {
      throw new SporeDomainError(
        "verification_unavailable",
        "SGT verification is unavailable."
      );
    }

    throw error;
  }

  if (!verified || verified.mintAddress !== sgtMint) {
    throw new SporeDomainError(
      "not_seeker",
      "Configured Seeker Zero wallet does not hold the configured SGT."
    );
  }
}

function assertPubkey(value: string, label: string) {
  try {
    return new PublicKey(value).toBase58();
  } catch {
    throw new SporeDomainError("server_misconfigured", `Invalid ${label}.`);
  }
}

function assertBirthFee(value: string) {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new SporeDomainError(
      "server_misconfigured",
      "Invalid SPORE_BIRTH_FEE_LAMPORTS."
    );
  }

  const fee = BigInt(value);
  if (fee > 10_000_000n) {
    throw new SporeDomainError(
      "server_misconfigured",
      "SPORE_BIRTH_FEE_LAMPORTS exceeds protocol maximum."
    );
  }
}

function assertMetadataBaseUri(value: string) {
  const normalized = value.replace(/\/+$/, "");
  if (!isValidMetadataBaseUri(normalized)) {
    throw new SporeDomainError(
      "server_misconfigured",
      "Invalid SPORE_METADATA_BASE_URI."
    );
  }
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
