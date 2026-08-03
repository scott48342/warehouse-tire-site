/**
 * Recovery Email Eligibility - Pure Decision Logic
 *
 * Extracted so every send decision is deterministic and unit-testable.
 * The abandoned-cart email sender gathers facts, then this function decides.
 *
 * RULES (Phase 1, 2026-08-03):
 * 1. Test carts never get emails.
 * 2. No email address -> skip.
 * 3. Cart already recovered/expired/archived -> skip.
 * 4. Cart-level unsubscribe -> skip.
 * 5. Below minimum cart value -> skip.
 * 6. Requires DEDICATED cart-recovery consent. Marketing consent alone is
 *    NOT sufficient. No consent record (e.g. historical carts) -> skip.
 * 7. A completed order for this email after cart creation -> skip
 *    (covers "completed between reminders").
 * 8. This step already sent (duplicate scheduler run) -> skip.
 * 9. Cooldown between emails.
 *
 * @created 2026-08-03
 */

export type SkipReason =
  | "test_data"
  | "no_email"
  | "already_recovered"
  | "cart_not_abandoned"
  | "unsubscribed"
  | "below_min_value"
  | "no_recovery_consent"
  | "order_completed"
  | "step_already_sent"
  | "cooldown";

export interface RecoveryEligibilityInput {
  isTest: boolean;
  email: string | null | undefined;
  cartStatus: string; // "active" | "abandoned" | "recovered" | "expired" | "archived"
  cartUnsubscribed: boolean;
  cartValue: number;
  minCartValue: number;
  /** Dedicated cart-recovery consent (NOT marketing consent) */
  hasRecoveryConsent: boolean;
  /** A completed order exists for this email after the cart was created */
  hasCompletedOrder: boolean;
  /** The send timestamp for THIS step is already set (duplicate run guard) */
  stepAlreadySent: boolean;
  /** Hours since the most recent recovery email for this cart (null = none) */
  hoursSinceLastEmail: number | null;
  cooldownHours: number;
}

export type RecoveryEligibilityResult =
  | { allowed: true }
  | { allowed: false; reason: SkipReason };

export function decideRecoveryEmail(
  input: RecoveryEligibilityInput
): RecoveryEligibilityResult {
  if (input.isTest) return { allowed: false, reason: "test_data" };

  if (!input.email || !input.email.includes("@")) {
    return { allowed: false, reason: "no_email" };
  }

  if (input.cartStatus === "recovered") {
    return { allowed: false, reason: "already_recovered" };
  }

  if (input.cartStatus !== "abandoned") {
    return { allowed: false, reason: "cart_not_abandoned" };
  }

  if (input.cartUnsubscribed) {
    return { allowed: false, reason: "unsubscribed" };
  }

  if (input.cartValue < input.minCartValue) {
    return { allowed: false, reason: "below_min_value" };
  }

  // Dedicated recovery consent required. Marketing consent alone is NOT enough.
  if (!input.hasRecoveryConsent) {
    return { allowed: false, reason: "no_recovery_consent" };
  }

  // Completed order (before first email OR between reminders) stops everything.
  if (input.hasCompletedOrder) {
    return { allowed: false, reason: "order_completed" };
  }

  // Duplicate scheduler run guard.
  if (input.stepAlreadySent) {
    return { allowed: false, reason: "step_already_sent" };
  }

  if (
    input.hoursSinceLastEmail !== null &&
    input.hoursSinceLastEmail < input.cooldownHours
  ) {
    return { allowed: false, reason: "cooldown" };
  }

  return { allowed: true };
}
