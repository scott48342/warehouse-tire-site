/**
 * Server-authoritative order totals (2026-09-20, Codex release review "totals").
 *
 * Product prices became server-authoritative on 2026-09-19 (buildCheckoutLines), but both
 * Stripe routes still charged whatever the CLIENT sent for tax (`body.tax.amount`), shipping
 * (`body.shipping.amount` / `isFree`) and local install/recycling fees (`body.localFees.*`),
 * and never applied the discount to the charge (it only went into quote metadata) - a
 * first-order discount showed on screen but the customer was charged the undiscounted total,
 * and a tampered body could zero out tax or shipping.
 *
 * This module recomputes every non-product component from the server-priced lines under the
 * SAME rules the UI uses (state tax table / Michigan local rate, zone or FedEx shipping,
 * per-tire install + disposal schedule, percentage discount codes), reports the client's
 * deltas, and the routes charge ONLY these numbers.
 *
 * Fail-closed rules:
 *   - national order whose shipping needs a live FedEx rate that cannot be obtained ->
 *     `shipping_unavailable` (the UI shows "Call for Quote" and sends $0 - it must not pay $0);
 *   - national order without a valid 5-digit ZIP -> `invalid_shipping_zip`;
 *   - a discount code that does not validate server-side is dropped and reported as
 *     `discountRejected`; the route answers with a recoverable changed-total response.
 *   - a server total that differs from the total the shopper was shown (`expectedTotal`)
 *     is NOT charged silently; the route returns the revised breakdown for review.
 *
 * Shipping inputs come from the SERVER-priced lines (type, qty, sku, tire size, supplier),
 * never from body flags: landed-cost ("free") shipping is a catalog fact (`priceSource ===
 * "wheel1"`), not `item.freeShipping`. Client weights are accepted only as an upper bound
 * (a lower weight can never lower the rate below the size-based default).
 */
import type pg from "pg";
import type { QuoteLine } from "@/lib/quotes";
import { getStateTaxRate } from "@/lib/tax/stateTaxRates";
import { TAX_RATE as LOCAL_TAX_RATE, isCommercialTireSize } from "@/lib/localPricing";
import {
  calculateShipping,
  isOversizedTireSize,
  isValidZipCode,
  normalizeZipCode,
  type ShippingItem,
} from "@/lib/shipping/shippingService";
import { getFedExShippingRate, shouldUseFedExLookup, type CartItemForShipping } from "@/lib/shipping/fedexRates";
import { validateDiscount } from "@/lib/discounts/firstOrderService";
import { validateCampaignDiscount } from "@/lib/discounts/campaignDiscountService";

/** Local install/disposal schedule - identical to LOCAL_FEES in the checkout UI. */
export const LOCAL_SERVICE_FEES = {
  installPerTire: 20,          // mount, balance, install per tire ($80 / set of 4)
  installPerWheel: 15,         // wheel-only install (no tire)
  disposalPerTire: 5,          // tire recycling ($20 / set of 4)
  commercialInstallPerTire: 40,
  commercialDisposalPerTire: 25,
} as const;

/** Catalog sources whose freight is baked into the unit price (shipping line = $0). */
export const LANDED_COST_PRICE_SOURCES: ReadonlySet<string> = new Set(["wheel1"]);

/** Server-derived shipping line - built from QuoteLines, not from the request body. */
export type ShippingInput = {
  type: "wheel" | "tire" | "accessory";
  quantity: number;
  unitPrice: number;
  sku?: string;
  sizeLabel?: string;
  source?: string;
  freeShipping: boolean;
  weightLbs?: number;
  diameterInches?: number;
};

export type ClientTotalsClaim = {
  shipping?: { zip?: string; state?: string; amount?: number; isFree?: boolean } | null;
  tax?: { amount?: number; rate?: number; state?: string } | null;
  discount?: { code?: string; amount?: number; type?: string } | null;
  localFees?: { installation?: number; recycling?: number; cardProcessing?: number; tireCount?: number } | null;
  /** The grand total the shopper was shown when they pressed pay. */
  expectedTotal?: number | null;
};

/** Optional per-line hints from the raw cart (weights/diameters); validated, never trusted downward. */
export type CartItemHint = { sku?: string; type?: string; weightLbs?: number; diameter?: string | number; source?: string };

export type ServerTotals = {
  productSubtotalUsd: number;
  taxableSubtotalUsd: number;
  taxRate: number;
  taxUsd: number;
  taxState: string;
  shippingUsd: number;
  shippingIsFree: boolean;
  shippingSource: "none" | "landed" | "zone" | "fedex" | "local";
  installUsd: number;
  recyclingUsd: number;
  tireCount: number;
  discountUsd: number;
  discountCode?: string;
  discountPercent?: number;
  discountType?: "first_order" | "promo";
  discountRejected?: { code: string; reason: string };
  totalUsd: number;
  /** client-sent minus server, per component (0 when the client sent nothing) */
  clientDelta: { tax: number; shipping: number; install: number; recycling: number; discount: number; total: number };
};

export type ServerTotalsResult =
  | { ok: true; totals: ServerTotals }
  | { ok: false; error: "shipping_unavailable" | "invalid_shipping_zip"; detail: string };

export const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Size-based default weight used by fedexRates when none is supplied. */
function defaultWeightLbs(type: ShippingInput["type"], sizeLabel?: string): number {
  if (type === "tire") return isOversizedTireSize(sizeLabel) ? 65 : 25;
  if (type === "wheel") return 28;
  return 0;
}

/**
 * Shipping inputs from the server-priced product lines. Service/hardware/road-hazard lines
 * are not shippable goods and are skipped. `freeShipping` is derived from the catalog
 * price source only.
 */
export function shippingInputsFromLines(lines: QuoteLine[], hints: CartItemHint[] = []): ShippingInput[] {
  const out: ShippingInput[] = [];
  for (const l of lines) {
    const meta = (l.meta || {}) as Record<string, any>;
    const cartType = String(meta.cartType || "");
    if (cartType !== "wheel" && cartType !== "tire" && cartType !== "accessory") continue;
    const priceSource = String(meta.priceSource || "");
    if (priceSource === "included_hardware" || priceSource === "computed_road_hazard") continue;
    const qty = Number(l.qty) || 0;
    if (qty <= 0) continue;
    const type = cartType as ShippingInput["type"];
    const sizeLabel = type === "tire" ? (meta.tireSize ? String(meta.tireSize) : undefined) : undefined;
    const hint = hints.find((h) => h && typeof h === "object" && h.sku && l.sku && String(h.sku) === String(l.sku));
    const floor = defaultWeightLbs(type, sizeLabel);
    const hintW = num(hint?.weightLbs);
    const weightLbs = hintW != null && hintW >= floor ? hintW : undefined; // never below the size default
    const hintD = num(hint?.diameter ?? meta.spec?.diameter);
    out.push({
      type,
      quantity: qty,
      unitPrice: Number(l.unitPriceUsd) || 0,
      sku: l.sku,
      sizeLabel,
      source: meta.source ? String(meta.source) : priceSource || undefined,
      freeShipping: LANDED_COST_PRICE_SOURCES.has(priceSource),
      weightLbs,
      diameterInches: hintD != null && hintD > 0 ? hintD : undefined,
    });
  }
  return out;
}

function toShippingItems(items: ShippingInput[]): ShippingItem[] {
  return items.map((i) => ({ type: i.type, quantity: i.quantity, unitPrice: i.unitPrice, freeShipping: i.freeShipping, sizeLabel: i.sizeLabel, weightLbs: i.weightLbs }));
}

function toFedExItems(items: ShippingInput[]): CartItemForShipping[] {
  return items.map((i) => ({
    type: i.type,
    quantity: i.quantity,
    weightLbs: i.weightLbs,
    diameterInches: i.diameterInches,
    freeShipping: i.freeShipping,
    source: i.source,
    sizeLabel: i.sizeLabel,
    partNumber: i.sku,
  }));
}

/** Local install/disposal from the server lines (tires by size, wheel-only sets) - mirrors the checkout UI. */
export function computeLocalServiceFees(items: ShippingInput[]): { installUsd: number; recyclingUsd: number; tireCount: number } {
  const tires = items.filter((i) => i.type === "tire");
  const wheels = items.filter((i) => i.type === "wheel");
  const tireCount = tires.reduce((s, t) => s + t.quantity, 0);
  const wheelOnlyCount = wheels.length > 0 && tires.length === 0 ? wheels.reduce((s, w) => s + w.quantity, 0) : 0;
  let install = wheelOnlyCount * LOCAL_SERVICE_FEES.installPerWheel;
  let disposal = 0;
  for (const t of tires) {
    const commercial = isCommercialTireSize(t.sizeLabel);
    install += t.quantity * (commercial ? LOCAL_SERVICE_FEES.commercialInstallPerTire : LOCAL_SERVICE_FEES.installPerTire);
    disposal += t.quantity * (commercial ? LOCAL_SERVICE_FEES.commercialDisposalPerTire : LOCAL_SERVICE_FEES.disposalPerTire);
  }
  return { installUsd: money(install), recyclingUsd: money(disposal), tireCount };
}

/**
 * Resolve the discount server-side. Percentage codes only (first-order + campaign tables);
 * the amount is computed on the server PRODUCT subtotal, the same base the UI uses.
 */
export async function resolveServerDiscount(
  claim: ClientTotalsClaim["discount"],
  productSubtotalUsd: number,
): Promise<Pick<ServerTotals, "discountUsd" | "discountCode" | "discountPercent" | "discountType" | "discountRejected">> {
  const code = String(claim?.code || "").trim().toUpperCase();
  if (!code) return { discountUsd: 0 };
  try {
    const first = await validateDiscount(code);
    if (first.valid && Number(first.discountPercent) > 0) {
      const pct = Number(first.discountPercent);
      return { discountUsd: money(productSubtotalUsd * pct / 100), discountCode: code, discountPercent: pct, discountType: "first_order" };
    }
    const camp = await validateCampaignDiscount(code);
    if (camp.valid && Number(camp.discountPercent) > 0) {
      const pct = Number(camp.discountPercent);
      return { discountUsd: money(productSubtotalUsd * pct / 100), discountCode: code, discountPercent: pct, discountType: "promo" };
    }
    const reason =
      first.expired || camp.expired ? "expired"
      : first.alreadyRedeemed || camp.alreadyRedeemed ? "already_redeemed"
      : "invalid";
    return { discountUsd: 0, discountRejected: { code, reason } };
  } catch (e: any) {
    console.error("[orderTotals] discount validation failed:", e?.message || e);
    return { discountUsd: 0, discountRejected: { code, reason: "validation_error" } };
  }
}

export async function resolveServerTotals(params: {
  db: pg.Pool;
  /** server-priced product/hardware lines from buildCheckoutLines (NO shipping/tax/fee lines) */
  productLines: QuoteLine[];
  /** raw cart items from the request body - weight/diameter hints only */
  cartHints?: CartItemHint[];
  isLocal: boolean;
  claim: ClientTotalsClaim;
}): Promise<ServerTotalsResult> {
  const { db, productLines, isLocal, claim } = params;
  const shipInputs = shippingInputsFromLines(productLines, params.cartHints || []);

  const productSubtotalUsd = money(productLines.reduce((s, l) => s + (Number(l.unitPriceUsd) || 0) * (Number(l.qty) || 0), 0));
  const taxableSubtotalUsd = money(productLines.filter((l) => l.taxable !== false).reduce((s, l) => s + (Number(l.unitPriceUsd) || 0) * (Number(l.qty) || 0), 0));

  // ---- tax: OUR state table (national) or the Michigan rate (local) -------------------
  const taxState = String(claim.tax?.state || claim.shipping?.state || "").trim().toUpperCase();
  let taxRate = 0;
  if (isLocal) taxRate = LOCAL_TAX_RATE;
  else if (/^[A-Z]{2}$/.test(taxState)) taxRate = Number(await getStateTaxRate(db, taxState)) || 0;
  const taxUsd = money(taxableSubtotalUsd * taxRate);

  // ---- shipping ------------------------------------------------------------------------
  let shippingUsd = 0;
  let shippingIsFree = false;
  let shippingSource: ServerTotals["shippingSource"] = "none";
  if (isLocal) {
    shippingSource = "local"; // store delivery included
  } else {
    const zipRaw = String(claim.shipping?.zip || "").trim();
    if (!zipRaw || !isValidZipCode(zipRaw)) {
      return { ok: false, error: "invalid_shipping_zip", detail: "A valid 5-digit US ZIP code is required to price shipping." };
    }
    const zip = normalizeZipCode(zipRaw);
    const zone = calculateShipping({ zipCode: zip, items: toShippingItems(shipInputs), subtotal: productSubtotalUsd });
    const fedexItems = toFedExItems(shipInputs);
    if (zone.isFree) {
      shippingIsFree = true;
      shippingSource = "landed";
    } else if (shouldUseFedExLookup(fedexItems)) {
      const fx = await getFedExShippingRate(zip, taxState || "", fedexItems);
      if (fx.success && fx.groundRate !== null && Number.isFinite(fx.groundRate)) {
        shippingUsd = money(Math.ceil(fx.groundRate));
        shippingSource = "fedex";
      } else {
        // Same rule as /api/shipping/estimate: heavy items without a live rate = call for quote.
        return { ok: false, error: "shipping_unavailable", detail: "We couldn't price shipping to this ZIP right now. Please call (248) 332-4120 for a quote." };
      }
    } else {
      shippingUsd = money(zone.amount);
      shippingSource = "zone";
    }
  }

  // ---- local service fees ---------------------------------------------------------------
  const fees = isLocal ? computeLocalServiceFees(shipInputs) : { installUsd: 0, recyclingUsd: 0, tireCount: 0 };

  // ---- discount -------------------------------------------------------------------------
  const disc = await resolveServerDiscount(claim.discount, productSubtotalUsd);

  const totalUsd = money(productSubtotalUsd - disc.discountUsd + taxUsd + shippingUsd + fees.installUsd + fees.recyclingUsd);

  const delta = (client: number | null, server: number) => (client == null ? 0 : money(client - server));
  const clientDelta = {
    tax: delta(num(claim.tax?.amount), taxUsd),
    shipping: delta(claim.shipping?.isFree ? 0 : num(claim.shipping?.amount), shippingUsd),
    install: delta(num(claim.localFees?.installation), fees.installUsd),
    recycling: delta(num(claim.localFees?.recycling), fees.recyclingUsd),
    discount: delta(num(claim.discount?.amount), disc.discountUsd),
    total: delta(num(claim.expectedTotal), totalUsd),
  };

  return {
    ok: true,
    totals: {
      productSubtotalUsd,
      taxableSubtotalUsd,
      taxRate,
      taxUsd,
      taxState,
      shippingUsd,
      shippingIsFree,
      shippingSource,
      installUsd: fees.installUsd,
      recyclingUsd: fees.recyclingUsd,
      tireCount: fees.tireCount,
      totalUsd,
      clientDelta,
      ...disc,
    },
  };
}

/** Non-product QuoteLines for the quote record / Stripe, built ONLY from server totals. */
export function totalsToQuoteLines(t: ServerTotals, opts: { zip?: string }): QuoteLine[] {
  const lines: QuoteLine[] = [];
  if (t.shippingUsd > 0 && !t.shippingIsFree) {
    lines.push({ kind: "product", name: "Shipping & Handling", sku: undefined, unitPriceUsd: t.shippingUsd, qty: 1, taxable: false, meta: { type: "shipping", zip: opts.zip, source: t.shippingSource } });
  }
  if (t.taxUsd > 0) {
    lines.push({ kind: "product", name: `Sales Tax${t.taxState ? ` (${t.taxState})` : ""}`, sku: undefined, unitPriceUsd: t.taxUsd, qty: 1, taxable: false, meta: { type: "tax", state: t.taxState, rate: t.taxRate, taxableSubtotal: t.taxableSubtotalUsd } });
  }
  if (t.installUsd > 0) {
    lines.push({ kind: "product", name: `Installation (${t.tireCount} tires)`, sku: undefined, unitPriceUsd: t.installUsd, qty: 1, taxable: false, meta: { type: "service", serviceType: "installation", tireCount: t.tireCount } });
  }
  if (t.recyclingUsd > 0) {
    lines.push({ kind: "product", name: `Tire Recycling (${t.tireCount})`, sku: undefined, unitPriceUsd: t.recyclingUsd, qty: 1, taxable: false, meta: { type: "service", serviceType: "recycling", tireCount: t.tireCount } });
  }
  return lines;
}

/**
 * The shopper must review a total that differs from the one they were shown, and must be
 * told when their discount was dropped. `expectedTotal` absent (legacy client) -> only a
 * rejected discount forces review; the server total is charged as computed.
 */
export function needsTotalsReview(t: ServerTotals, expectedTotal: unknown): boolean {
  if (t.discountRejected) return true;
  const exp = num(expectedTotal);
  if (exp == null) return false;
  // Compare in whole cents (a float x - 0.01 can land at 0.00999...).
  return Math.round(exp * 100) !== Math.round(t.totalUsd * 100);
}

/** Customer-facing revised breakdown (no internals). */
export function revisedTotalsPayload(t: ServerTotals, expectedTotal: unknown) {
  const exp = num(expectedTotal);
  return {
    expectedTotal: exp,
    total: t.totalUsd,
    subtotal: t.productSubtotalUsd,
    discount: t.discountUsd,
    discountCode: t.discountCode,
    tax: t.taxUsd,
    taxRate: t.taxRate,
    taxState: t.taxState || undefined,
    shipping: t.shippingUsd,
    shippingIsFree: t.shippingIsFree,
    installation: t.installUsd,
    recycling: t.recyclingUsd,
    ...(t.discountRejected ? { discountRejected: t.discountRejected } : {}),
  };
}

export function totalsReviewDetail(t: ServerTotals, expectedTotal: unknown): string {
  if (t.discountRejected) {
    const why = t.discountRejected.reason === "expired" ? "has expired" : t.discountRejected.reason === "already_redeemed" ? "has already been used" : "is no longer valid";
    return `Discount code ${t.discountRejected.code} ${why} and was removed. Please review your updated total of $${t.totalUsd.toFixed(2)} before paying.`;
  }
  const exp = num(expectedTotal);
  return exp == null
    ? `Please review your updated total of $${t.totalUsd.toFixed(2)} before paying.`
    : `Your total was updated from $${exp.toFixed(2)} to $${t.totalUsd.toFixed(2)}. Please review it before paying.`;
}
