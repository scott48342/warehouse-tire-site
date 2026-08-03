/**
 * Checkout Diagnostics - Server Logger
 *
 * Server-side companion to diagnosticsClient.ts. Used where the client can't
 * see the failure (e.g. "payment succeeded but order creation failed" inside
 * the Stripe webhook).
 *
 * Privacy: never pass emails, phones, addresses, or payment tokens.
 *
 * @created 2026-08-03 (Phase 1 mobile checkout observability)
 */

import { db } from "@/lib/fitment-db/db";
import { checkoutDiagnostics } from "@/lib/fitment-db/schema";

export interface ServerDiagnosticInput {
  eventType:
    | "order_create_failed"
    | "inventory_unavailable"
    | "payment_provider_error"
    | "api_failure";
  cartId?: string | null;
  checkoutStep?: string;
  status?: "ok" | "fail" | "error";
  endpoint?: string;
  errorCode?: string;
  detail?: Record<string, unknown>;
}

function scrub(value: string | undefined | null, maxLen: number): string | null {
  if (!value) return null;
  return String(value)
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]")
    .replace(/\b\d{7,}\b/g, "[digits]")
    .slice(0, maxLen);
}

/**
 * Fire-and-forget server-side diagnostic. Never throws.
 */
export async function logCheckoutDiagnosticServer(input: ServerDiagnosticInput): Promise<void> {
  try {
    await db.insert(checkoutDiagnostics).values({
      cartId: scrub(input.cartId, 100),
      sessionId: null,
      deviceType: "server",
      browser: null,
      siteMode: null,
      checkoutStep: scrub(input.checkoutStep, 50),
      eventType: input.eventType,
      status: input.status || "error",
      endpoint: scrub(input.endpoint, 200),
      httpStatus: null,
      errorCode: scrub(input.errorCode, 120),
      detail: input.detail || null,
      pageUrl: null,
    });
  } catch (err) {
    console.error("[checkoutDiagnostics/server] Failed to log:", err);
  }
}
