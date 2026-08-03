/**
 * Checkout Diagnostics API
 *
 * POST /api/checkout/diagnostics
 * Receives privacy-safe checkout diagnostics from the client
 * (src/lib/checkout/diagnosticsClient.ts) and server-side callers.
 *
 * Defense-in-depth: even though the client sanitizes, this route re-validates
 * field lengths, whitelists event types, and never persists free-form PII.
 *
 * @created 2026-08-03 (Phase 1 mobile checkout observability)
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { checkoutDiagnostics } from "@/lib/fitment-db/schema";

export const runtime = "nodejs";

const ALLOWED_EVENT_TYPES = new Set([
  "checkout_loaded",
  "validation_failed",
  "shipping_calc_result",
  "tax_calc_result",
  "payment_element_init",
  "payment_submit_attempt",
  "payment_declined",
  "payment_provider_error",
  "payment_succeeded",
  "api_failure",
  "js_exception",
  "checkout_exit",
  // server-side origin
  "order_create_failed",
  "inventory_unavailable",
]);

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/g;

function clean(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.replace(EMAIL_RE, "[email]").replace(/\b\d{7,}\b/g, "[digits]").trim();
  return v ? v.slice(0, maxLen) : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const eventType = String(body.eventType || "");
    if (!ALLOWED_EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ ok: false, error: "invalid_event_type" }, { status: 400 });
    }

    // Sanitize detail: flat object, PII-ish keys dropped, strings scrubbed
    let detail: Record<string, unknown> | null = null;
    if (body.detail && typeof body.detail === "object" && !Array.isArray(body.detail)) {
      detail = {};
      let count = 0;
      for (const [key, value] of Object.entries(body.detail as Record<string, unknown>)) {
        if (count >= 20) break;
        if (/(email|phone|address|card|cvc|cvv|token|secret|name|zip|postal)/i.test(key)) continue;
        if (typeof value === "string") detail[key.slice(0, 60)] = clean(value, 300);
        else if (typeof value === "number" || typeof value === "boolean" || value === null) {
          detail[key.slice(0, 60)] = value;
        }
        count++;
      }
    }

    const httpStatusNum = Number(body.httpStatus);

    await db.insert(checkoutDiagnostics).values({
      cartId: clean(body.cartId, 100),
      sessionId: clean(body.sessionId, 100),
      deviceType: clean(body.deviceType, 20),
      browser: clean(body.browser, 120),
      siteMode: clean(body.siteMode, 20),
      checkoutStep: clean(body.checkoutStep, 50),
      eventType,
      status: clean(body.status, 20),
      endpoint: clean(body.endpoint, 200),
      httpStatus: Number.isFinite(httpStatusNum) ? Math.trunc(httpStatusNum) : null,
      errorCode: clean(body.errorCode, 120),
      detail,
      pageUrl: clean(body.pageUrl, 500),
    });

    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[checkout/diagnostics] Error:", e);
    // Never signal hard failure to the client for diagnostics
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
