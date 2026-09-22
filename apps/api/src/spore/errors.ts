export class SporeDomainError extends Error {
  constructor(
    readonly code:
      | "unauthorized"
      | "not_seeker"
      | "organism_not_found"
      | "species_not_ready"
      | "spore_not_ready"
      | "active_spore_already_released"
      | "invalid_spore_secret"
      | "invalid_spore_commitment"
      | "no_active_spore"
      | "spore_offer_expired"
      | "self_reproduction"
      | "organism_already_exists"
      | "claim_conflict"
      | "math_overflow"
      | "verification_unavailable"
      | "slot_unavailable"
      | "invalid_parent"
      | "settlement_invalid"
      | "settlement_expired"
      | "settlement_not_ready"
      | "settlement_simulation_failed"
      | "finalization_conflict"
      | "server_misconfigured",
    message: string
  ) {
    super(message);
    this.name = "SporeDomainError";
  }
}
