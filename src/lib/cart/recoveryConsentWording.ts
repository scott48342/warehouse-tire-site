/**
 * Cart Recovery Consent - Wording (client-safe, no server imports)
 *
 * Single source of truth for the consent checkbox wording and its version.
 * Bump CART_RECOVERY_CONSENT_VERSION whenever the wording changes so stored
 * consent records always reference the exact language the customer saw.
 *
 * @created 2026-08-03
 */

export const CART_RECOVERY_CONSENT_VERSION = "cart-recovery-v1.0-2026-08-03";

export const CART_RECOVERY_CONSENT_WORDING =
  "Save my cart and email me a link if I don't finish checking out. " +
  "Reminder emails only \u2014 no promotions. Opt out anytime.";
