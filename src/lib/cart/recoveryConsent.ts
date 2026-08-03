/**
 * Cart Recovery Consent Service
 *
 * Manages the dedicated consent record for abandoned-cart recovery emails.
 *
 * CONSENT MODEL (Phase 1, 2026-08-03):
 * - Cart recovery consent is SEPARATE from general marketing consent.
 * - Checking the checkout "save my cart" checkbox consents ONLY to cart
 *   recovery reminders (transactional-adjacent), never promotions.
 * - Recovery emails REQUIRE this consent. Marketing consent alone is NOT
 *   sufficient (and never enrolls anyone in cart recovery).
 * - Entering an email at checkout WITHOUT checking the box records nothing.
 * - Revoking (opt-out link in recovery emails) stops all further reminders.
 *
 * @created 2026-08-03
 */

import { db } from "@/lib/fitment-db/db";
import { cartRecoveryConsents, emailSubscribers } from "@/lib/fitment-db/schema";
import { eq, and, isNull } from "drizzle-orm";

// ============================================================================
// Consent Wording (versioned - client-safe module, re-exported here)
// ============================================================================

export {
  CART_RECOVERY_CONSENT_VERSION,
  CART_RECOVERY_CONSENT_WORDING,
} from "@/lib/cart/recoveryConsentWording";
import { CART_RECOVERY_CONSENT_VERSION } from "@/lib/cart/recoveryConsentWording";

// ============================================================================
// Types
// ============================================================================

export interface RecordConsentInput {
  email: string;
  cartId?: string;
  sessionId?: string;
  consentSource: string; // e.g. "checkout_checkbox"
  ipAddress?: string;
  userAgent?: string;
  isTest?: boolean;
}

export interface EmailConsentProfile {
  /** Dedicated cart-recovery consent (required for recovery emails) */
  cartRecoveryConsent: boolean;
  /** General promotional marketing consent (email_subscribers) */
  marketingConsent: boolean;
  /** Unsubscribed from the general marketing list */
  marketingUnsubscribed: boolean;
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

// ============================================================================
// Write Operations
// ============================================================================

/**
 * Record (or re-affirm) cart recovery consent for an email.
 * Upsert keyed on email; re-consent clears any prior revocation.
 */
export async function recordCartRecoveryConsent(input: RecordConsentInput): Promise<void> {
  const email = normalizeEmail(input.email);
  if (!email || !email.includes("@")) {
    throw new Error("invalid_email");
  }

  const now = new Date();

  await db
    .insert(cartRecoveryConsents)
    .values({
      email,
      cartId: input.cartId || null,
      sessionId: input.sessionId || null,
      consented: true,
      consentSource: input.consentSource,
      consentWordingVersion: CART_RECOVERY_CONSENT_VERSION,
      consentedAt: now,
      revokedAt: null,
      revokedSource: null,
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null,
      isTest: input.isTest || false,
    })
    .onConflictDoUpdate({
      target: cartRecoveryConsents.email, // email has a UNIQUE constraint
      set: {
        consented: true,
        cartId: input.cartId || null,
        sessionId: input.sessionId || null,
        consentSource: input.consentSource,
        consentWordingVersion: CART_RECOVERY_CONSENT_VERSION,
        consentedAt: now,
        revokedAt: null,
        revokedSource: null,
        updatedAt: now,
      },
    });
}

/**
 * Revoke cart recovery consent (customer opted out or unchecked the box).
 * No-op if no consent record exists (nothing to revoke).
 */
export async function revokeCartRecoveryConsent(
  emailRaw: string,
  revokedSource: string
): Promise<void> {
  const email = normalizeEmail(emailRaw);
  if (!email) return;

  const now = new Date();

  await db
    .update(cartRecoveryConsents)
    .set({
      consented: false,
      revokedAt: now,
      revokedSource,
      updatedAt: now,
    })
    .where(eq(cartRecoveryConsents.email, email));
}

// ============================================================================
// Read Operations
// ============================================================================

/**
 * Does this email have active cart-recovery consent?
 */
export async function hasCartRecoveryConsent(emailRaw: string): Promise<boolean> {
  const email = normalizeEmail(emailRaw);
  if (!email) return false;

  const [row] = await db
    .select({ id: cartRecoveryConsents.id })
    .from(cartRecoveryConsents)
    .where(
      and(
        eq(cartRecoveryConsents.email, email),
        eq(cartRecoveryConsents.consented, true),
        isNull(cartRecoveryConsents.revokedAt)
      )
    )
    .limit(1);

  return !!row;
}

/**
 * Full consent profile for an email, distinguishing:
 * - cart recovery consent (dedicated record)
 * - promotional marketing consent (email_subscribers)
 *
 * Transactional order communication (order confirmations, shipping updates)
 * requires no consent record and is not gated here.
 */
export async function getEmailConsentProfile(emailRaw: string): Promise<EmailConsentProfile> {
  const email = normalizeEmail(emailRaw);

  const [recovery, subscriber] = await Promise.all([
    hasCartRecoveryConsent(email),
    db
      .select({
        marketingConsent: emailSubscribers.marketingConsent,
        unsubscribed: emailSubscribers.unsubscribed,
      })
      .from(emailSubscribers)
      .where(eq(emailSubscribers.email, email))
      .limit(1)
      .then((rows) => rows[0] || null),
  ]);

  return {
    cartRecoveryConsent: recovery,
    marketingConsent: !!subscriber?.marketingConsent && !subscriber?.unsubscribed,
    marketingUnsubscribed: !!subscriber?.unsubscribed,
  };
}
