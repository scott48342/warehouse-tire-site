/**
 * Client-side PaymentIntent lifecycle for the embedded checkout (Codex review 2026-09-20,
 * stale PaymentIntent invalidation).
 *
 * Framework-free on purpose: the checkout page holds one `PaymentIntentSession` in React state
 * and drives it through these pure transitions, so the whole "inputs changed under a live /
 * in-flight intent" behaviour is unit-testable with a mocked fetch and no DOM.
 *
 * Rules enforced here:
 *  - The session is keyed on the checkout fingerprint (`paymentIntentInputKey`). Any change
 *    bumps `generation`, drops the live intent (clientSecret / paymentIntentId / quoteId),
 *    drops the pending AND accepted totals revision, and remembers the abandoned intent id so
 *    the next create request asks the server to cancel it.
 *  - Every create request is tagged with the generation it was started for. A response whose
 *    generation is no longer current is ignored - success, revision, error and completion
 *    alike - so a stale reply can never re-install a secret for an amount the shopper is not
 *    looking at. A stale *success* is not lost: its intent id is queued for cancellation.
 *  - `liveClientSecret()` derives the secret to render from the CURRENT fingerprint, so the
 *    payment UI disappears in the same render the inputs change, not one effect later.
 */

export type RevisionLike = { total: number };

export type PaymentIntentSession<R extends RevisionLike = RevisionLike> = {
  /** Bumped on every fingerprint change. Requests answer only for their own generation. */
  generation: number;
  /** Latest fingerprint applied. */
  currentKey: string | null;
  /** Fingerprint the live intent was created from (null when there is no live intent). */
  intentKey: string | null;
  clientSecret: string | null;
  paymentIntentId: string | null;
  quoteId: string | null;
  /** Generation of the create request in flight, if any. */
  inFlight: number | null;
  /** Server-revised totals awaiting the shopper's explicit acceptance. */
  pendingRevision: R | null;
  /** Server total the shopper accepted; sent as expectedTotal until inputs change again. */
  acceptedTotal: number | null;
  error: string | null;
};

export function initialPaymentIntentSession<R extends RevisionLike = RevisionLike>(): PaymentIntentSession<R> {
  return {
    generation: 0, currentKey: null, intentKey: null, clientSecret: null, paymentIntentId: null, quoteId: null,
    inFlight: null, pendingRevision: null, acceptedTotal: null, error: null,
  };
}

export type ApplyInputKeyResult<R extends RevisionLike> = {
  session: PaymentIntentSession<R>;
  changed: boolean;
  /** A live intent was dropped (payment UI must hide). */
  invalidatedIntent: boolean;
  /** A create request was in flight; its reply will be ignored. */
  abandonedRequest: boolean;
  /** A pending or accepted totals revision was dropped. */
  droppedRevision: boolean;
};

/** Apply the current checkout fingerprint. Unchanged key -> identity (same object). */
export function applyInputKey<R extends RevisionLike>(s: PaymentIntentSession<R>, key: string): ApplyInputKeyResult<R> {
  if (s.currentKey === key) return { session: s, changed: false, invalidatedIntent: false, abandonedRequest: false, droppedRevision: false };
  const invalidatedIntent = Boolean(s.clientSecret);
  const abandonedRequest = s.inFlight !== null;
  const droppedRevision = s.pendingRevision !== null || s.acceptedTotal !== null;
  return {
    session: {
      ...s,
      generation: s.generation + 1,
      currentKey: key,
      intentKey: null,
      clientSecret: null,
      paymentIntentId: null,
      quoteId: null,
      inFlight: null,
      // Keep an earlier abandoned id if it has not been sent for cancellation yet.
        pendingRevision: null,
      acceptedTotal: null,
      error: null,
    },
    changed: true, invalidatedIntent, abandonedRequest, droppedRevision,
  };
}

/** The secret the payment UI may render RIGHT NOW: only if it belongs to the current fingerprint. */
export function liveClientSecret<R extends RevisionLike>(s: PaymentIntentSession<R>, currentKey: string): string | null {
  return s.clientSecret && s.intentKey === currentKey ? s.clientSecret : null;
}

/** A create request may start: shopper inputs complete, no live intent, nothing in flight, no revision awaiting review. */
export function canCreateIntent<R extends RevisionLike>(s: PaymentIntentSession<R>, inputsComplete: boolean): boolean {
  return inputsComplete && s.currentKey !== null && !s.clientSecret && s.inFlight === null && s.pendingRevision === null;
}

export type IntentRequestTag = {
  generation: number;
  inputKey: string;
  /** Sent as `expectedTotal` when the shopper accepted a server revision. */
  acceptedTotal: number | null;
};

export function beginIntentRequest<R extends RevisionLike>(s: PaymentIntentSession<R>): { session: PaymentIntentSession<R>; tag: IntentRequestTag } {
  if (s.currentKey === null) throw new Error("beginIntentRequest: no fingerprint applied");
  return {
    session: { ...s, inFlight: s.generation, error: null },
    tag: { generation: s.generation, inputKey: s.currentKey, acceptedTotal: s.acceptedTotal },
  };
}

export type IntentRequestOutcome<R extends RevisionLike = RevisionLike> =
  | { kind: "intent"; clientSecret: string; paymentIntentId: string | null; quoteId: string | null }
  | { kind: "revision"; revised: R }
  | { kind: "error"; message: string; code: string; httpStatus?: number };

/** Classify a create-payment-intent HTTP response body. */
export function classifyIntentResponse<R extends RevisionLike>(httpStatus: number, ok: boolean, data: unknown): IntentRequestOutcome<R> {
  const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  if (ok && d.ok === true && typeof d.clientSecret === "string" && d.clientSecret) {
    return {
      kind: "intent",
      clientSecret: d.clientSecret,
      paymentIntentId: typeof d.paymentIntentId === "string" ? d.paymentIntentId : null,
      quoteId: typeof d.quoteId === "string" ? d.quoteId : null,
    };
  }
  if (d.error === "totals_changed" && d.revised && typeof d.revised === "object" && typeof (d.revised as RevisionLike).total === "number") {
    return { kind: "revision", revised: d.revised as R };
  }
  return {
    kind: "error",
    message: String(d.detail || d.error || "Failed to initialize payment"),
    code: String(d.error || "payment_intent_failed"),
    httpStatus,
  };
}

export type SettleResult<R extends RevisionLike> = { session: PaymentIntentSession<R>; stale: boolean };

/**
 * Settle a create request. A reply for a superseded generation changes nothing: its secret is
 * never installed, so an abandoned intent simply expires unconfirmed on Stripe's side.
 */
export function settleIntentRequest<R extends RevisionLike>(s: PaymentIntentSession<R>, tag: IntentRequestTag, outcome: IntentRequestOutcome<R>): SettleResult<R> {
  if (tag.generation !== s.generation) return { session: s, stale: true };
  const settled: PaymentIntentSession<R> = { ...s, inFlight: null };
  switch (outcome.kind) {
    case "intent":
      return {
        session: { ...settled, intentKey: tag.inputKey, clientSecret: outcome.clientSecret, paymentIntentId: outcome.paymentIntentId, quoteId: outcome.quoteId, error: null },
        stale: false,
      };
    case "revision":
      return { session: { ...settled, pendingRevision: outcome.revised, acceptedTotal: null, error: null }, stale: false };
    case "error":
      return { session: { ...settled, error: outcome.message }, stale: false };
  }
}

/** Server revised the total on a non-embedded path (hosted / Affirm): park it for review. */
export function withPendingRevision<R extends RevisionLike>(s: PaymentIntentSession<R>, revised: R): PaymentIntentSession<R> {
  return { ...s, pendingRevision: revised, acceptedTotal: null, error: null };
}

/** Shopper accepted the revised total: it becomes the expectedTotal for the next request. */
export function acceptPendingRevision<R extends RevisionLike>(s: PaymentIntentSession<R>): PaymentIntentSession<R> {
  if (!s.pendingRevision) return s;
  return { ...s, acceptedTotal: s.pendingRevision.total, pendingRevision: null };
}

/**
 * Perform the create request for a tag with an injectable fetch. Never throws; a thrown fetch
 * becomes an `error` outcome so `finally`-style handling is also generation-gated by the caller.
 */
export async function runIntentRequest<R extends RevisionLike>(
  fetchImpl: (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>,
  body: Record<string, unknown>,
  url = "/api/stripe/create-payment-intent",
): Promise<IntentRequestOutcome<R>> {
  try {
    const res = await fetchImpl(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    return classifyIntentResponse<R>(res.status, res.ok, data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { kind: "error", message, code: "payment_intent_exception" };
  }
}
