/**
 * /api/stripe/create-payment-intent charges ONLY server totals (Codex release review 2026-09-20).
 *
 * Everything external is mocked: catalog pricing (buildCheckoutLines), DB pool + createQuote,
 * Stripe client, availability, saved-quote validation, USAF branch selection, discount tables,
 * state tax table, FedEx. No network, no Stripe, no DB.
 */
jest.mock("@/lib/checkout/buildCheckoutLines", () => ({ buildCheckoutLines: jest.fn() }));
jest.mock("@/lib/checkout/repriceCatalog", () => ({ defaultCatalogPriceResolver: jest.fn() }));
jest.mock("@/lib/checkout/hardwareSpec", () => ({ defaultHardwareSpecResolver: jest.fn() }));
jest.mock("@/lib/quotes", () => ({ getPool: jest.fn(() => ({})), createQuote: jest.fn(async () => ({ id: "Q-TEST" })) }));
jest.mock("@/lib/payments/stripeClient", () => ({ getStripeClient: jest.fn() }));
jest.mock("@/lib/availabilityCache", () => ({ fetchAvailability: jest.fn(async () => ({ ok: true })), ORDERABLE_TYPES: new Set(["wheel"]) }));
jest.mock("@/lib/supplierCredentialsSecure", () => ({ getSupplierCredentials: jest.fn(async () => null) }));
jest.mock("@/lib/wheelpros/upstreamBase", () => ({ sanitizeUpstreamBase: jest.fn(() => "") }));
jest.mock("@/lib/savedQuotes/checkoutIntegration", () => ({ validateSavedQuoteOwnership: jest.fn(async () => ({ valid: false })) }));
jest.mock("@/lib/usautoforce/branchSelector", () => ({ selectUsafBranchForCartLines: jest.fn(async () => null) }));
jest.mock("@/lib/shopContext", () => ({
  detectShopContext: jest.fn(() => ({ mode: "national" })),
  buildLocalOrderMetadata: jest.fn(() => ({})),
  STORES: {},
}));
jest.mock("@/lib/tax/stateTaxRates", () => ({ getStateTaxRate: jest.fn(async () => 0.06) }));
jest.mock("@/lib/shipping/fedexRates", () => {
  const actual = jest.requireActual("@/lib/shipping/fedexRates");
  return { ...actual, getFedExShippingRate: jest.fn(async () => ({ success: false, groundRate: null })) };
});
jest.mock("@/lib/discounts/firstOrderService", () => ({ validateDiscount: jest.fn(async () => ({ valid: false })) }));
jest.mock("@/lib/discounts/campaignDiscountService", () => ({ validateCampaignDiscount: jest.fn(async () => ({ valid: false })) }));

import { POST } from "@/app/api/stripe/create-payment-intent/route";
import { buildCheckoutLines } from "@/lib/checkout/buildCheckoutLines";
import { createQuote } from "@/lib/quotes";
import { getStripeClient } from "@/lib/payments/stripeClient";
import { validateDiscount } from "@/lib/discounts/firstOrderService";
import { calculateShipping } from "@/lib/shipping/shippingService";

const built = buildCheckoutLines as jest.Mock;
const stripeClient = getStripeClient as jest.Mock;
const quote = createQuote as jest.Mock;
const firstOrder = validateDiscount as jest.Mock;

const piCreate = jest.fn(async (params: any) => ({ id: "pi_test", client_secret: "cs_test", amount: params.amount }));

const ridlerLines = [
  { kind: "product", name: "RIDLER 652 (front)", sku: "652-2865GBD", unitPriceUsd: 336.12, qty: 2, taxable: true, meta: { cartType: "wheel", priceSource: "wheelpros", axle: "front" } },
  { kind: "product", name: "RIDLER 652 (rear)", sku: "652-2165GBD", unitPriceUsd: 345.41, qty: 2, taxable: true, meta: { cartType: "wheel", priceSource: "wheelpros", axle: "rear" } },
];
const cartItems = [{ id: "w1", type: "wheel", sku: "652-2865GBD", rearSku: "652-2165GBD", quantity: 4, unitPrice: 340.77, staggered: true }];

function req(body: Record<string, unknown>) {
  return new Request("http://localhost/api/stripe/create-payment-intent", {
    method: "POST",
    headers: { "content-type": "application/json", host: "shop.warehousetiredirect.com" },
    body: JSON.stringify({
      items: cartItems,
      customer: { firstName: "Test", lastName: "Buyer", email: "t@example.com" },
      shipping: { address: "1 Main St", city: "Pontiac", state: "MI", zip: "48340", amount: 0, isFree: true },
      tax: { amount: 0, rate: 0, state: "MI" },
      ...body,
    }),
  });
}

// what the server will compute for this cart: 1363.06 + 6% MI tax (81.78) + zone shipping
const zoneShipping = calculateShipping({
  zipCode: "48340",
  items: [{ type: "wheel", quantity: 2, unitPrice: 336.12 }, { type: "wheel", quantity: 2, unitPrice: 345.41 }],
  subtotal: 1363.06,
}).amount;
const serverTotal = Math.round((1363.06 + 81.78 + zoneShipping) * 100) / 100;

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  built.mockReset().mockResolvedValue({ ok: true, lines: ridlerLines, repriced: [] });
  stripeClient.mockReset().mockResolvedValue({ mode: "test", stripe: { paymentIntents: { create: piCreate } } });
  quote.mockClear();
  piCreate.mockClear();
  firstOrder.mockReset().mockResolvedValue({ valid: false });
});
afterEach(() => jest.restoreAllMocks());

describe("create-payment-intent - server totals authority", () => {
  it("REGRESSION: client tax $0 + shipping isFree with a matching expectedTotal -> 409 totals_changed, nothing created", async () => {
    // Client shows 1363.06 (no tax, free shipping) - the server disagrees.
    const res = await POST(req({ expectedTotal: 1363.06 }));
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error).toBe("totals_changed");
    expect(json.revised.total).toBe(serverTotal);
    expect(json.revised.tax).toBe(81.78);
    expect(json.revised.shipping).toBe(zoneShipping);
    expect(json.detail).toContain("$1363.06");
    expect(json.detail).toContain(`$${serverTotal.toFixed(2)}`);
    expect(quote).not.toHaveBeenCalled();
    expect(piCreate).not.toHaveBeenCalled();
  });

  it("accepted revised total -> PaymentIntent amount == server total in cents, quote lines carry server tax + shipping", async () => {
    const res = await POST(req({ expectedTotal: serverTotal }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(piCreate).toHaveBeenCalledTimes(1);
    expect(piCreate.mock.calls[0][0].amount).toBe(Math.round(serverTotal * 100));
    expect(piCreate.mock.calls[0][0].metadata.serverTotal).toBe(serverTotal.toFixed(2));
    expect(piCreate.mock.calls[0][0].metadata.taxAmount).toBe("81.78");
    const lines = quote.mock.calls[0][1].lines as Array<{ name: string; unitPriceUsd: number }>;
    expect(lines.find((l) => l.name.startsWith("Sales Tax"))?.unitPriceUsd).toBe(81.78);
    expect(lines.find((l) => l.name === "Shipping & Handling")?.unitPriceUsd).toBe(zoneShipping);
  });

  it("legacy client (no expectedTotal): server totals are charged, client amounts ignored", async () => {
    const res = await POST(req({ tax: { amount: 1, state: "MI" }, shipping: { address: "1 Main St", city: "Pontiac", state: "MI", zip: "48340", amount: 1 } }));
    expect(res.status).toBe(200);
    expect(piCreate.mock.calls[0][0].amount).toBe(Math.round(serverTotal * 100));
  });

  it("valid discount is validated server-side and taken off the charge (was metadata-only before)", async () => {
    firstOrder.mockResolvedValue({ valid: true, discountPercent: 10 });
    const discounted = Math.round((serverTotal - 136.31) * 100) / 100;
    const res = await POST(req({ expectedTotal: discounted, discount: { code: "welcome10", amount: 500, type: "first_order" } }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(piCreate.mock.calls[0][0].amount).toBe(Math.round(discounted * 100));
    expect(piCreate.mock.calls[0][0].metadata.discountAmount).toBe("136.31");
    expect(quote.mock.calls[0][1].discount).toEqual({ code: "WELCOME10", amount: 136.31, type: "first_order" });
  });

  it("rejected discount -> 409 totals_changed with discountRejected; no quote, no PaymentIntent", async () => {
    firstOrder.mockResolvedValue({ valid: false, alreadyRedeemed: true });
    const res = await POST(req({ expectedTotal: serverTotal, discount: { code: "USED", amount: 136.31 } }));
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error).toBe("totals_changed");
    expect(json.revised.discountRejected).toEqual({ code: "USED", reason: "already_redeemed" });
    expect(json.revised.total).toBe(serverTotal);
    expect(json.detail).toMatch(/already been used/);
    expect(quote).not.toHaveBeenCalled();
    expect(piCreate).not.toHaveBeenCalled();
  });

  it("heavy tires with no live FedEx rate -> 409 shipping_unavailable (client 'Call for Quote' $0 is not payable)", async () => {
    built.mockResolvedValue({
      ok: true, repriced: [],
      lines: [{ kind: "product", name: "LT285/70R17 Tire", sku: "LT1", unitPriceUsd: 320, qty: 4, taxable: true, meta: { cartType: "tire", priceSource: "tireweb", tireSize: "LT285/70R17" } }],
    });
    const res = await POST(req({ expectedTotal: 1356.8 }));
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error).toBe("shipping_unavailable");
    expect(json.detail).toMatch(/call/i);
    expect(quote).not.toHaveBeenCalled();
    expect(piCreate).not.toHaveBeenCalled();
  });

  it("national order with an invalid ZIP is refused before anything is created", async () => {
    const res = await POST(req({ shipping: { address: "1 Main St", city: "X", state: "MI", zip: "1234" } }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("invalid_shipping_zip");
    expect(piCreate).not.toHaveBeenCalled();
  });
});
