import { getAuthenticatedSeeker, type AuthenticatedSeeker } from "../auth/session";
import { assertServerReproductionEnabled } from "../env";
import { RequestBodyError, readJsonObject } from "../http/request";
import { jsonError, type ErrorCode } from "../http/responses";
import { SporeDomainError } from "./errors";
import { SPORE_SECRET_BYTE_LENGTH } from "./bytes";

const BASE64URL_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const RESERVATION_ID_PATTERN = /^[0-9a-f]{64}$/;
const PUBLIC_KEY_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SIGNATURE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{80,96}$/;

export async function requireAuthenticatedSeeker(
  request: Request
): Promise<AuthenticatedSeeker | Response> {
  try {
    assertServerReproductionEnabled();
  } catch {
    return jsonError(
      503,
      "server_misconfigured",
      "SPØR reproduction is unavailable."
    );
  }

  const seeker = await getAuthenticatedSeeker(request);

  if (!seeker) {
    return jsonError(401, "unauthorized", "Unauthorized.");
  }

  return seeker;
}

export async function readSporeJsonBody(request: Request, maxBytes = 4096) {
  return readJsonObject(request, maxBytes);
}

export function parseBase64UrlSecret(value: unknown): Uint8Array {
  if (typeof value !== "string" || !BASE64URL_SECRET_PATTERN.test(value)) {
    throw new RequestBodyError(400, "Invalid spore secret.");
  }

  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  const secret = Uint8Array.from(
    Buffer.from(`${padded}${"=".repeat(padLength)}`, "base64")
  );

  if (secret.length !== SPORE_SECRET_BYTE_LENGTH || !secret.some((byte) => byte !== 0)) {
    secret.fill(0);
    throw new RequestBodyError(400, "Invalid spore secret.");
  }

  return secret;
}

export function parseReservationId(value: unknown): string {
  if (typeof value !== "string" || !RESERVATION_ID_PATTERN.test(value)) {
    throw new RequestBodyError(400, "Invalid reservation id.");
  }

  return value;
}

export function parseParentOrganismPda(value: unknown): string {
  if (typeof value !== "string" || !PUBLIC_KEY_PATTERN.test(value)) {
    throw new RequestBodyError(400, "Invalid parent organism.");
  }

  return value;
}

export function parseTransactionSignature(value: unknown): string {
  if (typeof value !== "string" || !SIGNATURE_PATTERN.test(value)) {
    throw new RequestBodyError(400, "Invalid transaction signature.");
  }

  return value;
}

export function requireStringField(body: Record<string, unknown>, key: string): unknown {
  if (!Object.hasOwn(body, key)) {
    throw new RequestBodyError(400, "Invalid request.");
  }

  return body[key];
}

export function sporeDomainErrorResponse(error: SporeDomainError): Response {
  const mapping = mapSporeDomainError(error);
  return jsonError(mapping.status, mapping.code, mapping.message);
}

export function handleSporeRouteError(error: unknown): Response {
  if (error instanceof RequestBodyError) {
    return jsonError(error.status, "bad_request", error.message);
  }

  if (error instanceof SporeDomainError) {
    return sporeDomainErrorResponse(error);
  }

  return jsonError(503, "server_misconfigured", "SPØR reproduction is unavailable.");
}

function mapSporeDomainError(error: SporeDomainError): {
  status: number;
  code: ErrorCode;
  message: string;
} {
  switch (error.code) {
    case "unauthorized":
      return { status: 401, code: "unauthorized", message: error.message };
    case "not_seeker":
      return { status: 403, code: "not_seeker", message: error.message };
    case "organism_not_found":
    case "invalid_parent":
    case "no_active_spore":
      return { status: 404, code: "not_found", message: error.message };
    case "invalid_spore_secret":
    case "invalid_spore_commitment":
      return { status: 400, code: "bad_request", message: error.message };
    case "verification_unavailable":
    case "slot_unavailable":
    case "server_misconfigured":
      return { status: 503, code: "server_misconfigured", message: error.message };
    case "spore_not_ready":
      return { status: 409, code: "spore_not_ready", message: error.message };
    case "spore_offer_expired":
      return { status: 409, code: "spore_offer_expired", message: error.message };
    case "active_spore_already_released":
      return {
        status: 409,
        code: "active_spore_already_released",
        message: error.message
      };
    case "organism_already_exists":
      return { status: 409, code: "organism_already_exists", message: error.message };
    case "self_reproduction":
      return { status: 409, code: "self_reproduction", message: error.message };
    case "claim_conflict":
    case "math_overflow":
      return { status: 409, code: "claim_conflict", message: error.message };
    case "settlement_invalid":
      return { status: 409, code: "settlement_invalid", message: error.message };
    case "settlement_expired":
      return { status: 409, code: "settlement_expired", message: error.message };
    case "settlement_not_ready":
      return { status: 409, code: "settlement_not_ready", message: error.message };
    case "finalization_conflict":
      return { status: 409, code: "finalization_conflict", message: error.message };
    case "species_not_ready":
      return { status: 409, code: "species_not_ready", message: error.message };
    default:
      return { status: 503, code: "server_misconfigured", message: "SPØR reproduction is unavailable." };
  }
}

export function isAuthenticatedSeeker(
  value: AuthenticatedSeeker | Response
): value is AuthenticatedSeeker {
  return !(value instanceof Response);
}
