import mongoose from "mongoose";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  addPlugin,
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
import { fromWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters";

import { connectToDatabase } from "../db/mongoose";
import {
  CLAIM_RESERVATION_STATUS,
  ClaimReservationModel,
  type ClaimReservation
} from "../models/ClaimReservation";
import {
  ORGANISM_STATUS,
  OrganismIndexModel,
  type OrganismIndex
} from "../models/OrganismIndex";
import {
  CANONICAL_SPECIES_KEY,
  SpeciesStateModel
} from "../models/SpeciesState";
import {
  EMPTY_SPORE_COMMITMENT_HEX,
  dateFromUnixSeconds,
  unixSecondsFromDate
} from "./bytes";
import {
  checkedIncrementU64,
  checkedNextSporeAt,
  formatOrganismName,
  formatOrganismUri
} from "./core";
import { SporeDomainError } from "./errors";
import {
  ensureReproductionFields,
  finalizedOrganismFilter
} from "./organismState";
import { getSporeServerAuthorityKeypair } from "./serverAuthority";
import { getVerifiedSolanaConnection } from "./solanaConnection";
import { getCanonicalSpecies } from "./species";

/**
 * After verified settlement: finalize Core birth certificate, then Mongo organism.
 * Idempotent against the same reservation / asset / organism number.
 */
export async function finalizeClaimBirth(input: {
  reservationId: string;
}): Promise<OrganismIndex> {
  await connectToDatabase();

  const reservation = await ClaimReservationModel.findOne({
    reservationId: input.reservationId
  }).lean();

  if (!reservation) {
    throw new SporeDomainError("organism_not_found", "Claim reservation not found.");
  }

  if (reservation.status === CLAIM_RESERVATION_STATUS.finalized) {
    return loadFinalizedOrganism(reservation);
  }

  if (reservation.status !== CLAIM_RESERVATION_STATUS.settled) {
    throw new SporeDomainError(
      "finalization_conflict",
      "Reservation must be settled before Core/Mongo finalization."
    );
  }

  assertSettledFields(reservation);

  const existing = await OrganismIndexModel.findOne({
    sgtMint: reservation.recipientSgtMint,
    ...finalizedOrganismFilter
  }).lean();

  if (existing) {
    if (
      reservation.organismNumber &&
      existing.organismNumber === reservation.organismNumber &&
      existing.sgtMint === reservation.recipientSgtMint
    ) {
      await ClaimReservationModel.updateOne(
        { reservationId: reservation.reservationId },
        {
          $set: {
            status: CLAIM_RESERVATION_STATUS.finalized,
            updatedAt: new Date()
          }
        }
      );
      return ensureReproductionFields(existing);
    }

    throw new SporeDomainError(
      "organism_already_exists",
      "This Seeker already owns an organism."
    );
  }

  const species = await getCanonicalSpecies();
  let working: ClaimReservation = reservation;

  if (!working.coreFinalizationSignature) {
    const signature = await finalizeCoreBirthCertificate({
      reservation: working,
      metadataBaseUri: species.metadataBaseUri
    });

    const updated = await ClaimReservationModel.findOneAndUpdate(
      {
        reservationId: working.reservationId,
        status: CLAIM_RESERVATION_STATUS.settled
      },
      {
        $set: {
          coreFinalizationSignature: signature,
          updatedAt: new Date()
        }
      },
      { new: true }
    ).lean();

    working = updated ?? { ...working, coreFinalizationSignature: signature };
  }

  return finalizeMongoOrganism(working);
}

async function finalizeCoreBirthCertificate(input: {
  reservation: ClaimReservation;
  metadataBaseUri: string;
}): Promise<string> {
  const reservation = input.reservation;
  const serverAuthority = getSporeServerAuthorityKeypair();
  const connection = await getVerifiedSolanaConnection();
  const umi = createUmi(connection.rpcEndpoint).use(mplCore());
  const authoritySigner = createSignerFromKeypair(
    umi,
    fromWeb3JsKeypair(serverAuthority)
  );
  umi.use(signerIdentity(authoritySigner));

  const assetAddress = umiPublicKey(reservation.expectedCoreAsset!);
  const organismNumber = BigInt(reservation.organismNumber!);
  const name = formatOrganismName(organismNumber);
  const uri = formatOrganismUri(input.metadataBaseUri, organismNumber);

  const parent = await OrganismIndexModel.findOne({
    organismPda: reservation.parentOrganismPda,
    ...finalizedOrganismFilter
  }).lean();

  if (!parent) {
    throw new SporeDomainError("invalid_parent", "Parent organism not found.");
  }

  const asset = await fetchAsset(umi, assetAddress);
  const signatures: string[] = [];

  if (!asset.attributes) {
    const added = await addPlugin(umi, {
      asset: assetAddress,
      plugin: {
        type: "Attributes",
        attributeList: buildBirthAttributes({
          reservation,
          parentOrganismNumber: parent.organismNumber,
          parentSgtMint: parent.sgtMint
        }),
        authority: { type: "None" }
      }
    }).sendAndConfirm(umi);

    signatures.push(base58.deserialize(added.signature)[0]);
  } else if (asset.attributes.authority.type !== "None") {
    throw new SporeDomainError(
      "finalization_conflict",
      "Core Attributes plugin exists without None authority; cannot safely continue."
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
      "Core asset name/URI finalization did not apply."
    );
  }

  if (finalAsset.updateAuthority.type !== "None") {
    throw new SporeDomainError(
      "finalization_conflict",
      "Core update authority was not revoked to None."
    );
  }

  if (!finalAsset.attributes || finalAsset.attributes.authority.type !== "None") {
    throw new SporeDomainError(
      "finalization_conflict",
      "Core Attributes plugin is not permanently immutable."
    );
  }

  const attributeMap = new Map(
    finalAsset.attributes.attributeList.map((entry: { key: string; value: string }) => [
      entry.key,
      entry.value
    ])
  );

  if (
    attributeMap.get("organism_number") !== reservation.organismNumber ||
    attributeMap.get("sgt_mint") !== reservation.recipientSgtMint ||
    attributeMap.get("genome") !== reservation.genome ||
    attributeMap.get("generation") !== String(reservation.generation) ||
    attributeMap.get("parent_organism_number") !== parent.organismNumber ||
    attributeMap.get("parent_sgt_mint") !== parent.sgtMint ||
    attributeMap.get("born_at") !==
      String(unixSecondsFromDate(reservation.bornAt!)) ||
    attributeMap.get("mutation_slot") !== reservation.mutationSlot
  ) {
    throw new SporeDomainError(
      "finalization_conflict",
      "Core Attributes do not match the settled reservation."
    );
  }

  const freeze = finalAsset.permanentFreezeDelegate;

  if (!freeze || freeze.frozen !== true || freeze.authority.type !== "None") {
    throw new SporeDomainError(
      "finalization_conflict",
      "Core PermanentFreezeDelegate is not permanently frozen."
    );
  }

  if (signatures.length === 0) {
    return reservation.coreFinalizationSignature ?? `already-finalized:${reservation.reservationId}`;
  }

  return signatures.join(",");
}

async function finalizeMongoOrganism(
  reservation: ClaimReservation
): Promise<OrganismIndex> {
  assertSettledFields(reservation);

  const parent = await OrganismIndexModel.findOne({
    organismPda: reservation.parentOrganismPda,
    ...finalizedOrganismFilter
  }).lean();

  if (!parent) {
    throw new SporeDomainError("invalid_parent", "Parent organism not found.");
  }

  const normalizedParent = await ensureReproductionFields(parent);
  const bornAt = reservation.bornAt!;
  const bornAtUnix = unixSecondsFromDate(bornAt);
  const nextParentSporeAtSeconds = checkedNextSporeAt(BigInt(bornAtUnix));

  if (nextParentSporeAtSeconds === null) {
    throw new SporeDomainError("math_overflow", "Parent cooldown overflow.");
  }

  const session = await mongoose.startSession();

  try {
    let organism: OrganismIndex | null = null;

    await session.withTransaction(async () => {
      const liveReservation = await ClaimReservationModel.findOne({
        reservationId: reservation.reservationId
      })
        .session(session)
        .lean();

      if (!liveReservation) {
        throw new SporeDomainError("claim_conflict", "Reservation disappeared.");
      }

      if (liveReservation.status === CLAIM_RESERVATION_STATUS.finalized) {
        organism = await OrganismIndexModel.findOne({
          sgtMint: liveReservation.recipientSgtMint
        })
          .session(session)
          .lean();
        return;
      }

      if (liveReservation.status !== CLAIM_RESERVATION_STATUS.settled) {
        throw new SporeDomainError(
          "finalization_conflict",
          "Reservation is not settled."
        );
      }

      const species = await SpeciesStateModel.findOne({ key: CANONICAL_SPECIES_KEY })
        .session(session)
        .lean();

      if (!species) {
        throw new SporeDomainError("species_not_ready", "Canonical species missing.");
      }

      const totalOrganismsNext = checkedIncrementU64(BigInt(species.totalOrganisms));

      if (totalOrganismsNext === null) {
        throw new SporeDomainError("math_overflow", "Species totalOrganisms overflow.");
      }

      const childDocument: OrganismIndex = {
        organismPda: liveReservation.childOrganismPda!,
        organismNumber: liveReservation.organismNumber!,
        sgtMint: liveReservation.recipientSgtMint,
        parentOrganismPda: liveReservation.parentOrganismPda,
        generation: liveReservation.generation!,
        genome: liveReservation.genome!,
        bornAt,
        mutationSlot: liveReservation.mutationSlot!,
        nextSporeAt: bornAt,
        activeSporeCommitment: EMPTY_SPORE_COMMITMENT_HEX,
        activeSporeExpiresAt: dateFromUnixSeconds(0),
        claimedOfferCommitment: liveReservation.sporeCommitment,
        activeClaimReservationId: null,
        status: ORGANISM_STATUS.finalized,
        coreAsset: liveReservation.expectedCoreAsset!,
        transactionSignature: liveReservation.settlementSignature!,
        ancestorNumbers: [
          ...normalizedParent.ancestorNumbers,
          normalizedParent.organismNumber
        ],
        indexedAt: new Date(),
        createdAt: new Date()
      };

      let createdNew = false;

      try {
        await OrganismIndexModel.create([childDocument], { session });
        organism = childDocument;
        createdNew = true;
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }

        organism = await OrganismIndexModel.findOne({
          sgtMint: liveReservation.recipientSgtMint
        })
          .session(session)
          .lean();
      }

      // Successful birth always consumes the parent spore and starts cooldown,
      // even if the parent offer row was concurrently mutated.
      await OrganismIndexModel.updateOne(
        {
          organismPda: liveReservation.parentOrganismPda
        },
        {
          $set: {
            activeSporeCommitment: EMPTY_SPORE_COMMITMENT_HEX,
            activeSporeExpiresAt: dateFromUnixSeconds(0),
            activeClaimReservationId: null,
            nextSporeAt: dateFromUnixSeconds(nextParentSporeAtSeconds)
          }
        },
        { session }
      );

      if (createdNew) {
        const speciesUpdate = await SpeciesStateModel.updateOne(
          {
            key: CANONICAL_SPECIES_KEY,
            totalOrganisms: species.totalOrganisms
          },
          {
            $set: {
              totalOrganisms: totalOrganismsNext.toString(),
              updatedAt: new Date()
            }
          },
          { session }
        );

        if (speciesUpdate.modifiedCount !== 1) {
          throw new SporeDomainError(
            "finalization_conflict",
            "Species totalOrganisms update conflict."
          );
        }
      }

      await ClaimReservationModel.updateOne(
        {
          reservationId: liveReservation.reservationId,
          status: CLAIM_RESERVATION_STATUS.settled
        },
        {
          $set: {
            status: CLAIM_RESERVATION_STATUS.finalized,
            updatedAt: new Date()
          }
        },
        { session }
      );
    });

    if (!organism) {
      throw new SporeDomainError(
        "finalization_conflict",
        "Unable to finalize organism in Mongo."
      );
    }

    return ensureReproductionFields(organism);
  } finally {
    await session.endSession();
  }
}

function buildBirthAttributes(input: {
  reservation: ClaimReservation;
  parentOrganismNumber: string;
  parentSgtMint: string;
}) {
  return [
    { key: "organism_number", value: input.reservation.organismNumber! },
    { key: "sgt_mint", value: input.reservation.recipientSgtMint },
    { key: "parent_organism_number", value: input.parentOrganismNumber },
    { key: "parent_sgt_mint", value: input.parentSgtMint },
    { key: "generation", value: String(input.reservation.generation!) },
    { key: "genome", value: input.reservation.genome! },
    {
      key: "born_at",
      value: String(unixSecondsFromDate(input.reservation.bornAt!))
    },
    { key: "mutation_slot", value: input.reservation.mutationSlot! }
  ];
}

function assertSettledFields(reservation: ClaimReservation) {
  if (
    !reservation.expectedCoreAsset ||
    !reservation.settlementSignature ||
    !reservation.organismNumber ||
    reservation.generation == null ||
    !reservation.genome ||
    !reservation.bornAt ||
    !reservation.mutationSlot ||
    !reservation.childOrganismPda ||
    !reservation.settlementSlot ||
    reservation.settlementBlockTime == null
  ) {
    throw new SporeDomainError(
      "finalization_conflict",
      "Settled reservation is missing immutable birth fields."
    );
  }
}

async function loadFinalizedOrganism(reservation: ClaimReservation) {
  const organism = await OrganismIndexModel.findOne({
    sgtMint: reservation.recipientSgtMint,
    ...finalizedOrganismFilter
  }).lean();

  if (!organism) {
    throw new SporeDomainError(
      "finalization_conflict",
      "Reservation is finalized but organism record is missing."
    );
  }

  return ensureReproductionFields(organism);
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}
