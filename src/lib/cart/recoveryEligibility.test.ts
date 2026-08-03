/**
 * Recovery Email Eligibility Tests
 *
 * Covers the Phase 1 required scenarios:
 * 1. Email entered, no consent -> skip
 * 2. Recovery consent checked -> send
 * 3. Marketing consent only -> skip (recovery consent is separate)
 * 4. Both consents -> send
 * 5. Cart completed before first email -> skip
 * 6. Cart completed between reminders -> skip
 * 7. Customer opts out -> skip
 * 8. Invalid/expired recovery link (see recoveryLink.test.ts)
 * 9. Duplicate scheduler runs -> skip second run
 * 10. Existing abandoned carts without recovery consent -> skip
 *
 * @created 2026-08-03
 */

import { decideRecoveryEmail, type RecoveryEligibilityInput } from "./recoveryEligibility";

function baseInput(overrides: Partial<RecoveryEligibilityInput> = {}): RecoveryEligibilityInput {
  return {
    isTest: false,
    email: "customer@example.com",
    cartStatus: "abandoned",
    cartUnsubscribed: false,
    cartValue: 500,
    minCartValue: 50,
    hasRecoveryConsent: true,
    hasCompletedOrder: false,
    stepAlreadySent: false,
    hoursSinceLastEmail: null,
    cooldownHours: 6,
    ...overrides,
  };
}

describe("decideRecoveryEmail", () => {
  // Scenario 1: Email entered at checkout, checkbox NOT checked
  test("email entered but no recovery consent -> skipped (no_recovery_consent)", () => {
    const result = decideRecoveryEmail(baseInput({ hasRecoveryConsent: false }));
    expect(result).toEqual({ allowed: false, reason: "no_recovery_consent" });
  });

  // Scenario 2: Recovery consent checked
  test("recovery consent checked -> allowed", () => {
    const result = decideRecoveryEmail(baseInput({ hasRecoveryConsent: true }));
    expect(result).toEqual({ allowed: true });
  });

  // Scenario 3: Marketing consent only (recovery consent is a SEPARATE record;
  // marketing consent is not an input here because it must never gate recovery)
  test("marketing consent only (no recovery consent) -> skipped", () => {
    const result = decideRecoveryEmail(baseInput({ hasRecoveryConsent: false }));
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toBe("no_recovery_consent");
  });

  // Scenario 4: Both consents -> behaves exactly like recovery-consent-only
  test("both consents -> allowed (recovery consent is what matters)", () => {
    const result = decideRecoveryEmail(baseInput({ hasRecoveryConsent: true }));
    expect(result).toEqual({ allowed: true });
  });

  // Scenario 5: Cart completed before first email
  test("cart recovered before first email -> skipped (already_recovered)", () => {
    const result = decideRecoveryEmail(baseInput({ cartStatus: "recovered" }));
    expect(result).toEqual({ allowed: false, reason: "already_recovered" });
  });

  // Scenario 5b: Completed order matched by email even if cart status stale
  test("completed order for email (cart status stale) -> skipped (order_completed)", () => {
    const result = decideRecoveryEmail(baseInput({ hasCompletedOrder: true }));
    expect(result).toEqual({ allowed: false, reason: "order_completed" });
  });

  // Scenario 6: Cart completed between reminders (first sent, then order placed)
  test("order completed between reminders -> skipped (order_completed)", () => {
    const result = decideRecoveryEmail(
      baseInput({ hasCompletedOrder: true, hoursSinceLastEmail: 23 })
    );
    expect(result).toEqual({ allowed: false, reason: "order_completed" });
  });

  // Scenario 7: Customer opts out (cart-level unsubscribe)
  test("customer opted out (cart unsubscribed) -> skipped (unsubscribed)", () => {
    const result = decideRecoveryEmail(baseInput({ cartUnsubscribed: true }));
    expect(result).toEqual({ allowed: false, reason: "unsubscribed" });
  });

  // Scenario 7b: Customer opts out (consent revoked)
  test("customer revoked recovery consent -> skipped (no_recovery_consent)", () => {
    const result = decideRecoveryEmail(baseInput({ hasRecoveryConsent: false }));
    expect(result).toEqual({ allowed: false, reason: "no_recovery_consent" });
  });

  // Scenario 9: Duplicate scheduler runs
  test("duplicate scheduler run (step already sent) -> skipped (step_already_sent)", () => {
    const result = decideRecoveryEmail(baseInput({ stepAlreadySent: true }));
    expect(result).toEqual({ allowed: false, reason: "step_already_sent" });
  });

  test("cooldown between reminders enforced", () => {
    const result = decideRecoveryEmail(baseInput({ hoursSinceLastEmail: 2 }));
    expect(result).toEqual({ allowed: false, reason: "cooldown" });
  });

  test("cooldown elapsed -> allowed", () => {
    const result = decideRecoveryEmail(baseInput({ hoursSinceLastEmail: 23 }));
    expect(result).toEqual({ allowed: true });
  });

  // Scenario 10: Historical carts (email captured pre-Phase-1, no consent record)
  test("historical cart without recovery consent -> skipped (never retroactively enrolled)", () => {
    const result = decideRecoveryEmail(
      baseInput({ hasRecoveryConsent: false, cartValue: 1271.84 })
    );
    expect(result).toEqual({ allowed: false, reason: "no_recovery_consent" });
  });

  // Guard rails
  test("test carts never get emails", () => {
    const result = decideRecoveryEmail(baseInput({ isTest: true }));
    expect(result).toEqual({ allowed: false, reason: "test_data" });
  });

  test("missing email -> skipped", () => {
    const result = decideRecoveryEmail(baseInput({ email: null }));
    expect(result).toEqual({ allowed: false, reason: "no_email" });
  });

  test("below minimum cart value -> skipped", () => {
    const result = decideRecoveryEmail(baseInput({ cartValue: 25 }));
    expect(result).toEqual({ allowed: false, reason: "below_min_value" });
  });

  test("expired cart -> skipped (cart_not_abandoned)", () => {
    const result = decideRecoveryEmail(baseInput({ cartStatus: "expired" }));
    expect(result).toEqual({ allowed: false, reason: "cart_not_abandoned" });
  });
});
