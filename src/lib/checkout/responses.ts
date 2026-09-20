/**
 * Customer-facing responses for the two Stripe checkout routes (release review
 * 2026-09-19, Codex browser acceptance follow-up).
 *
 * - Rejections: one wording per rejection class; the client gets reason/sku/axle/name
 *   only, the full rejection (incl. `detail`) is logged server-side.
 * - Failures: the client never sees raw exception text (a pg / Stripe / supplier
 *   message is an internals leak). It gets a generic message plus a short reference
 *   id that is also written to the server log with the real error.
 */
import { NextResponse } from "next/server";
import type { CheckoutLineRejection } from "./buildCheckoutLines";

export const CHECKOUT_FAILED_MESSAGE = "We couldn't start checkout right now. Please try again in a moment or contact us.";

const REJECTION_DETAIL: Record<CheckoutLineRejection["reason"], string> = {
  unpriceable: "One or more items could not be priced. Please remove and re-add them.",
  rear_unresolved: "The rear wheels of a staggered set could not be matched. Please remove and re-add the set.",
  finish_mismatch: "The front and rear wheels of a staggered set must share a finish. Please remove and re-add the set.",
  hardware_not_entitled: "Included install hardware requires a wheel set in the same order. Please remove the hardware or add the wheels.",
  hardware_unverifiable:
    "We couldn't confirm the included install hardware for your wheels and vehicle. Please re-select your vehicle and wheels, or contact us before ordering.",
  hardware_mismatch:
    "The included install hardware in your cart doesn't match your selected wheels and vehicle. Please remove it and re-add the wheels so we can recalculate it.",
};

/** Error code the client sees; hardware problems get their own code so the UI can explain them. */
export function rejectionErrorCode(rejected: CheckoutLineRejection[]): "line_unpriceable" | "hardware_unverified" {
  return rejected.some((r) => r.reason === "hardware_unverifiable" || r.reason === "hardware_mismatch")
    ? "hardware_unverified"
    : "line_unpriceable";
}

export function rejectionDetail(rejected: CheckoutLineRejection[]): string {
  // Hardware problems first (they are what the shopper must fix), else the first rejection.
  const lead = rejected.find((r) => r.reason === "hardware_unverifiable" || r.reason === "hardware_mismatch") ?? rejected[0];
  return lead ? REJECTION_DETAIL[lead.reason] : REJECTION_DETAIL.unpriceable;
}

export function rejectedLinesResponse(scope: string, rejected: CheckoutLineRejection[]) {
  console.warn(`[${scope}] rejected lines:`, rejected);
  return NextResponse.json(
    {
      ok: false,
      error: rejectionErrorCode(rejected),
      detail: rejectionDetail(rejected),
      rejected: rejected.map(({ reason, sku, axle, name }) => ({ reason, sku, ...(axle ? { axle } : {}), name })),
    },
    { status: 409 },
  );
}

export function checkoutFailureResponse(scope: string, e: unknown) {
  const ref = `chk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  console.error(`[${scope}] checkout failed ref=${ref}:`, e);
  return NextResponse.json({ ok: false, error: "checkout_failed", detail: CHECKOUT_FAILED_MESSAGE, ref }, { status: 500 });
}
