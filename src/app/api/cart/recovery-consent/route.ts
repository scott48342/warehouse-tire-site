/**
 * Cart Recovery Consent API
 *
 * POST /api/cart/recovery-consent
 * Records or revokes the customer's dedicated cart-recovery email consent
 * (the "save my cart / remind me" checkbox at checkout).
 *
 * This does NOT subscribe the customer to promotional marketing.
 * General marketing consent (email_subscribers) is completely separate.
 *
 * Body: { email, cartId?, sessionId?, consented: boolean, source? }
 *
 * @created 2026-08-03 (Phase 1 consent rework)
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  recordCartRecoveryConsent,
  revokeCartRecoveryConsent,
  CART_RECOVERY_CONSENT_VERSION,
} from "@/lib/cart/recoveryConsent";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const email = String(body.email || "").toLowerCase().trim();
    const cartId = typeof body.cartId === "string" ? body.cartId.trim().slice(0, 100) : undefined;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim().slice(0, 100) : undefined;
    const consented = body.consented !== false; // default true
    const source = typeof body.source === "string" && body.source.trim()
      ? body.source.trim().slice(0, 100)
      : "checkout_checkbox";

    if (!email || !EMAIL_RE.test(email) || email.length > 255) {
      return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
    }

    const hdrs = await headers();
    const userAgent = hdrs.get("user-agent") || undefined;
    const forwardedFor = hdrs.get("x-forwarded-for");
    const ipAddress = forwardedFor?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || undefined;

    if (consented) {
      await recordCartRecoveryConsent({
        email,
        cartId,
        sessionId,
        consentSource: source,
        ipAddress,
        userAgent,
      });
    } else {
      await revokeCartRecoveryConsent(email, source);
    }

    return NextResponse.json(
      { ok: true, consented, wordingVersion: CART_RECOVERY_CONSENT_VERSION },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (e: any) {
    console.error("[cart/recovery-consent] Error:", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
