/**
 * @jest-environment node
 *
 * Stripe webhook fulfilment guard (Codex review 2026-09-20, stale PaymentIntent invalidation).
 * Everything external is mocked: Stripe (constructEvent returns the event verbatim), DB pool,
 * quotes, orders, email, supplier orders. No network, no Stripe, no Postgres.
 */
jest.mock("next/headers", () => ({ headers: jest.fn(async () => new Headers({ "stripe-signature": "sig_test" })) }));
jest.mock("@/lib/quotes", () => ({ getPool: jest.fn(() => ({})), getQuote: jest.fn() }));
jest.mock("@/lib/payments/stripeClient", () => ({ getStripeClient: jest.fn() }));
jest.mock("@/lib/orders", () => ({
  createOrder: jest.fn(async () => ({ id: "ORD-TEST" })),
  getOrderByStripeSession: jest.fn(async () => null),
  getOrderByPaymentIntent: jest.fn(async () => null),
  getOrderByQuote: jest.fn(async () => null),
  markOrderEmailSent: jest.fn(async () => undefined),
}));
jest.mock("@/lib/email", () => ({ sendOrderConfirmationEmail: jest.fn(async () => ({ ok: true })) }));
jest.mock("@/lib/cart/cartAddEventService", () => ({ markCartEventsPurchased: jest.fn(async () => undefined) }));
jest.mock("@/lib/cart/abandonedCartService", () => ({ markCartRecovered: jest.fn(async () => undefined) }));
jest.mock("@/lib/checkout/diagnosticsServer", () => ({ logCheckoutDiagnosticServer: jest.fn(async () => undefined) }));
jest.mock("@/lib/suppliers/supplierOrderService", () => ({ processSupplierOrders: jest.fn(async () => ({ placed: [] })) }));
jest.mock("@/lib/savedQuotes/checkoutIntegration", () => ({ markSavedQuoteConverted: jest.fn(async () => ({ ok: true })) }));
jest.mock("@/lib/fitment-api/billing", () => ({
  FITMENT_API_PRODUCT_TAG: "fitment_api",
  handleFitmentApiCheckoutCompleted: jest.fn(),
  handleFitmentApiSubscriptionUpdated: jest.fn(),
  handleFitmentApiSubscriptionDeleted: jest.fn(),
  handleFitmentApiInvoicePaymentFailed: jest.fn(),
}));

import { POST } from "@/app/api/stripe/webhook/route";
import { getQuote } from "@/lib/quotes";
import { getStripeClient } from "@/lib/payments/stripeClient";
import { createOrder } from "@/lib/orders";
import { logCheckoutDiagnosticServer } from "@/lib/checkout/diagnosticsServer";

const quoteGet = getQuote as jest.Mock;
const stripeClient = getStripeClient as jest.Mock;
const orderCreate = createOrder as jest.Mock;
const diag = logCheckoutDiagnosticServer as jest.Mock;

const EXPECTED = 140259; // 1363.06 + CO tax 39.53, free shipping
const snapshot = (expectedChargeCents?: number) => ({
  customer: { firstName: "Test", lastName: "Buyer", email: "t@example.com" },
  lines: [],
  taxRate: 0,
  totals: { partsSubtotal: 1363.06, servicesSubtotal: 0, tax: 0, total: 1363.06 },
  ...(expectedChargeCents != null ? { expectedChargeCents } : {}),
});

function event(type: string, object: Record<string, unknown>) {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
    body: JSON.stringify({ id: "evt_test", type, data: { object } }),
  });
}
const piSucceeded = (amount: number) => event("payment_intent.succeeded", { id: "pi_test", amount, metadata: { quoteId: "Q1", cartId: "cart-abc" }, receipt_email: "t@example.com" });
const sessionCompleted = (amount_total: number) => event("checkout.session.completed", { id: "cs_test", amount_total, payment_intent: "pi_test", metadata: { quoteId: "Q1", cartId: "cart-abc" }, customer_email: "t@example.com" });

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  stripeClient.mockReset().mockResolvedValue({
    mode: "test",
    stripe: { webhooks: { constructEvent: (body: string) => JSON.parse(body) } },
  });
  quoteGet.mockReset().mockResolvedValue({ id: "Q1", snapshot: snapshot(EXPECTED) });
  orderCreate.mockClear();
  diag.mockClear();
});
afterEach(() => jest.restoreAllMocks());

describe("stripe webhook - fulfil only the charge the quote was created for", () => {
  it("payment_intent.succeeded with the recorded amount -> order created for that amount", async () => {
    const res = await POST(piSucceeded(EXPECTED));
    expect(res.status).toBe(200);
    expect(orderCreate).toHaveBeenCalledTimes(1);
    expect(orderCreate.mock.calls[0][1]).toMatchObject({ quoteId: "Q1", stripePaymentIntentId: "pi_test", amountPaidCents: EXPECTED });
  });

  it("NEGATIVE: payment_intent.succeeded for a different amount (stale/duplicated intent) -> 400 paid_amount_mismatch, NO order", async () => {
    for (const paid of [EXPECTED - 1, EXPECTED + 1, 136306, 0, 50]) {
      const res = await POST(piSucceeded(paid));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("paid_amount_mismatch");
    }
    expect(orderCreate).not.toHaveBeenCalled();
    expect(diag).toHaveBeenCalledTimes(5);
    expect(diag.mock.calls[0][0]).toMatchObject({ errorCode: "paid_amount_mismatch", cartId: "cart-abc", detail: { quoteId: "Q1", expectedCents: EXPECTED, paidCents: EXPECTED - 1 } });
  });

  it("checkout.session.completed with the recorded amount_total -> order created", async () => {
    const res = await POST(sessionCompleted(EXPECTED));
    expect(res.status).toBe(200);
    expect(orderCreate).toHaveBeenCalledTimes(1);
    expect(orderCreate.mock.calls[0][1]).toMatchObject({ quoteId: "Q1", stripeSessionId: "cs_test", amountPaidCents: EXPECTED });
  });

  it("NEGATIVE: checkout.session.completed with a different amount_total -> 400 paid_amount_mismatch, NO order", async () => {
    const res = await POST(sessionCompleted(EXPECTED - 13631));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("paid_amount_mismatch");
    expect(orderCreate).not.toHaveBeenCalled();
    expect(diag.mock.calls[0][0]).toMatchObject({ endpoint: "stripe_webhook:checkout.session.completed", errorCode: "paid_amount_mismatch" });
  });

  it("quotes written before expectedChargeCents existed are not blocked (legacy compatibility)", async () => {
    quoteGet.mockResolvedValue({ id: "Q1", snapshot: snapshot(undefined) });
    const res = await POST(piSucceeded(999));
    expect(res.status).toBe(200);
    expect(orderCreate).toHaveBeenCalledTimes(1);
  });

  it("missing amount on the event is a mismatch, not a free pass", async () => {
    const res = await POST(event("payment_intent.succeeded", { id: "pi_test", metadata: { quoteId: "Q1" } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("paid_amount_mismatch");
    expect(orderCreate).not.toHaveBeenCalled();
  });
});
