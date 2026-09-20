/**
 * Server-authoritative totals (Codex release review 2026-09-20).
 *
 * Both Stripe routes used to charge the client-sent tax / shipping / local fees and never
 * took the discount off the charge. These tests pin the rules the server now applies from
 * its own priced lines, and that a differing or discount-rejected total is sent back for
 * review instead of being charged. Everything external (state tax table, FedEx, discount
 * tables) is mocked - no DB, no Stripe, no network.
 */
import type { QuoteLine } from "@/lib/quotes";

jest.mock("@/lib/tax/stateTaxRates", () => {
  const actual = jest.requireActual("@/lib/tax/stateTaxRates");
  return {
    DEFAULT_STATE_TAX_RATES: actual.DEFAULT_STATE_TAX_RATES, // real jurisdiction list (50 + DC)
    getStateTaxRate: jest.fn(async (_db: unknown, state: string) => (state === "MI" ? 0.06 : state === "TX" ? 0.0625 : 0)),
  };
});
jest.mock("@/lib/shipping/fedexRates", () => {
  const actual = jest.requireActual("@/lib/shipping/fedexRates");
  return { ...actual, getFedExShippingRate: jest.fn() };
});
jest.mock("@/lib/discounts/firstOrderService", () => ({ validateDiscount: jest.fn() }));
jest.mock("@/lib/discounts/campaignDiscountService", () => ({ validateCampaignDiscount: jest.fn() }));

import { getStateTaxRate } from "@/lib/tax/stateTaxRates";
import { getFedExShippingRate } from "@/lib/shipping/fedexRates";
import { validateDiscount } from "@/lib/discounts/firstOrderService";
import { validateCampaignDiscount } from "@/lib/discounts/campaignDiscountService";
import {
  computeLocalServiceFees,
  needsTotalsReview,
  resolveServerTotals,
  revisedTotalsPayload,
  shippingInputsFromLines,
  totalsReviewDetail,
  totalsToQuoteLines,
} from "@/lib/checkout/orderTotals";

const fedex = getFedExShippingRate as jest.Mock;
const firstOrder = validateDiscount as jest.Mock;
const campaign = validateCampaignDiscount as jest.Mock;
const db = {} as any;

const wheelLine = (sku: string, unit: number, qty: number, priceSource = "wheelpros", extra: Record<string, unknown> = {}): QuoteLine => ({
  kind: "product", name: `Wheel ${sku}`, sku, unitPriceUsd: unit, qty, taxable: true,
  meta: { cartType: "wheel", priceSource, source: priceSource, ...extra },
});
const tireLine = (sku: string, unit: number, qty: number, size: string, priceSource = "tireweb"): QuoteLine => ({
  kind: "product", name: `${size} Tire`, sku, unitPriceUsd: unit, qty, taxable: true,
  meta: { cartType: "tire", priceSource, source: priceSource, tireSize: size },
});
const hardwareLine = (): QuoteLine => ({
  kind: "product", name: "Lug kit (included)", sku: "LUGKIT-M14x1.5", unitPriceUsd: 0, qty: 1, taxable: false,
  meta: { cartType: "accessory", priceSource: "included_hardware" },
});

// The RIDLER 652 staggered pair from the browser evidence: 2 x 336.12 + 2 x 345.41 = 1363.06
const ridlerPair = [wheelLine("652-2865GBD", 336.12, 2, "wheelpros", { axle: "front" }), wheelLine("652-2165GBD", 345.41, 2, "wheelpros", { axle: "rear" })];

beforeEach(() => {
  (getStateTaxRate as jest.Mock).mockClear();
  fedex.mockReset();
  firstOrder.mockReset().mockResolvedValue({ valid: false });
  campaign.mockReset().mockResolvedValue({ valid: false });
});

describe("shippingInputsFromLines - shipping inputs come from server lines, not body flags", () => {
  it("landed-cost is a catalog fact (priceSource wheel1); other sources ship; hardware is skipped", () => {
    const inputs = shippingInputsFromLines([wheelLine("W1", 200, 4, "wheel1"), wheelLine("W2", 200, 4, "wheelpros"), hardwareLine()]);
    expect(inputs).toHaveLength(2);
    expect(inputs.find((i) => i.sku === "W1")?.freeShipping).toBe(true);
    expect(inputs.find((i) => i.sku === "W2")?.freeShipping).toBe(false);
  });
  it("a client weight below the size default is ignored; above is kept (never lowers the rate)", () => {
    const lt = tireLine("T1", 300, 4, "LT285/70R17");
    expect(shippingInputsFromLines([lt], [{ sku: "T1", weightLbs: 10 }])[0].weightLbs).toBeUndefined();
    expect(shippingInputsFromLines([lt], [{ sku: "T1", weightLbs: 72 }])[0].weightLbs).toBe(72);
  });
});

describe("computeLocalServiceFees - same schedule as the checkout UI, from server lines", () => {
  it("4 passenger tires = $80 install + $20 disposal; wheel-only set = $15/wheel", () => {
    expect(computeLocalServiceFees(shippingInputsFromLines([tireLine("T", 150, 4, "245/45R18")]))).toEqual({ installUsd: 80, recyclingUsd: 20, tireCount: 4 });
    expect(computeLocalServiceFees(shippingInputsFromLines(ridlerPair))).toEqual({ installUsd: 60, recyclingUsd: 0, tireCount: 0 });
  });
  it("commercial sizes use commercial rates", () => {
    expect(computeLocalServiceFees(shippingInputsFromLines([tireLine("C", 400, 2, "11R22.5")]))).toEqual({ installUsd: 80, recyclingUsd: 50, tireCount: 2 });
  });
});

const ship = (state: string | undefined, zip: string) => ({ kind: "ship" as const, address: { state, zip } });
const PONTIAC = { kind: "store" as const, store: { id: "pontiac" as const, state: "MI" } };

describe("resolveServerTotals - national", () => {
  it("REGRESSION: client tax $0 / shipping isFree are ignored; server tax + zone shipping are charged", async () => {
    const r = await resolveServerTotals({
      db, productLines: ridlerPair, isLocal: false, fulfillment: ship("MI", "48340"),
      claim: { shipping: { amount: 0, isFree: true }, tax: { amount: 0, state: "MI" } },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.totals.productSubtotalUsd).toBe(1363.06);
    expect(r.totals.taxRate).toBe(0.06);
    expect(r.totals.taxUsd).toBe(81.78);
    expect(r.totals.shippingSource).toBe("zone");
    expect(r.totals.shippingUsd).toBeGreaterThan(0);
    expect(r.totals.totalUsd).toBe(Math.round((1363.06 + 81.78 + r.totals.shippingUsd) * 100) / 100);
    expect(r.totals.clientDelta.tax).toBe(-81.78);
    expect(r.totals.clientDelta.shipping).toBe(-r.totals.shippingUsd);
    expect(fedex).not.toHaveBeenCalled();
  });

  it("landed-cost cart (wheel1) ships free without asking FedEx", async () => {
    const r = await resolveServerTotals({ db, productLines: [wheelLine("W1", 250, 4, "wheel1")], isLocal: false, fulfillment: ship("TX", "75001"), claim: {} });
    expect(r.ok && r.totals.shippingIsFree).toBe(true);
    expect(r.ok && r.totals.shippingSource).toBe("landed");
    expect(r.ok && r.totals.taxUsd).toBe(62.5);
  });

  it("heavy LT tires use the live FedEx rate (rounded up)", async () => {
    fedex.mockResolvedValue({ success: true, groundRate: 187.31 });
    const r = await resolveServerTotals({ db, productLines: [tireLine("LT1", 320, 4, "LT285/70R17")], isLocal: false, fulfillment: ship("CO", "80202"), claim: {} });
    expect(r.ok && r.totals.shippingUsd).toBe(188);
    expect(r.ok && r.totals.shippingSource).toBe("fedex");
  });

  it("FAIL CLOSED: heavy items with no live rate -> shipping_unavailable (client 'Call for Quote' $0 cannot be paid)", async () => {
    fedex.mockResolvedValue({ success: false, groundRate: null, error: "no rate" });
    const r = await resolveServerTotals({ db, productLines: [tireLine("LT1", 320, 4, "LT285/70R17")], isLocal: false, fulfillment: ship("CO", "80202"), claim: { shipping: { amount: 0 } } });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toBe("shipping_unavailable");
  });

  it("national order without a valid ZIP cannot be priced", async () => {
    const r = await resolveServerTotals({ db, productLines: ridlerPair, isLocal: false, fulfillment: ship("MI", "ABC"), claim: {} });
    expect(!r.ok && r.error).toBe("invalid_shipping_zip");
  });

  it("NEGATIVE: tax jurisdiction is the ship-to address, never the client tax claim", async () => {
    // client claims a TX rate/state but the order ships to Michigan -> MI 6%
    const r = await resolveServerTotals({
      db, productLines: ridlerPair, isLocal: false, fulfillment: ship("MI", "48340"),
      claim: { tax: { amount: 85.19, rate: 0.0625, state: "TX" } },
    });
    expect(r.ok && r.totals.taxState).toBe("MI");
    expect(r.ok && r.totals.taxUsd).toBe(81.78);
    expect(r.ok && r.totals.clientDelta.tax).toBe(3.41);
  });

  it("NEGATIVE: missing / unknown / lowercase-garbage ship-to state is a blocked checkout, not $0 tax", async () => {
    for (const state of [undefined, "", "  ", "ZZ", "Michigan", "M1", 12 as unknown as string, null as unknown as string]) {
      const r = await resolveServerTotals({ db, productLines: ridlerPair, isLocal: false, fulfillment: ship(state, "48340"), claim: { tax: { amount: 0 } } });
      expect(r.ok).toBe(false);
      expect(!r.ok && r.error).toBe("invalid_shipping_address");
    }
    // a fulfillment that is not a shipment at all cannot price a national order either
    const r = await resolveServerTotals({ db, productLines: ridlerPair, isLocal: false, fulfillment: PONTIAC, claim: {} });
    expect(!r.ok && r.error).toBe("invalid_shipping_address");
  });

  it("no-sales-tax state from the table is a legitimate $0 (policy preserved), lowercase input normalised", async () => {
    const r = await resolveServerTotals({ db, productLines: ridlerPair, isLocal: false, fulfillment: ship("or", "97201"), claim: {} });
    expect(r.ok && r.totals.taxState).toBe("OR");
    expect(r.ok && r.totals.taxRate).toBe(0);
    expect(r.ok && r.totals.taxUsd).toBe(0);
    expect(getStateTaxRate).toHaveBeenCalledWith(db, "OR");
  });
});

describe("resolveServerTotals - local (Michigan store)", () => {
  it("client localFees are ignored; fees/tax come from the server lines and rate", async () => {
    const r = await resolveServerTotals({
      db, productLines: [tireLine("T", 150, 4, "245/45R18")], isLocal: true, fulfillment: PONTIAC,
      claim: { localFees: { installation: 0, recycling: 0, tireCount: 4 }, tax: { amount: 0 } },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.totals.installUsd).toBe(80);
    expect(r.totals.recyclingUsd).toBe(20);
    expect(r.totals.taxUsd).toBe(36);
    expect(r.totals.shippingUsd).toBe(0);
    expect(r.totals.shippingSource).toBe("local");
    expect(r.totals.totalUsd).toBe(736);
    expect(r.totals.clientDelta.install).toBe(-80);
  });

  it("NEGATIVE: local tax is the store's jurisdiction at the local rate; a client TX/blank tax claim changes nothing", async () => {
    for (const tax of [{ amount: 0, state: "TX", rate: 0 }, { state: "" }, undefined]) {
      const r = await resolveServerTotals({ db, productLines: ridlerPair, isLocal: true, fulfillment: PONTIAC, claim: { tax } });
      expect(r.ok && r.totals.taxState).toBe("MI");
      expect(r.ok && r.totals.taxRate).toBe(0.06);
      expect(r.ok && r.totals.taxUsd).toBe(81.78);
    }
    expect(getStateTaxRate).not.toHaveBeenCalled();
  });
});

describe("discount - server validated and actually taken off the total", () => {
  it("valid first-order code: percent of the server product subtotal", async () => {
    firstOrder.mockResolvedValue({ valid: true, discountPercent: 10 });
    const r = await resolveServerTotals({ db, productLines: ridlerPair, isLocal: true, fulfillment: PONTIAC, claim: { discount: { code: "welcome10", amount: 999 } } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.totals.discountUsd).toBe(136.31);
    expect(r.totals.discountCode).toBe("WELCOME10");
    expect(r.totals.discountType).toBe("first_order");
    // 1363.06 - 136.31 + 6% tax on 1363.06 (81.78) + wheel-only install 60
    expect(r.totals.totalUsd).toBe(1368.53);
    expect(r.totals.clientDelta.discount).toBe(862.69);
    expect(needsTotalsReview(r.totals, 1368.53)).toBe(false);
  });

  it("rejected code: dropped, reported, and forces a review even when the totals happen to match", async () => {
    firstOrder.mockResolvedValue({ valid: false, expired: true });
    const r = await resolveServerTotals({ db, productLines: ridlerPair, isLocal: true, fulfillment: PONTIAC, claim: { discount: { code: "OLD", amount: 136.31 } } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.totals.discountUsd).toBe(0);
    expect(r.totals.discountRejected).toEqual({ code: "OLD", reason: "expired" });
    expect(needsTotalsReview(r.totals, r.totals.totalUsd)).toBe(true);
    expect(revisedTotalsPayload(r.totals, 1368.53)).toMatchObject({ expectedTotal: 1368.53, total: r.totals.totalUsd, discount: 0, discountRejected: { code: "OLD", reason: "expired" } });
  });

  it("validation exception never grants a discount", async () => {
    firstOrder.mockRejectedValue(new Error("db down"));
    const r = await resolveServerTotals({ db, productLines: ridlerPair, isLocal: true, fulfillment: PONTIAC, claim: { discount: { code: "X" } } });
    expect(r.ok && r.totals.discountUsd).toBe(0);
    expect(r.ok && r.totals.discountRejected?.reason).toBe("validation_error");
  });
});

describe("needsTotalsReview / totalsToQuoteLines", () => {
  it("payment proceeds only for a finite non-negative expectedTotal equal to the server total (cents)", async () => {
    const r = await resolveServerTotals({ db, productLines: ridlerPair, isLocal: true, fulfillment: PONTIAC, claim: {} });
    if (!r.ok) throw new Error("unexpected");
    expect(needsTotalsReview(r.totals, r.totals.totalUsd)).toBe(false);
    expect(needsTotalsReview(r.totals, String(r.totals.totalUsd))).toBe(false); // numeric string is a claim
    expect(needsTotalsReview(r.totals, r.totals.totalUsd - 0.01)).toBe(true);
    expect(needsTotalsReview(r.totals, r.totals.totalUsd - 0.004)).toBe(false);
  });

  it("NEGATIVE: a missing or invalid expectedTotal is a review, never a silent charge", async () => {
    const r = await resolveServerTotals({ db, productLines: ridlerPair, isLocal: true, fulfillment: PONTIAC, claim: {} });
    if (!r.ok) throw new Error("unexpected");
    for (const bad of [undefined, null, "", "not a number", NaN, Infinity, -Infinity, -0.01, -1363.06, {}, [], true]) {
      expect(needsTotalsReview(r.totals, bad)).toBe(true);
      expect(revisedTotalsPayload(r.totals, bad).expectedTotal).toBeNull();
      expect(totalsReviewDetail(r.totals, bad)).toContain(`$${r.totals.totalUsd.toFixed(2)}`);
    }
    // 0 is a valid (if wrong) claim -> compared, not rejected as malformed
    expect(needsTotalsReview(r.totals, 0)).toBe(true);
    expect(revisedTotalsPayload(r.totals, 0).expectedTotal).toBe(0);
  });
  it("non-product quote lines are built only from server totals", async () => {
    const r = await resolveServerTotals({ db, productLines: [tireLine("T", 150, 4, "245/45R18")], isLocal: true, fulfillment: PONTIAC, claim: {} });
    if (!r.ok) throw new Error("unexpected");
    const lines = totalsToQuoteLines(r.totals, {});
    expect(lines.map((l) => [l.name, l.unitPriceUsd])).toEqual([
      ["Sales Tax (MI)", 36],
      ["Installation (4 tires)", 80],
      ["Tire Recycling (4)", 20],
    ]);
    expect(lines.every((l) => l.taxable === false)).toBe(true);
  });
});
