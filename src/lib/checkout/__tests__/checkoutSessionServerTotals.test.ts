/**
 * /api/stripe/create-checkout-session (hosted Checkout) charges ONLY server totals
 * (Codex release review 2026-09-20, second pass: both Stripe routes must be covered).
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
jest.mock("@/lib/shopContext", () => {
  const actual = jest.requireActual("@/lib/shopContext");
  return { ...actual, detectShopContext: jest.fn(() => ({ mode: "national" })), buildLocalOrderMetadata: jest.fn(() => ({})) };
});
jest.mock("@/lib/tax/stateTaxRates", () => {
  const actual = jest.requireActual("@/lib/tax/stateTaxRates");
  return {
    DEFAULT_STATE_TAX_RATES: actual.DEFAULT_STATE_TAX_RATES,
    getStateTaxRate: jest.fn(async (_db: unknown, s: string) => (s === "MI" ? 0.06 : s === "TX" ? 0.0625 : 0)),
  };
});
jest.mock("@/lib/shipping/fedexRates", () => {
  const actual = jest.requireActual("@/lib/shipping/fedexRates");
  return { ...actual, getFedExShippingRate: jest.fn(async () => ({ success: false, groundRate: null })) };
});
jest.mock("@/lib/discounts/firstOrderService", () => ({ validateDiscount: jest.fn(async () => ({ valid: false })) }));
jest.mock("@/lib/discounts/campaignDiscountService", () => ({ validateCampaignDiscount: jest.fn(async () => ({ valid: false })) }));

import { POST } from "@/app/api/stripe/create-checkout-session/route";
import { buildCheckoutLines } from "@/lib/checkout/buildCheckoutLines";
import { createQuote } from "@/lib/quotes";
import { getStripeClient } from "@/lib/payments/stripeClient";
import { getStateTaxRate } from "@/lib/tax/stateTaxRates";
import { detectShopContext } from "@/lib/shopContext";
import { validateDiscount } from "@/lib/discounts/firstOrderService";
import { calculateShipping } from "@/lib/shipping/shippingService";

const built = buildCheckoutLines as jest.Mock;
const stripeClient = getStripeClient as jest.Mock;
const quote = createQuote as jest.Mock;
const taxRate = getStateTaxRate as jest.Mock;
const shopContext = detectShopContext as jest.Mock;
const firstOrder = validateDiscount as jest.Mock;

const sessionCreate = jest.fn(async (_params: any) => ({ id: "cs_test", url: "https://checkout.stripe.test/cs_test" }));
const couponCreate = jest.fn(async (_params: any) => ({ id: "coupon_test" }));

const ridlerLines = [
  { kind: "product", name: "RIDLER 652 (front)", sku: "652-2865GBD", unitPriceUsd: 336.12, qty: 2, taxable: true, meta: { cartType: "wheel", priceSource: "wheelpros", axle: "front" } },
  { kind: "product", name: "RIDLER 652 (rear)", sku: "652-2165GBD", unitPriceUsd: 345.41, qty: 2, taxable: true, meta: { cartType: "wheel", priceSource: "wheelpros", axle: "rear" } },
];
const cartItems = [{ id: "w1", type: "wheel", sku: "652-2865GBD", rearSku: "652-2165GBD", quantity: 4, unitPrice: 340.77, staggered: true }];

function req(body: Record<string, unknown>, host = "shop.warehousetiredirect.com") {
  return new Request("http://localhost/api/stripe/create-checkout-session", {
    method: "POST",
    headers: { "content-type": "application/json", host },
    body: JSON.stringify({
      items: cartItems,
      customer: { firstName: "Test", lastName: "Buyer", email: "t@example.com" },
      shipping: { address: "1 Main St", city: "Pontiac", state: "MI", zip: "48340", amount: 0, isFree: true },
      tax: { amount: 0, rate: 0, state: "MI" },
      ...body,
    }),
  });
}

/** Sum of hosted-Checkout line items in cents (what Stripe would actually charge before coupons). */
function chargedCents(params: any): number {
  return (params.line_items as Array<{ quantity: number; price_data: { unit_amount: number } }>)
    .reduce((sum, li) => sum + li.price_data.unit_amount * li.quantity, 0);
}

// what the server will compute for this cart nationally: 1363.06 + 6% MI tax (81.78) + zone shipping
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
  stripeClient.mockReset().mockResolvedValue({
    mode: "test",
    stripe: { checkout: { sessions: { create: sessionCreate } }, coupons: { create: couponCreate } },
  });
  shopContext.mockReset().mockReturnValue({ mode: "national" });
  quote.mockClear();
  taxRate.mockClear();
  sessionCreate.mockClear();
  couponCreate.mockClear();
  firstOrder.mockReset().mockResolvedValue({ valid: false });
});
afterEach(() => jest.restoreAllMocks());

function expectNothingCreated() {
  expect(quote).not.toHaveBeenCalled();
  expect(sessionCreate).not.toHaveBeenCalled();
  expect(couponCreate).not.toHaveBeenCalled();
}

describe("create-checkout-session - server totals authority", () => {
  it("REGRESSION: client tax $0 + shipping isFree with a matching expectedTotal -> 409 totals_changed, nothing created", async () => {
    const res = await POST(req({ expectedTotal: 1363.06 }));
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error).toBe("totals_changed");
    expect(json.revised.total).toBe(serverTotal);
    expect(json.revised.tax).toBe(81.78);
    expect(json.revised.taxState).toBe("MI");
    expect(json.revised.shipping).toBe(zoneShipping);
    expect(json.detail).toContain("$1363.06");
    expect(json.detail).toContain(`$${serverTotal.toFixed(2)}`);
    expectNothingCreated();
  });

  it("accepted revised total -> hosted Checkout line items sum to the server total; quote carries server tax + shipping", async () => {
    const res = await POST(req({ expectedTotal: serverTotal }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.url).toBe("https://checkout.stripe.test/cs_test");
    expect(sessionCreate).toHaveBeenCalledTimes(1);
    const params = sessionCreate.mock.calls[0][0];
    expect(chargedCents(params)).toBe(Math.round(serverTotal * 100));
    expect(params.discounts).toBeUndefined();
    expect(params.metadata.serverTotal).toBe(serverTotal.toFixed(2));
    expect(params.metadata.taxState).toBe("MI");
    expect(params.metadata.taxAmount).toBe("81.78");
    expect(params.metadata.shippingAmount).toBe(zoneShipping.toFixed(2));
    const lines = quote.mock.calls[0][1].lines as Array<{ name: string; unitPriceUsd: number }>;
    expect(lines.find((l) => l.name.startsWith("Sales Tax"))?.unitPriceUsd).toBe(81.78);
    expect(lines.find((l) => l.name === "Shipping & Handling")?.unitPriceUsd).toBe(zoneShipping);
  });

  it("NEGATIVE: legacy/tampered client without a valid expectedTotal -> 409 review, never a silent charge", async () => {
    for (const expectedTotal of [undefined, null, "", "abc", -1, NaN, Infinity, true, [], {}]) {
      const res = await POST(req({ expectedTotal, tax: { amount: 1, state: "MI" } }));
      const json = await res.json();
      expect(res.status).toBe(409);
      expect(json.error).toBe("totals_changed");
      expect(json.revised.total).toBe(serverTotal);
      expect(json.revised.expectedTotal).toBeNull();
      expect(json.detail).toContain(`$${serverTotal.toFixed(2)}`);
    }
    expectNothingCreated();
  });

  it("NEGATIVE: expectedTotal off by one cent -> 409 review (no float slack)", async () => {
    const res = await POST(req({ expectedTotal: Math.round((serverTotal - 0.01) * 100) / 100 }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("totals_changed");
    expectNothingCreated();
  });

  it("NEGATIVE: client tax.state is ignored - jurisdiction is the ship-to address (MI); a TX claim changes nothing", async () => {
    const res = await POST(req({ expectedTotal: serverTotal, tax: { amount: 85.19, rate: 0.0625, state: "TX" } }));
    expect(res.status).toBe(200);
    const params = sessionCreate.mock.calls[0][0];
    expect(chargedCents(params)).toBe(Math.round(serverTotal * 100));
    expect(params.metadata.taxState).toBe("MI");
    expect(params.metadata.taxAmount).toBe("81.78");
    expect(taxRate).toHaveBeenCalledWith(expect.anything(), "MI");
    expect(taxRate).not.toHaveBeenCalledWith(expect.anything(), "TX");
  });

  it("NEGATIVE: client tax.state missing / rate 0 with a valid MI ship-to -> MI tax still charged", async () => {
    const res = await POST(req({ expectedTotal: serverTotal, tax: {} }));
    expect(res.status).toBe(200);
    const params = sessionCreate.mock.calls[0][0];
    expect(params.metadata.taxState).toBe("MI");
    expect(params.metadata.taxAmount).toBe("81.78");
    expect(chargedCents(params)).toBe(Math.round(serverTotal * 100));
  });

  it("NEGATIVE: ship-to address without a valid state -> 409 invalid_shipping_address, not a $0-tax charge", async () => {
    for (const state of [undefined, "", "  ", "ZZ", "Michigan", "M1", 12, null]) {
      const res = await POST(
        req({ expectedTotal: 1363.06, tax: { amount: 0, state: "MI" }, shipping: { address: "1 Main St", city: "Pontiac", state, zip: "48340" } }),
      );
      expect(res.status).toBe(409);
      expect((await res.json()).error).toBe("invalid_shipping_address");
    }
    expect(taxRate).not.toHaveBeenCalled();
    expectNothingCreated();
  });

  it("NEGATIVE: ship-to state conflicts with the client tax claim -> ship-to wins (OR ship-to, TX claim -> $0 OR tax from the table)", async () => {
    // Oregon has no sales tax in DEFAULT_STATE_TAX_RATES; the mock returns 0 for anything but MI/TX.
    const orTotal = Math.round((1363.06 + zoneShipping) * 100) / 100;
    const res = await POST(
      req({
        expectedTotal: orTotal,
        tax: { amount: 85.19, rate: 0.0625, state: "TX" },
        shipping: { address: "1 Main St", city: "Portland", state: "or", zip: "48340", amount: 0, isFree: true },
      }),
    );
    expect(res.status).toBe(200);
    const params = sessionCreate.mock.calls[0][0];
    expect(params.metadata.taxState).toBe("OR");
    expect(params.metadata.taxAmount).toBeUndefined();
    expect(chargedCents(params)).toBe(Math.round(orTotal * 100));
    expect(taxRate).toHaveBeenCalledWith(expect.anything(), "OR");
    expect(taxRate).not.toHaveBeenCalledWith(expect.anything(), "TX");
  });

  it("LOCAL: jurisdiction is the install store (MI), not the client tax claim; no state-table lookup", async () => {
    shopContext.mockReturnValue({ mode: "local" });
    // First call reveals the server total for a local install order (shipping is not a ship-to lane).
    const probe = await POST(req({ installStore: "pontiac", tax: { amount: 999, rate: 0.5, state: "TX" }, shipping: {} }, "shop.warehousetire.net"));
    expect(probe.status).toBe(409);
    const revised = (await probe.json()).revised;
    expect(revised.taxState).toBe("MI");
    expect(revised.tax).toBe(81.78);
    expect(revised.shipping).toBe(0);
    expectNothingCreated();

    const res = await POST(req({ installStore: "pontiac", expectedTotal: revised.total, tax: { amount: 999, rate: 0.5, state: "TX" }, shipping: {} }, "shop.warehousetire.net"));
    expect(res.status).toBe(200);
    const params = sessionCreate.mock.calls[0][0];
    expect(params.metadata.taxState).toBe("MI");
    expect(params.metadata.taxAmount).toBe("81.78");
    expect(params.metadata.install_store).toBe("pontiac");
    expect(chargedCents(params)).toBe(Math.round(revised.total * 100));
    expect(taxRate).not.toHaveBeenCalled();
  });

  it("LOCAL: missing/invalid client tax state never yields $0 tax - store state applies", async () => {
    shopContext.mockReturnValue({ mode: "local" });
    for (const tax of [undefined, {}, { state: "" }, { state: "ZZ", amount: 0 }]) {
      const res = await POST(req({ installStore: "waterford", tax, shipping: {} }, "shop.warehousetire.net"));
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toBe("totals_changed");
      expect(json.revised.taxState).toBe("MI");
      expect(json.revised.tax).toBe(81.78);
    }
    expectNothingCreated();
  });

  it("valid discount is validated server-side and applied as a one-off amount_off coupon; net equals the reviewed total", async () => {
    firstOrder.mockResolvedValue({ valid: true, discountPercent: 10 });
    const discounted = Math.round((serverTotal - 136.31) * 100) / 100;
    const res = await POST(req({ expectedTotal: discounted, discount: { code: "welcome10", amount: 500, type: "first_order" } }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(couponCreate).toHaveBeenCalledTimes(1);
    expect(couponCreate.mock.calls[0][0]).toMatchObject({ amount_off: 13631, currency: "usd", duration: "once" });
    const params = sessionCreate.mock.calls[0][0];
    expect(params.discounts).toEqual([{ coupon: "coupon_test" }]);
    expect(chargedCents(params) - 13631).toBe(Math.round(discounted * 100));
    expect(params.metadata.discountAmount).toBe("136.31");
    expect(quote.mock.calls[0][1].discount).toEqual({ code: "WELCOME10", amount: 136.31, type: "first_order" });
  });

  it("rejected discount -> 409 totals_changed with discountRejected; no quote, no session, no coupon", async () => {
    firstOrder.mockResolvedValue({ valid: false, alreadyRedeemed: true });
    const res = await POST(req({ expectedTotal: serverTotal, discount: { code: "USED", amount: 136.31 } }));
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.error).toBe("totals_changed");
    expect(json.revised.discountRejected).toEqual({ code: "USED", reason: "already_redeemed" });
    expect(json.revised.total).toBe(serverTotal);
    expectNothingCreated();
  });

  it("heavy tires with no live FedEx rate -> 409 shipping_unavailable", async () => {
    built.mockResolvedValue({
      ok: true, repriced: [],
      lines: [{ kind: "product", name: "LT285/70R17 Tire", sku: "LT1", unitPriceUsd: 320, qty: 4, taxable: true, meta: { cartType: "tire", priceSource: "tireweb", tireSize: "LT285/70R17" } }],
    });
    const res = await POST(req({ expectedTotal: 1356.8 }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("shipping_unavailable");
    expectNothingCreated();
  });

  it("national order with an invalid ZIP is refused before anything is created", async () => {
    const res = await POST(req({ expectedTotal: serverTotal, shipping: { address: "1 Main St", city: "X", state: "MI", zip: "1234" } }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("invalid_shipping_zip");
    expectNothingCreated();
  });
});
