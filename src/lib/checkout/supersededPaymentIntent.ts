/**
 * Stale PaymentIntent invalidation (Codex review 2026-09-20).
 *
 * The embedded checkout creates a PaymentIntent once the address is complete. When the shopper
 * then changes anything that prices the order (cart lines, ship-to, discount, store) the client
 * drops that intent and asks for a new one, sending the old id as `supersedesPaymentIntentId`.
 * We cancel it so the stale amount can never be confirmed, even by a Payment Element that is
 * still mounted in another tab.
 *
 * Only an intent this cart created is cancellable from here: the id must match Stripe's format,
 * its metadata.cartId must equal the caller's cartId, and it must still be awaiting payment.
 * Anything else is refused and logged. Cancellation is best effort: the new intent is created
 * either way, because the webhook's paid-amount guard is the hard stop.
 */
export type SupersedeOutcome = "skipped" | "cancelled" | "refused" | "failed";

const CANCELLABLE = new Set(["requires_payment_method", "requires_confirmation", "requires_action"]);
const PI_ID = /^pi_[A-Za-z0-9]{8,}$/;

type PaymentIntentLike = { status?: string; metadata?: Record<string, string> | null };
type StripeLike = {
  paymentIntents: {
    retrieve: (id: string) => Promise<PaymentIntentLike>;
    cancel: (id: string, params?: { cancellation_reason?: "abandoned" | "duplicate" | "fraudulent" | "requested_by_customer" }) => Promise<unknown>;
  };
};

export async function cancelSupersededPaymentIntent(
  stripe: StripeLike,
  candidate: unknown,
  cartId: string | undefined,
  log: Pick<Console, "warn" | "log"> = console,
): Promise<SupersedeOutcome> {
  if (typeof candidate !== "string" || !PI_ID.test(candidate)) return "skipped";
  try {
    const pi = await stripe.paymentIntents.retrieve(candidate);
    const owner = typeof pi?.metadata?.cartId === "string" ? pi.metadata.cartId : "";
    if (!cartId || !owner || owner !== cartId) {
      log.warn(`[checkout/payment-intent] refused to cancel ${candidate}: cart mismatch`);
      return "refused";
    }
    if (!CANCELLABLE.has(String(pi?.status))) {
      log.warn(`[checkout/payment-intent] refused to cancel ${candidate}: status ${pi?.status}`);
      return "refused";
    }
    await stripe.paymentIntents.cancel(candidate, { cancellation_reason: "abandoned" });
    log.log(`[checkout/payment-intent] cancelled superseded PaymentIntent ${candidate}`);
    return "cancelled";
  } catch (e: unknown) {
    log.warn(`[checkout/payment-intent] cancel of superseded ${candidate} failed: ${e instanceof Error ? e.message : String(e)}`);
    return "failed";
  }
}
