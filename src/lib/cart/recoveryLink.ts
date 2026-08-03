/**
 * Cart Recovery Link Signing
 *
 * HMAC-signed, expiring tokens for cart recovery and recovery opt-out links.
 * Prevents cart enumeration (guessing cart IDs) from exposing cart contents
 * and prevents forged opt-out requests.
 *
 * Token format: `${expiresAtMs}.${hmacHex32}`
 * HMAC message: `${purpose}:${cartId}:${expiresAtMs}`
 *
 * Secret: CART_RECOVERY_LINK_SECRET env var.
 * Fail-open policy: if the secret is not configured, links are generated
 * unsigned and verification passes with a console warning (legacy behavior).
 * Once the secret is set in production, tokens become mandatory.
 *
 * @created 2026-08-03 (Phase 1 abandoned-cart consent rework)
 */

import crypto from "crypto";

export type LinkPurpose = "recover" | "optout";

export const RECOVERY_LINK_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
export const OPTOUT_LINK_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

export type TokenVerification =
  | { valid: true; reason: "ok" | "no_secret_configured" }
  | { valid: false; reason: "missing_token" | "malformed_token" | "expired" | "bad_signature" };

function getSecret(): string | null {
  const secret = process.env.CART_RECOVERY_LINK_SECRET || "";
  return secret.length >= 16 ? secret : null;
}

function hmac(secret: string, purpose: LinkPurpose, cartId: string, expiresAtMs: number): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${purpose}:${cartId}:${expiresAtMs}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Sign a token for a cart link. Returns null when no secret is configured
 * (caller should emit an unsigned legacy link).
 */
export function signCartToken(
  cartId: string,
  purpose: LinkPurpose,
  ttlMs?: number,
  nowMs: number = Date.now()
): string | null {
  const secret = getSecret();
  if (!secret) return null;

  const ttl = ttlMs ?? (purpose === "optout" ? OPTOUT_LINK_TTL_MS : RECOVERY_LINK_TTL_MS);
  const expiresAtMs = nowMs + ttl;
  return `${expiresAtMs}.${hmac(secret, purpose, cartId, expiresAtMs)}`;
}

/**
 * Verify a token for a cart link.
 */
export function verifyCartToken(
  cartId: string,
  token: string | null | undefined,
  purpose: LinkPurpose,
  nowMs: number = Date.now()
): TokenVerification {
  const secret = getSecret();

  if (!secret) {
    // Fail-open for legacy links until the secret is configured.
    console.warn("[recoveryLink] CART_RECOVERY_LINK_SECRET not configured - accepting unsigned link");
    return { valid: true, reason: "no_secret_configured" };
  }

  if (!token) return { valid: false, reason: "missing_token" };

  const dot = token.indexOf(".");
  if (dot <= 0) return { valid: false, reason: "malformed_token" };

  const expiresAtMs = Number(token.slice(0, dot));
  const sig = token.slice(dot + 1);
  if (!Number.isFinite(expiresAtMs) || !/^[0-9a-f]{32}$/i.test(sig)) {
    return { valid: false, reason: "malformed_token" };
  }

  const expected = hmac(secret, purpose, cartId, expiresAtMs);
  const sigBuf = Buffer.from(sig.toLowerCase(), "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { valid: false, reason: "bad_signature" };
  }

  if (nowMs > expiresAtMs) return { valid: false, reason: "expired" };

  return { valid: true, reason: "ok" };
}
