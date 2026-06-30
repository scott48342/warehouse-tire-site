/**
 * WSI Wholesale Catalog Query
 *
 * Queries wsi_wheels (local Postgres, synced nightly from FTP) and returns
 * TechfeedWheel-compatible objects so they flow through the existing
 * fitment-validation, scoring, and ranking pipeline unchanged.
 *
 * WSI wheels compete equally with WheelPros and Wheel-1 — no supplier preference.
 */

import { getPool } from "@/lib/vehicleFitment";
import type { TechfeedWheel } from "@/lib/techfeed/wheels";

// ─── DB Row ──────────────────────────────────────────────────────────────────

interface WSIWheelRow {
  sku: string;
  brand: string;
  style: string | null;
  finish: string | null;
  diameter: string;
  width: string;
  bp1: string | null;
  bp2: string | null;
  offset_mm: string | null;
  centerbore: string | null;
  wsi_stock: number;
  alt_stock: number;
  catalog_price: string | null;
  dealer_cost: string | null;
  load_rating: string | null;
  image_url: string | null;
  logo_url: string | null;
}

// ─── Extended TechfeedWheel with WSI metadata ────────────────────────────────

export interface WSICandidate extends TechfeedWheel {
  /** Always 'wsi' when sourced from this module. */
  _supplier: "wsi";
  /** Dealer cost from WSI feed. */
  _dealerCost: number | null;
  /** Catalog (MSRP) price from WSI feed. */
  _catalogPrice: number | null;
  /** Total in-stock quantity (wsi_stock + alt_stock). */
  _inventoryQty: number;
}

// ─── Pricing ─────────────────────────────────────────────────────────────────

/**
 * Compute WSI sell price.
 *
 * Formula: cost × 1.30, capped at catalog price.
 * Matches WheelPros margin (30%) for supplier-neutral merchandising.
 *
 * If no cost, fall back to: catalog_price × 0.975
 * (derives cost at ~dealer margin, then marks up 30%)
 */
export function computeWSISellPrice(params: {
  dealerCost: number | null;
  catalogPrice: number | null;
}): number {
  const { dealerCost, catalogPrice } = params;

  const cost = dealerCost ?? (catalogPrice ? catalogPrice * 0.75 : null);
  if (!cost || cost <= 0) return catalogPrice ?? 0;

  const sellPrice = Math.round(cost * 1.30 * 100) / 100;

  // Never exceed catalog price
  if (catalogPrice && catalogPrice > 0 && sellPrice > catalogPrice) {
    return catalogPrice;
  }
  return sellPrice;
}

// ─── Bolt-pattern format helper ───────────────────────────────────────────────

/** "5x114.3" → "5-114.3" (standard format for TechfeedWheel.bolt_pattern_standard) */
function toStandard(bp: string): string {
  return bp.replace(/^(\d+)x(.+)$/, "$1-$2");
}

/** Fitment-search uses "5x114.3" format; DB stores same. */
function toBPDb(raw: string): string {
  return raw.replace(/^(\d+)[-x](.+)$/, "$1x$2").trim();
}

// ─── Row → TechfeedWheel mapper ───────────────────────────────────────────────

function mapRowToCandidate(row: WSIWheelRow): WSICandidate | null {
  const dealerCost   = row.dealer_cost   ? parseFloat(row.dealer_cost)   : null;
  const catalogPrice = row.catalog_price ? parseFloat(row.catalog_price) : null;
  const invQty       = (row.wsi_stock || 0) + (row.alt_stock || 0);

  // Brand code for facets/filtering (uppercase, no spaces)
  const brandCode = row.brand.toUpperCase().replace(/\s+/g, "");

  // Build images array from WSI image URL (single image per SKU)
  const images: string[] = [];
  if (row.image_url) images.push(row.image_url);

  // Finish: WSI has explicit finish field
  const finish = row.finish || null;

  // Product description
  const productDesc = [row.brand, row.style, finish, `${row.diameter}"x${row.width}"`]
    .filter(Boolean)
    .join(" ");

  const n2u = (v: string | null): string | undefined => v ?? undefined;

  return {
    // ── TechfeedWheel fields ──────────────────────────────────────────────────
    sku:                   row.sku,
    product_desc:          productDesc,
    brand_cd:              brandCode,
    brand_desc:            row.brand,
    style:                 n2u(row.style),
    display_style_no:      n2u(row.style),

    diameter:              row.diameter,
    width:                 row.width,
    offset:                row.offset_mm ?? "0",
    centerbore:            n2u(row.centerbore),
    backspacing:           undefined,

    lug_count:             undefined,
    bolt_pattern_metric:   n2u(row.bp1),                           // "6x139.7"
    bolt_pattern_standard: row.bp1 ? toStandard(row.bp1) : undefined, // "6-139.7"

    abbreviated_finish_desc: n2u(finish),
    fancy_finish_desc:       n2u(finish),
    box_label_desc:          undefined,

    // Pricing: expose catalog_price as msrp for getSafeWheelPrice fallback
    msrp:      catalogPrice ? String(catalogPrice) : undefined,
    map_price: undefined, // WSI doesn't provide MAP

    images,

    // ── WSI supplier extensions ───────────────────────────────────────────────
    _supplier:     "wsi",
    _dealerCost:   dealerCost,
    _catalogPrice: catalogPrice,
    _inventoryQty: invQty,
  } as WSICandidate;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Return all WSI wheels matching the given bolt pattern.
 * Matches bp1 OR bp2 (multi-fit wheels carry two patterns).
 *
 * @param boltPattern  Fitment-search format: "5x114.3", "6x139.7", etc.
 */
export async function getWSICandidatesByBoltPattern(
  boltPattern: string
): Promise<WSICandidate[]> {
  const bp = toBPDb(boltPattern);
  if (!bp) return [];

  const pool = getPool();
  try {
    const { rows } = await pool.query<WSIWheelRow>(
      `SELECT
        sku, brand, style, finish,
        diameter::text, width::text,
        bp1, bp2,
        offset_mm::text, centerbore::text,
        wsi_stock, alt_stock,
        catalog_price::text, dealer_cost::text, load_rating::text,
        image_url, logo_url
      FROM wsi_wheels
      WHERE bp1 = $1 OR bp2 = $1
      ORDER BY
        -- In-stock first
        (COALESCE(wsi_stock, 0) + COALESCE(alt_stock, 0) > 0) DESC,
        -- Then by price
        catalog_price ASC NULLS LAST`,
      [bp]
    );

    return rows
      .map(row => mapRowToCandidate(row))
      .filter((c): c is WSICandidate => c !== null);
  } catch (err) {
    // Never crash primary search on WSI failure
    console.error("[wsi] getWSICandidatesByBoltPattern error:", (err as Error).message);
    return [];
  }
}
