/**
 * Checkout Diagnostics - Client Logger
 *
 * Privacy-safe diagnostics for the checkout funnel. Answers "WHY didn't
 * this checkout complete?" by classifying failures that pure funnel events
 * can't distinguish (validation vs JS error vs API failure vs decline vs
 * voluntary exit).
 *
 * NEVER sends: card numbers, CVC, payment tokens, full addresses, full
 * emails, or phone numbers. Error messages are sanitized and truncated.
 *
 * Event types:
 * - checkout_loaded              customer landed on checkout with items
 * - validation_failed            client-side form validation blocked progress
 * - shipping_calc_result         shipping estimate ok/failed
 * - tax_calc_result              tax calculation ok/failed
 * - payment_element_init         Stripe PaymentElement init ok/failed
 * - payment_submit_attempt       customer pressed Pay
 * - payment_declined             provider declined (card_declined etc.)
 * - payment_provider_error       provider technical error
 * - payment_succeeded            payment confirmed client-side
 * - api_failure                  checkout API call failed (non-payment)
 * - js_exception                 unhandled JS exception on checkout page
 * - checkout_exit                customer left checkout (voluntary signal)
 *
 * @created 2026-08-03 (Phase 1 mobile checkout observability)
 */

"use client";

export type CheckoutDiagnosticEvent =
  | "checkout_loaded"
  | "validation_failed"
  | "shipping_calc_result"
  | "tax_calc_result"
  | "payment_element_init"
  | "payment_submit_attempt"
  | "payment_declined"
  | "payment_provider_error"
  | "payment_succeeded"
  | "api_failure"
  | "js_exception"
  | "checkout_exit";

export interface CheckoutDiagnosticInput {
  eventType: CheckoutDiagnosticEvent;
  checkoutStep?: string;
  status?: "ok" | "fail" | "error";
  endpoint?: string;
  httpStatus?: number;
  errorCode?: string;
  /** Small, PII-free detail object (field names OK, values are NOT ok) */
  detail?: Record<string, unknown>;
}

const PII_KEY_RE = /(email|phone|address|card|cvc|cvv|token|secret|name|zip|postal)/i;

/** Strip anything that looks like PII from detail values. */
function sanitizeDetail(detail?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!detail) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (PII_KEY_RE.test(key)) continue; // never forward PII-ish keys
    if (typeof value === "string") {
      out[key] = sanitizeErrorMessage(value);
    } else if (typeof value === "number" || typeof value === "boolean" || value === null) {
      out[key] = value;
    } else if (Array.isArray(value)) {
      out[key] = value.slice(0, 10).map((v) => (typeof v === "string" ? sanitizeErrorMessage(v) : v));
    }
    // objects are dropped - keep payloads flat and predictable
  }
  return out;
}

/** Remove emails/phones/long digit runs from free-text error messages. */
export function sanitizeErrorMessage(message: string): string {
  return String(message)
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]")
    .replace(/\b\d{7,}\b/g, "[digits]")
    .slice(0, 300);
}

function getCartId(): string | undefined {
  try {
    return localStorage.getItem("wt_cart_id") || undefined;
  } catch {
    return undefined;
  }
}

function getSessionId(): string | undefined {
  try {
    return (
      sessionStorage.getItem("wtd_session_id") ||
      sessionStorage.getItem("wt_session_id") ||
      undefined
    );
  } catch {
    return undefined;
  }
}

function getDeviceType(): string {
  const ua = navigator.userAgent.toLowerCase();
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return "mobile";
  return "desktop";
}

function getBrowser(): string {
  const ua = navigator.userAgent;
  // Order matters
  if (/edg\//i.test(ua)) return "edge";
  if (/samsungbrowser/i.test(ua)) return "samsung";
  if (/opr\//i.test(ua)) return "opera";
  if (/chrome|crios/i.test(ua)) return "chrome";
  if (/firefox|fxios/i.test(ua)) return "firefox";
  if (/safari/i.test(ua)) return "safari";
  return "other";
}

function getSiteMode(): string {
  return window.location.hostname.includes("warehousetire.net") ? "local" : "national";
}

/**
 * Log a checkout diagnostic event. Fire-and-forget; never throws and never
 * blocks the checkout flow.
 */
export function logCheckoutDiagnostic(input: CheckoutDiagnosticInput): void {
  if (typeof window === "undefined") return;

  try {
    const payload = {
      cartId: getCartId(),
      sessionId: getSessionId(),
      deviceType: getDeviceType(),
      browser: getBrowser(),
      siteMode: getSiteMode(),
      checkoutStep: input.checkoutStep,
      eventType: input.eventType,
      status: input.status,
      endpoint: input.endpoint,
      httpStatus: input.httpStatus,
      errorCode: input.errorCode ? sanitizeErrorMessage(input.errorCode).slice(0, 120) : undefined,
      detail: sanitizeDetail(input.detail),
      pageUrl: window.location.pathname + window.location.search.replace(/([?&])(email|phone)=[^&]*/gi, "$1$2=[redacted]"),
    };

    const body = JSON.stringify(payload);

    // sendBeacon survives page unload (critical for exit events)
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/checkout/diagnostics", blob);
    } else {
      fetch("/api/checkout/diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }

    // Mirror into Microsoft Clarity when present (session filtering)
    const clarity = (window as any).clarity;
    if (typeof clarity === "function") {
      clarity("event", `checkout_${input.eventType}`);
      if (input.status === "fail" || input.status === "error") {
        clarity("upgrade", `checkout_${input.eventType}`);
        clarity("set", "checkout_error", input.errorCode || input.eventType);
      }
    }
  } catch {
    // Never break checkout for diagnostics
  }
}
