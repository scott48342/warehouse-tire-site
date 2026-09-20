/**
 * Server-side catalog re-pricing for checkout (safety review Q7-2 / Q1-1,
 * 2026-09-19). The client cart price is a DISPLAY value; the price we charge
 * and snapshot into the order must come from the same supplier chain the
 * product pages use. Wheels: WheelPros API -> TechFeed -> Wheel-1 -> WSI
 * (identical to `resolveRearWheel` on the wheel PDP). Tires: /api/tires/search
 * exact part-number match scoped to size (identical to the tire PDP).
 *
 * Accessories (release review 2026-09-19): fixed-price synthetic SKUs ->
 * `accessories` table (sell_price, else msrp - what the accessory PDP shows) ->
 * `suspension_fitments` (msrp, else map_price - what the lift-kit PDP shows).
 *
 * Every resolver returns `null` when the SKU cannot be priced. Callers must
 * REJECT the line in that case - never fall back to the client price or $0.
 */
import { getTechfeedWheelBySku } from "@/lib/techfeed/wheels";
import { getDbPool } from "@/lib/db/pool";
import { FIXED_PRICE_SKUS } from "./fixedPriceSkus";
import { getWheel1WheelBySku, computeWheel1SellPrice, type Wheel1Candidate } from "@/lib/wheel1/catalog";
import { getWSIWheelBySku, computeWSISellPrice, type WSICandidate } from "@/lib/wsi/catalog";

/**
 * Shipping attributes as the CATALOG knows them. This is the only source the rate engine
 * trusts (Codex release review 2026-09-20): client `spec`/`size`/`source`/weight hints can
 * never lower a package dimension, weight, or move the ship origin.
 */
export type CatalogShippingAttrs = {
  /** Wheel rim diameter (in). Tires derive their overall diameter from `sizeLabel`. */
  diameterInches?: number;
  /** Tire size as listed by the supplier feed (e.g. "LT285/70R17"). */
  sizeLabel?: string;
  /** Per-unit weight (lbs) from the supplier feed when it publishes one. */
  weightLbs?: number;
  /** Supplier/source tag from the catalog hit (e.g. "wheelpros", "tireweb:atd", "usautoforce"). */
  supplierSource?: string;
};

export type ResolvedCatalogPrice = {
  sku: string;
  unitPrice: number;
  finish?: string;
  /** Catalog-resolved shipping attributes; see CatalogShippingAttrs. */
  shipping?: CatalogShippingAttrs;
  /** Catalog's own category for accessories (`accessories.category`); the server-side
   *  basis for included-hardware eligibility. Never taken from the client. */
  category?: string | null;
  source: "wheelpros" | "techfeed" | "wheel1" | "wsi" | "tireweb" | "fixed" | "accessories_db" | "suspension_db";
};

export type CatalogPriceResolver = (
  sku: string,
  ctx: { type: "wheel" | "tire" | "accessory"; size?: string },
) => Promise<ResolvedCatalogPrice | null>;

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT || 3000}`;
}

const positive = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : v != null ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

export async function resolveWheelPrice(sku: string): Promise<ResolvedCatalogPrice | null> {
  const clean = String(sku || "").trim();
  if (!clean) return null;
  // 1) WheelPros (msrp field is rewritten to the SELL price by the search route)
  try {
    const res = await fetch(
      `${getBaseUrl()}/api/wheelpros/wheels/search?fields=price,properties&priceType=msrp&currencyCode=USD&page=1&pageSize=1&sku=${encodeURIComponent(clean)}`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = (await res.json()) as { items?: any[]; results?: any[] };
      const raw = Array.isArray(data?.items) ? data.items : Array.isArray(data?.results) ? data.results : [];
      const it = raw[0];
      const price = positive(it?.prices?.msrp?.[0]?.currencyAmount);
      if (it && price != null) {
        const props = it.properties || {};
        return {
          sku: it.sku || clean,
          unitPrice: price,
          finish: props.finish || props.abbreviated_finish_desc || props.fancy_finish_desc || undefined,
          source: "wheelpros",
          shipping: { diameterInches: positive(props.diameter ?? props.wheel_diameter) ?? undefined, supplierSource: "wheelpros" },
        };
      }
    }
  } catch (e) {
    console.warn(`[checkout/reprice] wheelpros lookup failed for ${clean}:`, e instanceof Error ? e.message : e);
  }
  // 2) TechFeed
  try {
    const tf: any = await getTechfeedWheelBySku(clean);
    const price = positive(tf?.msrp);
    if (tf && price != null) {
      return { sku: tf.sku || clean, unitPrice: price, finish: tf.abbreviated_finish_desc || tf.fancy_finish_desc || undefined, source: "techfeed", shipping: { diameterInches: positive(tf.diameter) ?? undefined, supplierSource: "wheelpros" } };
    }
  } catch {}
  // 3) Wheel-1
  try {
    const w1 = await getWheel1WheelBySku(clean);
    if (w1) {
      const sell = computeWheel1SellPrice({
        msrp: (w1 as Wheel1Candidate)._msrpNum,
        mapPrice: (w1 as Wheel1Candidate)._mapNum,
        dealerCost: (w1 as Wheel1Candidate)._dealerCost ?? null,
        diameter: Number((w1 as any).diameter) || 0,
      });
      const price = positive(sell);
      if (price != null) {
        return { sku: (w1 as any).sku || clean, unitPrice: price, finish: (w1 as any).abbreviated_finish_desc || (w1 as any).fancy_finish_desc || undefined, source: "wheel1", shipping: { diameterInches: positive((w1 as any).diameter) ?? undefined, supplierSource: "wheel1" } };
      }
    }
  } catch {}
  // 4) WSI
  try {
    const wsi = await getWSIWheelBySku(clean);
    if (wsi) {
      const sell = computeWSISellPrice({
        dealerCost: (wsi as WSICandidate)._dealerCost,
        catalogPrice: (wsi as WSICandidate)._catalogPrice,
      });
      const price = positive(sell);
      if (price != null) {
        return { sku: (wsi as any).sku || clean, unitPrice: price, finish: (wsi as any).abbreviated_finish_desc || (wsi as any).fancy_finish_desc || undefined, source: "wsi", shipping: { diameterInches: positive((wsi as any).diameter) ?? undefined, supplierSource: "wsi" } };
      }
    }
  } catch {}
  return null;
}

export async function resolveTirePrice(sku: string, size?: string): Promise<ResolvedCatalogPrice | null> {
  const clean = String(sku || "").trim();
  if (!clean) return null;
  const norm = (v: unknown) => String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const target = norm(clean);
  const qs = new URLSearchParams({ partNumber: clean, pageSize: "100" });
  if (size) qs.set("size", size);
  try {
    const res = await fetch(`${getBaseUrl()}/api/tires/search?${qs.toString()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const j = (await res.json()) as { results?: any[] };
    const hit = (Array.isArray(j?.results) ? j.results : []).find(
      (t) => norm(t?.partNumber) === target || norm(t?.mfgPartNumber) === target || norm(t?.sku) === target
    );
    const price = positive(hit?.price ?? hit?.sellPrice);
    if (hit && price != null) {
      return {
        sku: hit.partNumber || hit.sku || clean,
        unitPrice: price,
        source: "tireweb",
        shipping: {
          sizeLabel: typeof hit.size === "string" && hit.size.trim() ? hit.size.trim() : undefined,
          weightLbs: positive(hit.badges?.tireWeight) ?? undefined,
          supplierSource: typeof hit.source === "string" && hit.source ? hit.source : undefined,
        },
      };
    }
  } catch (e) {
    console.warn(`[checkout/reprice] tire lookup failed for ${clean}:`, e instanceof Error ? e.message : e);
  }
  return null;
}

export async function resolveAccessoryPrice(sku: string): Promise<ResolvedCatalogPrice | null> {
  const clean = String(sku || "").trim();
  if (!clean) return null;

  const fixed = FIXED_PRICE_SKUS[clean.toUpperCase()];
  if (fixed != null) return { sku: clean, unitPrice: fixed, source: "fixed" };

  const pool = getDbPool();
  if (!pool) {
    console.warn(`[checkout/reprice] no DB pool - accessory ${clean} unpriceable`);
    return null;
  }
  try {
    const acc = await pool.query<{ sku: string; sell_price: unknown; msrp: unknown; category: string | null }>(
      `SELECT sku, sell_price, msrp, category FROM accessories WHERE UPPER(sku) = UPPER($1) LIMIT 1`,
      [clean],
    );
    const a = acc.rows[0];
    const accPrice = a ? positive(a.sell_price) ?? positive(a.msrp) : null;
    if (a && accPrice != null) return { sku: a.sku || clean, unitPrice: accPrice, category: a.category ?? null, source: "accessories_db" };

    const sus = await pool.query<{ sku: string; msrp: unknown; map_price: unknown }>(
      `SELECT sku, msrp, map_price FROM suspension_fitments WHERE UPPER(sku) = UPPER($1) LIMIT 1`,
      [clean],
    );
    const s = sus.rows[0];
    const susPrice = s ? positive(s.msrp) ?? positive(s.map_price) : null;
    if (s && susPrice != null) return { sku: s.sku || clean, unitPrice: susPrice, source: "suspension_db" };
  } catch (e) {
    console.warn(`[checkout/reprice] accessory lookup failed for ${clean}:`, e instanceof Error ? e.message : e);
  }
  return null;
}

export const defaultCatalogPriceResolver: CatalogPriceResolver = (sku, ctx) =>
  ctx.type === "wheel" ? resolveWheelPrice(sku) : ctx.type === "tire" ? resolveTirePrice(sku, ctx.size) : resolveAccessoryPrice(sku);
