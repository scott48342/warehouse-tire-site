/**
 * Fulfilment guard (Codex review 2026-09-20, stale PaymentIntent / revision invalidation).
 *
 * Both Stripe routes persist the exact charge they created on the quote
 * (`snapshot.expectedChargeCents`). The webhook fulfils a quote only when Stripe reports that
 * exact amount as paid. The amount is server-set on both flows, so a mismatch means a stale or
 * duplicated intent, a replayed event for another quote, or a bug - never something to ship on.
 * Quotes written before this field existed carry no expectation and are not blocked.
 */
export type PaidAmountMismatch = { expectedCents: number; paidCents: number };

export function paidAmountMismatch(
  snapshot: { expectedChargeCents?: number | null } | null | undefined,
  paidCents: unknown,
): PaidAmountMismatch | null {
  const expected = snapshot?.expectedChargeCents;
  if (typeof expected !== "number" || !Number.isFinite(expected)) return null;
  const paid = typeof paidCents === "number" && Number.isFinite(paidCents) ? Math.round(paidCents) : NaN;
  return Math.round(expected) === paid ? null : { expectedCents: Math.round(expected), paidCents: paid };
}
