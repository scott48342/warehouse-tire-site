/**
 * @jest-environment node
 *
 * Stale PaymentIntent invalidation - client state machine (Codex review 2026-09-20).
 * Pure module + mocked fetch. No Stripe, no network, no DOM.
 */
import {
  initialPaymentIntentSession, applyInputKey, liveClientSecret, canCreateIntent, beginIntentRequest,
  settleIntentRequest, classifyIntentResponse, runIntentRequest, withPendingRevision, acceptPendingRevision,
  type PaymentIntentSession,
} from "@/lib/checkout/paymentIntentSession";
import { paymentIntentInputKey } from "@/lib/checkout/paymentIntentInputs";

type Rev = { total: number; retry: "embedded" | "hosted" };
type S = PaymentIntentSession<Rev>;

const KEY_A = "key-a";
const KEY_B = "key-b";

function liveSession(key = KEY_A, pi = "pi_live_0000000001", secret = `${pi}_secret_x`): S {
  let s: S = applyInputKey(initialPaymentIntentSession<Rev>(), key).session;
  const b = beginIntentRequest(s);
  s = settleIntentRequest(b.session, b.tag, { kind: "intent", clientSecret: secret, paymentIntentId: pi, quoteId: "q_1" }).session;
  return s;
}

/** Deferred fetch: resolves when the test says so, like a request still on the wire. */
function deferredFetch() {
  let resolve!: (v: { ok: boolean; status: number; json: () => Promise<unknown> }) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>((res, rej) => { resolve = res; reject = rej; });
  const fetchImpl = jest.fn(() => promise);
  return { fetchImpl, resolve, reject };
}
const okBody = (pi: string, quoteId = "q_9") => ({ ok: true, status: 200, json: async () => ({ ok: true, clientSecret: `${pi}_secret_y`, paymentIntentId: pi, quoteId }) });

describe("applyInputKey - any fingerprint change invalidates everything the shopper could pay against", () => {
  it("first key just arms the session; the same key again is an identity", () => {
    const s0 = initialPaymentIntentSession<Rev>();
    const r1 = applyInputKey(s0, KEY_A);
    expect(r1.changed).toBe(true);
    expect(r1.session.generation).toBe(1);
    expect(r1.invalidatedIntent).toBe(false);
    const r2 = applyInputKey(r1.session, KEY_A);
    expect(r2.changed).toBe(false);
    expect(r2.session).toBe(r1.session);
  });

  it("input change AFTER the intent exists: secret/intent/quote dropped, generation bumped, old intent queued for cancellation", () => {
    const live = liveSession();
    expect(liveClientSecret(live, KEY_A)).toBe("pi_live_0000000001_secret_x");
    const r = applyInputKey(live, KEY_B);
    expect(r).toMatchObject({ changed: true, invalidatedIntent: true, abandonedRequest: false });
    expect(r.session).toMatchObject({ generation: live.generation + 1, currentKey: KEY_B, intentKey: null, clientSecret: null, paymentIntentId: null, quoteId: null, supersededPaymentIntentId: "pi_live_0000000001", error: null });
    expect(liveClientSecret(r.session, KEY_B)).toBeNull();
  });

  it("payment UI hides in the SAME render: a live secret is not renderable against a new fingerprint even before the session updates", () => {
    const live = liveSession();
    expect(liveClientSecret(live, KEY_B)).toBeNull();
  });

  it("drops the pending AND the accepted totals revision", () => {
    const withPending = withPendingRevision(liveSession(), { total: 1234.56, retry: "embedded" });
    const r1 = applyInputKey(withPending, KEY_B);
    expect(r1.droppedRevision).toBe(true);
    expect(r1.session.pendingRevision).toBeNull();
    const accepted = acceptPendingRevision(withPending);
    expect(accepted.acceptedTotal).toBe(1234.56);
    const r2 = applyInputKey(accepted, KEY_B);
    expect(r2.droppedRevision).toBe(true);
    expect(r2.session.acceptedTotal).toBeNull();
    // and the next request no longer carries the stale accepted total
    expect(beginIntentRequest(r2.session).tag.acceptedTotal).toBeNull();
  });

  it("keeps an earlier abandoned intent id if it was never sent for cancellation (no live intent to replace it)", () => {
    const r1 = applyInputKey(liveSession(), KEY_B); // queues pi_live_0000000001
    const r2 = applyInputKey(r1.session, "key-c");   // no live intent now
    expect(r2.session.supersededPaymentIntentId).toBe("pi_live_0000000001");
  });
});

describe("in-flight request + input change: stale replies are ignored (success, revision, error, completion)", () => {
  it("stale SUCCESS installs nothing, marks nothing loading, and queues the orphaned intent for cancellation", async () => {
    let s: S = applyInputKey(initialPaymentIntentSession<Rev>(), KEY_A).session;
    const { fetchImpl, resolve } = deferredFetch();
    const b = beginIntentRequest(s);
    s = b.session;
    expect(s.inFlight).toBe(b.tag.generation);
    expect(canCreateIntent(s, true)).toBe(false); // one request at a time

    // shopper edits while the request is on the wire
    const r = applyInputKey(s, KEY_B);
    expect(r.abandonedRequest).toBe(true);
    s = r.session;
    expect(s.inFlight).toBeNull();           // "finally" happened synchronously with the input change
    expect(canCreateIntent(s, true)).toBe(true); // the new generation may request immediately

    resolve(okBody("pi_stale_0000000002"));
    const outcome = await runIntentRequest<Rev>(fetchImpl, { any: "body" });
    const settled = settleIntentRequest(s, b.tag, outcome);
    expect(settled.stale).toBe(true);
    expect(settled.session.clientSecret).toBeNull();
    expect(settled.session.quoteId).toBeNull();
    expect(settled.session.inFlight).toBeNull();
    expect(settled.session.generation).toBe(s.generation);
    expect(liveClientSecret(settled.session, KEY_B)).toBeNull();
    expect(settled.session.supersededPaymentIntentId).toBe("pi_stale_0000000002");
    // the next (current-generation) request asks the server to cancel it
    expect(beginIntentRequest(settled.session).tag.supersedesPaymentIntentId).toBe("pi_stale_0000000002");
  });

  it("stale REVISION and stale ERROR change nothing visible", async () => {
    let s: S = applyInputKey(initialPaymentIntentSession<Rev>(), KEY_A).session;
    const b = beginIntentRequest(s);
    s = applyInputKey(b.session, KEY_B).session;
    const rev = settleIntentRequest(s, b.tag, { kind: "revision", revised: { total: 999, retry: "embedded" } });
    expect(rev.stale).toBe(true);
    expect(rev.session).toBe(s);
    const err = settleIntentRequest(s, b.tag, { kind: "error", message: "boom", code: "x" });
    expect(err.stale).toBe(true);
    expect(err.session.error).toBeNull();
  });

  it("stale success does not overwrite an already-queued cancellation id", () => {
    let s: S = applyInputKey(liveSession(), KEY_B).session; // queued pi_live_0000000001
    const b = beginIntentRequest(s);
    s = applyInputKey(b.session, "key-c").session;
    const settled = settleIntentRequest(s, b.tag, { kind: "intent", clientSecret: "sec", paymentIntentId: "pi_other_000000003", quoteId: "q" });
    expect(settled.stale).toBe(true);
    expect(settled.session.supersededPaymentIntentId).toBe("pi_live_0000000001");
  });

  it("two overlapping requests: only the reply for the CURRENT generation lands, in either arrival order", async () => {
    let s: S = applyInputKey(initialPaymentIntentSession<Rev>(), KEY_A).session;
    const first = beginIntentRequest(s);
    s = applyInputKey(first.session, KEY_B).session;
    const second = beginIntentRequest(s);
    s = second.session;

    // second (current) reply arrives first
    s = settleIntentRequest(s, second.tag, { kind: "intent", clientSecret: "sec_2", paymentIntentId: "pi_second_00000002", quoteId: "q_2" }).session;
    expect(liveClientSecret(s, KEY_B)).toBe("sec_2");
    // then the stale first reply
    const late = settleIntentRequest(s, first.tag, { kind: "intent", clientSecret: "sec_1", paymentIntentId: "pi_first_000000001", quoteId: "q_1" });
    expect(late.stale).toBe(true);
    expect(liveClientSecret(late.session, KEY_B)).toBe("sec_2");
    expect(late.session.quoteId).toBe("q_2");
    // the stale first intent is queued for cancellation on any later create
    expect(late.session.supersededPaymentIntentId).toBe("pi_first_000000001");
  });

  it("current-generation success clears the queued cancellation (it was sent with this request)", () => {
    let s: S = applyInputKey(liveSession(), KEY_B).session;
    const b = beginIntentRequest(s);
    expect(b.tag.supersedesPaymentIntentId).toBe("pi_live_0000000001");
    s = settleIntentRequest(b.session, b.tag, { kind: "intent", clientSecret: "sec", paymentIntentId: "pi_new_00000000002", quoteId: "q" }).session;
    expect(s).toMatchObject({ intentKey: KEY_B, clientSecret: "sec", paymentIntentId: "pi_new_00000000002", quoteId: "q", inFlight: null, supersededPaymentIntentId: null });
    expect(liveClientSecret(s, KEY_B)).toBe("sec");
  });
});

describe("canCreateIntent gating", () => {
  it("requires complete inputs, an applied fingerprint, no live intent, nothing in flight, no revision awaiting review", () => {
    const s0 = initialPaymentIntentSession<Rev>();
    expect(canCreateIntent(s0, true)).toBe(false); // no fingerprint yet
    const armed = applyInputKey(s0, KEY_A).session;
    expect(canCreateIntent(armed, false)).toBe(false);
    expect(canCreateIntent(armed, true)).toBe(true);
    expect(canCreateIntent(beginIntentRequest(armed).session, true)).toBe(false);
    expect(canCreateIntent(liveSession(), true)).toBe(false);
    const parked = withPendingRevision(armed, { total: 1, retry: "embedded" });
    expect(canCreateIntent(parked, true)).toBe(false);
    expect(canCreateIntent(acceptPendingRevision(parked), true)).toBe(true);
  });
});

describe("classifyIntentResponse / runIntentRequest", () => {
  it("classifies success, totals_changed and failures; the human detail is preferred for errors", () => {
    expect(classifyIntentResponse(200, true, { ok: true, clientSecret: "cs", paymentIntentId: "pi_x", quoteId: "q" })).toEqual({ kind: "intent", clientSecret: "cs", paymentIntentId: "pi_x", quoteId: "q" });
    expect(classifyIntentResponse(409, false, { ok: false, error: "totals_changed", revised: { total: 5 } })).toEqual({ kind: "revision", revised: { total: 5 } });
    expect(classifyIntentResponse(409, false, { ok: false, error: "totals_internal_mismatch", detail: "Please refresh" })).toEqual({ kind: "error", message: "Please refresh", code: "totals_internal_mismatch", httpStatus: 409 });
    expect(classifyIntentResponse(200, true, { ok: true })).toMatchObject({ kind: "error", code: "payment_intent_failed" }); // no secret = not a success
    expect(classifyIntentResponse(500, false, null)).toMatchObject({ kind: "error", code: "payment_intent_failed", httpStatus: 500 });
  });

  it("a rejected fetch becomes an error outcome (never throws), and it is still generation-gated", async () => {
    const { fetchImpl, reject } = deferredFetch();
    const p = runIntentRequest<Rev>(fetchImpl, {});
    reject(new Error("network down"));
    const outcome = await p;
    expect(outcome).toEqual({ kind: "error", message: "network down", code: "payment_intent_exception" });
    let s: S = applyInputKey(initialPaymentIntentSession<Rev>(), KEY_A).session;
    const b = beginIntentRequest(s);
    s = applyInputKey(b.session, KEY_B).session;
    expect(settleIntentRequest(s, b.tag, outcome).session.error).toBeNull();
    const cur = beginIntentRequest(s);
    expect(settleIntentRequest(cur.session, cur.tag, outcome).session).toMatchObject({ error: "network down", inFlight: null });
  });

  it("posts JSON to the create-payment-intent route with the given body", async () => {
    const fetchImpl = jest.fn(async () => okBody("pi_ok_000000000001"));
    await runIntentRequest<Rev>(fetchImpl, { cartId: "c1", supersedesPaymentIntentId: "pi_old_00000000001" });
    expect(fetchImpl).toHaveBeenCalledWith("/api/stripe/create-payment-intent", expect.objectContaining({ method: "POST", body: JSON.stringify({ cartId: "c1", supersedesPaymentIntentId: "pi_old_00000000001" }) }));
  });
});

describe("fingerprint covers the reviewed inputs", () => {
  const base = {
    items: [{ type: "tire", sku: "T1", quantity: 4, unitPrice: 150 }],
    shipping: { address: "1 Main St", city: "Pontiac", state: "MI", zip: "48340", email: "t@example.com" },
    isLocal: true, selectedStore: "pontiac", discountCode: null,
    vehicle: { year: "2024", make: "Ford", model: "F-150", trim: "XLT" },
    displayedTotal: 712.4,
  };
  it("vehicle, fulfillment mode/store and displayed total each change the key; vehicle case/whitespace do not", () => {
    const a = paymentIntentInputKey(base);
    expect(paymentIntentInputKey({ ...base, vehicle: { ...base.vehicle, trim: "Lariat" } })).not.toBe(a);
    expect(paymentIntentInputKey({ ...base, vehicle: { ...base.vehicle, year: "2023" } })).not.toBe(a);
    expect(paymentIntentInputKey({ ...base, vehicle: null })).not.toBe(a);
    expect(paymentIntentInputKey({ ...base, selectedStore: "waterford" })).not.toBe(a);
    expect(paymentIntentInputKey({ ...base, isLocal: false, selectedStore: null })).not.toBe(a);
    expect(paymentIntentInputKey({ ...base, displayedTotal: 712.41 })).not.toBe(a);
    expect(paymentIntentInputKey({ ...base, vehicle: { year: 2024, make: " ford ", model: "f-150", trim: "xlt" } })).toBe(a);
    expect(paymentIntentInputKey({ ...base, displayedTotal: 712.4000001 })).toBe(a);
  });
});
