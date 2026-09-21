import { PublicKey } from "@solana/web3.js";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  addPlugin,
  create,
  fetchAsset,
  mplCore,
  update,
  updateAuthority
} from "@metaplex-foundation/mpl-core";
import {
  createSignerFromKeypair,
  publicKey as umiPublicKey,
  signerIdentity
} from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";
import {
  fromWeb3JsKeypair,
  fromWeb3JsPublicKey
} from "@metaplex-foundation/umi-web3js-adapters";
import { SEEKER_ZERO_GENOME_HEX } from "@spore/shared";

import {
  SgtVerificationUnavailableError,
  verifySeekerGenesisToken
} from "../auth/sgt";
import { connectToDatabase } from "../db/mongoose";
import { getHeliusRpcUrl } from "../env";
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
import { insertCanonicalSpeciesOnce } from "./species";

const SEEKER_ZERO_NUMBER = "0";
const SEEKER_ZERO_GENERATION = 0;
const BOOTSTRAP_RESERVATION_ID = "seeker-zero-bootstrap";
const BOOTSTRAP_ATTEMPT_ID = "v1";

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
 * - Refuses to run when species or organism #0 already exists
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

  const existingSpecies = await SpeciesStateModel.findOne({ key: "canonical" }).lean();
  if (existingSpecies) {
    throw new SporeDomainError(
      "species_not_ready",
      "Canonical species state already exists."
    );
  }

  const existingZero = await OrganismIndexModel.findOne({
    organismNumber: SEEKER_ZERO_NUMBER
  }).lean();
  if (existingZero) {
    throw new SporeDomainError(
      "organism_already_exists",
      "Seeker Zero already exists."
    );
  }

  const existingBySgt = await OrganismIndexModel.findOne({ sgtMint }).lean();
  if (existingBySgt) {
    throw new SporeDomainError(
      "organism_already_exists",
      "This SGT already has an organism."
    );
  }

  await assertConfiguredSgtOwnership(wallet, sgtMint);

  const organismPda = deriveOrganismIdentity(sgtMint);
  const bornAt = new Date();
  const assetKeypair = deriveCoreAssetKeypair({
    reservationId: BOOTSTRAP_RESERVATION_ID,
    attemptId: BOOTSTRAP_ATTEMPT_ID
  });
  const serverAuthority = getSporeServerAuthorityKeypair();

  const coreFinalizationSignature = await createSeekerZeroCoreCertificate({
    assetKeypair,
    serverAuthority,
    ownerWallet: wallet,
    metadataBaseUri: input.metadataBaseUri,
    sgtMint
  });

  const organismDocument: OrganismIndex = {
    organismPda,
    organismNumber: SEEKER_ZERO_NUMBER,
    sgtMint,
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
    coreAsset: assetKeypair.publicKey.toBase58(),
    transactionSignature: coreFinalizationSignature,
    ancestorNumbers: [],
    indexedAt: new Date(),
    createdAt: new Date()
  };

  try {
    await OrganismIndexModel.create(organismDocument);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new SporeDomainError(
        "organism_already_exists",
        "Seeker Zero already exists."
      );
    }

    throw error;
  }

  try {
    await insertCanonicalSpeciesOnce({
      seekerZeroOrganismPda: organismPda,
      nextOrganismNumber: "1",
      totalOrganisms: "1",
      treasury,
      birthFeeLamports: input.birthFeeLamports,
      metadataBaseUri: input.metadataBaseUri.replace(/\/+$/, "")
    });
  } catch (error) {
    // Species insert is create-once. If it fails after organism insert, operator
    // must not re-run blindly — surface a clear conflict.
    throw error;
  }

  return {
    organism: organismDocument,
    speciesKey: "canonical",
    coreAsset: assetKeypair.publicKey.toBase58(),
    coreFinalizationSignature
  };
}

async function createSeekerZeroCoreCertificate(input: {
  assetKeypair: ReturnType<typeof deriveCoreAssetKeypair>;
  serverAuthority: ReturnType<typeof getSporeServerAuthorityKeypair>;
  ownerWallet: string;
  metadataBaseUri: string;
  sgtMint: string;
}): Promise<string> {
  const umi = createUmi(getHeliusRpcUrl()).use(mplCore());
  const authoritySigner = createSignerFromKeypair(
    umi,
    fromWeb3JsKeypair(input.serverAuthority)
  );
  umi.use(signerIdentity(authoritySigner));

  const assetSigner = createSignerFromKeypair(
    umi,
    fromWeb3JsKeypair(input.assetKeypair)
  );
  const assetAddress = umiPublicKey(input.assetKeypair.publicKey.toBase58());
  const name = formatOrganismName(0n);
  const uri = formatOrganismUri(input.metadataBaseUri.replace(/\/+$/, ""), 0n);
  const signatures: string[] = [];

  let existing;
  try {
    existing = await fetchAsset(umi, assetAddress);
  } catch {
    existing = null;
  }

  if (!existing) {
    const created = await create(umi, {
      asset: assetSigner,
      name,
      uri,
      owner: fromWeb3JsPublicKey(new PublicKey(input.ownerWallet)),
      updateAuthority: fromWeb3JsPublicKey(input.serverAuthority.publicKey),
      plugins: [
        {
          type: "PermanentFreezeDelegate",
          frozen: true,
          authority: { type: "None" }
        }
      ]
    }).sendAndConfirm(umi);

    signatures.push(base58.deserialize(created.signature)[0]);
  }

  const asset = await fetchAsset(umi, assetAddress);

  if (!asset.attributes) {
    const added = await addPlugin(umi, {
      asset: assetAddress,
      plugin: {
        type: "Attributes",
        attributeList: [
          { key: "organism_number", value: SEEKER_ZERO_NUMBER },
          { key: "sgt_mint", value: input.sgtMint },
          { key: "parent_organism_number", value: "" },
          { key: "parent_sgt_mint", value: "" },
          { key: "generation", value: String(SEEKER_ZERO_GENERATION) },
          { key: "genome", value: SEEKER_ZERO_GENOME_HEX },
          { key: "born_at", value: String(Math.floor(Date.now() / 1000)) },
          { key: "mutation_slot", value: "" }
        ],
        authority: { type: "None" }
      }
    }).sendAndConfirm(umi);

    signatures.push(base58.deserialize(added.signature)[0]);
  } else if (asset.attributes.authority.type !== "None") {
    throw new SporeDomainError(
      "finalization_conflict",
      "Seeker Zero Core Attributes exist without None authority."
    );
  }

  const refreshed = await fetchAsset(umi, assetAddress);

  if (
    refreshed.name !== name ||
    refreshed.uri !== uri ||
    refreshed.updateAuthority.type !== "None"
  ) {
    const updated = await update(umi, {
      asset: refreshed,
      name,
      uri,
      newUpdateAuthority: updateAuthority("None")
    }).sendAndConfirm(umi);

    signatures.push(base58.deserialize(updated.signature)[0]);
  }

  const finalAsset = await fetchAsset(umi, assetAddress);

  if (finalAsset.name !== name || finalAsset.uri !== uri) {
    throw new SporeDomainError(
      "finalization_conflict",
      "Seeker Zero Core name/URI finalization did not apply."
    );
  }

  if (finalAsset.updateAuthority.type !== "None") {
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

  const freeze = finalAsset.permanentFreezeDelegate;

  if (!freeze || freeze.frozen !== true || freeze.authority.type !== "None") {
    throw new SporeDomainError(
      "finalization_conflict",
      "Seeker Zero Core PermanentFreezeDelegate is not permanently frozen."
    );
  }

  if (finalAsset.owner !== umiPublicKey(input.ownerWallet)) {
    throw new SporeDomainError(
      "finalization_conflict",
      "Seeker Zero Core owner is not the configured wallet."
    );
  }

  return signatures.length > 0
    ? signatures.join(",")
    : `seeker-zero-already-finalized:${assetAddress}`;
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
