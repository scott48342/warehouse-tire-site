/**
 * Wheel-1 Catalog Query
 *
 * Queries wheel1_products (local Postgres) and returns TechfeedWheel-compatible
 * objects so they can flow through the existing fitment-validation, scoring, and
 * ranking pipeline unchanged.
 *
 * Used by /api/wheels/fitment-search behind the `preview_suppliers=wheel1`
 * flag. Nothing here is exposed publicly until inventory + cost feeds arrive.
 */

import { getPool } from "@/lib/vehicleFitment";
import type { TechfeedWheel } from "@/lib/techfeed/wheels";

// ─── Row type returned by the DB query ──────────────────────────────────────

interface Wheel1Row {
  sku: string;
  brand: string;
  name: string | null;
  style_number: string | null;
  description: string | null;
  short_description: string | null;
  diameter: string;
  wheel_width: string;
  hub: string | null;
  pcd1: string | null;
  pcd2: string | null;
  offset_mm: string | null;
  finish: string | null;
  color: string | null;
  msrp: string | null;
  map_price: string | null;
  dealer_cost: string | null;       // real dealer cost from inventory sync
  inventory_qty: number | null;     // live stock quantity
  primary_warehouse: string | null; // highest-qty warehouse
  has_map: boolean;
  image1: string | null;
  image2: string | null;
  image3: string | null;
  image4: string | null;
  image1_source: string | null; // fallback CDN URL
  image2_source: string | null;
  load_rating: number | null;
  tpms_compatible: boolean | null;
  is_dually: boolean;
  is_winter_approved: boolean;
  structure_warranty: string | null;
  bullet_points: string | null;
  sales_description: string | null;
  upc: string | null;
  country_of_origin: string | null;
}

// ─── Extended TechfeedWheel with supplier metadata ───────────────────────────

export interface Wheel1Candidate extends TechfeedWheel {
  /** Always 'wheel1' when sourced from this module. */
  _supplier: "wheel1";
  /** Raw MSRP as a number (used by pricing layer). */
  _msrpNum: number | null;
  /** Raw MAP as a number (used by pricing layer). */
  _mapNum: number | null;
  /** Real dealer cost from inventory sync ($1/inch freight included in sell price). */
  _dealerCost: number | null;
  /** Live inventory quantity (null = not yet synced). */
  _inventoryQty: number | null;
  /** Shipping is baked into the price — show FREE SHIPPING badge. */
  _freeShipping: true;
  /** Extra wheel-1 specific fields for PDP/admin. */
  _w1: {
    brandFull: string;
    styleName: string | null;
    isDually: boolean;
    isWinterApproved: boolean;
    tpmsCompatible: boolean | null;
    loadRating: number | null;
    structureWarranty: string | null;
    bulletPoints: string[] | null;
    salesDescription: string | null;
    upc: string | null;
    countryOfOrigin: string | null;
  };
}

// ─── Bolt-pattern format helpers ─────────────────────────────────────────────

/**
 * Convert fitment-search format "5x114.3" → DB format "5x114.3" (already normalized).
 * Also handles legacy "5-114.3" variants that may appear in the envelope.
 */
function toBoltPatternDb(raw: string): string {
  return raw.replace(/^(\d+)[-x](.+)$/, "$1x$2").trim();
}

/**
 * Convert DB format "5x114.3" → TechfeedWheel metric format "5x114.3"
 * and standard format "5-114.3" for the properties blob.
 */
function toStandard(pcd: string): string {
  return pcd.replace(/^(\d+)x(.+)$/, "$1-$2");
}

// ─── Image resolution ────────────────────────────────────────────────────────

/** Return the best available image URL: Vercel Blob first, CDN fallback. */
function resolveImage(blobUrl: string | null, cdnUrl: string | null): string | null {
  // Blob URL is set after mirroring completes; fall back to CDN while mirror runs
  if (blobUrl && !blobUrl.includes("cdn.bfldr.com")) return blobUrl;
  return cdnUrl || blobUrl || null;
}

// ─── Row → TechfeedWheel mapper ──────────────────────────────────────────────

function mapRowToCandidate(row: Wheel1Row, requireStock = false): Wheel1Candidate | null {
  // When inventory is synced, optionally filter out zero-stock wheels
  if (requireStock && row.inventory_qty !== null && row.inventory_qty <= 0) {
    return null;
  }

  const msrpNum   = row.msrp ? parseFloat(row.msrp) : null;
  const mapNum    = row.map_price && parseFloat(row.map_price) > 0 ? parseFloat(row.map_price) : null;
  const costNum   = row.dealer_cost && parseFloat(row.dealer_cost) > 0 ? parseFloat(row.dealer_cost) : null;
  const invQty    = row.inventory_qty ?? null;

  // Derive a "brand code" (uppercase slug) for facets/filtering
  const brandCode = row.brand.toUpperCase().replace(/\s+/g, "");

  // Finish: prefer the explicit FINISH field, fall back to COLOR
  const finish = row.finish || row.color || null;

  // Images: Blob URL preferred, CDN fallback while mirror is running
  const img1 = resolveImage(row.image1, row.image1_source);
  const img2 = resolveImage(row.image2, row.image2_source);
  const img3 = row.image3 || null;
  const img4 = row.image4 || null;
  const images = [img1, img2, img3, img4].filter((u): u is string => Boolean(u));

  // Bullet points: semicolon-delimited string → array
  const bulletPoints = row.bullet_points
    ? row.bullet_points.split(";").map((s) => s.trim()).filter(Boolean)
    : null;

  // Product description: use description (has full spec string like WheelPros product_desc)
  const productDesc = row.description ||
    `${row.brand} ${row.name || row.style_number || ""} ${finish || ""} ${row.diameter}"x${row.wheel_width}"`.trim();

  // Helper: convert null → undefined for TechfeedWheel compatibility
  const n2u = (v: string | null): string | undefined => v ?? undefined;

  return {
    // ── TechfeedWheel fields (compatible with fitment pipeline) ────────────
    sku:                   row.sku,
    product_desc:          n2u(productDesc),
    brand_cd:              n2u(brandCode),
    brand_desc:            n2u(row.brand),
    style:                 n2u(row.style_number),
    display_style_no:      n2u(row.style_number),

    diameter:              row.diameter,
    width:                 row.wheel_width,
    offset:                row.offset_mm ?? "0",
    centerbore:            n2u(row.hub),
    backspacing:           undefined,

    lug_count:             undefined,
    bolt_pattern_metric:   n2u(row.pcd1),    // "5x114.3" — used by validateWheel()
    bolt_pattern_standard: row.pcd1 ? toStandard(row.pcd1) : undefined, // "5-114.3"

    abbreviated_finish_desc: n2u(finish),
    fancy_finish_desc:       n2u(finish),
    box_label_desc:          n2u(row.short_description),

    // Pricing strings (consumed by getSafeWheelPrice)
    msrp:      msrpNum !== null ? String(msrpNum) : undefined,
    map_price: mapNum  !== null ? String(mapNum)  : undefined,

    images,

    // ── Wheel-1 supplier extensions ────────────────────────────────────────
    _supplier:     "wheel1",
    _msrpNum:      msrpNum,
    _mapNum:       mapNum,
    _dealerCost:   costNum,
    _inventoryQty: invQty,
    _freeShipping: true,          // freight baked into landed-cost pricing
    _w1: {
      brandFull:         row.brand,
      styleName:         row.name || row.style_number || null,
      isDually:          row.is_dually,
      isWinterApproved:  row.is_winter_approved,
      tpmsCompatible:    row.tpms_compatible,
      loadRating:        row.load_rating,
      structureWarranty: row.structure_warranty,
      bulletPoints,
      salesDescription:  row.sales_description,
      upc:               row.upc,
      countryOfOrigin:   row.country_of_origin,
      primaryWarehouse:  row.primary_warehouse,
    },
  } as Wheel1Candidate;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Compute the Wheel-1 sell price with shipping baked in.
 *
 * Formula:
 *   adjusted_cost = (dealer_cost ?? msrp * 0.68) + (diameter_inches * $1.00)
 *   sell_price    = max(adjusted_cost * 1.30, map_price)
 *
 * $1/inch shipping baked in so we can show "Free Shipping" on every Wheel-1
 * card without taking a loss. MAP is always the hard floor — never violated.
 * When dealer_cost is populated (from forthcoming Wheel-1 pricing feed) the
 * formula automatically uses the real cost instead of the MSRP estimate.
 */
export function computeWheel1SellPrice(params: {
  msrp:       number | null;
  mapPrice:   number | null;
  dealerCost: number | null;
  diameter:   number;
}): number {
  const { msrp, mapPrice, dealerCost, diameter } = params;
  const freightDollars = Math.max(0, diameter); // $1 per inch baked in

  // Cost: real dealer cost when available, otherwise estimate at 68% of MSRP
  const baseCost = dealerCost ?? (msrp ? msrp * 0.68 : null);
  if (!baseCost || baseCost <= 0) {
    // No cost data at all: return MAP or MSRP as-is (no freight adder on pure-MAP fallback)
    return mapPrice && mapPrice > 0 ? mapPrice : (msrp ?? 0);
  }

  // Landed cost = dealer cost + $1/inch freight
  const landedCost  = baseCost + freightDollars;
  const markupPrice = Math.round(landedCost * 1.30 * 100) / 100;

  // MAP is a hard floor — never advertise below MAP
  return mapPrice && mapPrice > 0 ? Math.max(markupPrice, mapPrice) : markupPrice;
}

/**
 * Return all active, non-discontinued Wheel-1 products matching the given
 * bolt pattern (matches pcd1 OR pcd2 for multi-fit wheels).
 *
 * Results are returned as Wheel1Candidate objects that extend TechfeedWheel,
 * ready to be concatenated with techfeed candidates and passed through the
 * existing fitment-validation + scoring pipeline.
 *
 * @param boltPattern  Fitment-search format: "5x114.3", "6x139.7", etc.
 */
export async function getWheel1CandidatesByBoltPattern(
  boltPattern: string
): Promise<Wheel1Candidate[]> {
  const bp = toBoltPatternDb(boltPattern);
  if (!bp) return [];

  const pool = getPool();
  try {
    const { rows } = await pool.query<Wheel1Row>(
      `SELECT
        sku, brand, name, style_number, description, short_description,
        diameter::text, wheel_width::text, hub::text, pcd1, pcd2,
        offset_mm::text, finish, color,
        msrp::text, map_price::text, dealer_cost::text, has_map,
        inventory_qty, primary_warehouse,
        image1, image2, image3, image4, image1_source, image2_source,
        load_rating, tpms_compatible, is_dually, is_winter_approved,
        structure_warranty, bullet_points, sales_description, upc, country_of_origin
      FROM wheel1_products
      WHERE (pcd1 = $1 OR pcd2 = $1)
        AND is_discontinued = FALSE
      ORDER BY
        -- In-stock first, then by price
        (COALESCE(inventory_qty, 0) > 0) DESC,
        msrp ASC`,
      [bp]
    );

    // requireStock=false: show all matching wheels (zero-stock shown with "check availability")
    // Set requireStock=true here once inventory sync is fully running and trusted
    return rows
      .map(row => mapRowToCandidate(row, false))
      .filter((c): c is Wheel1Candidate => c !== null);
  } catch (err) {
    // Never crash the primary search on a preview supplier failure
    console.error("[wheel1] getWheel1CandidatesByBoltPattern error:", (err as Error).message);
    return [];
  }
}

/**
 * Check whether the Wheel-1 preview flag is set on an incoming request.
 *
 * Activated by EITHER:
 *   - Query param: ?preview_suppliers=wheel1
 *   - Header:      x-wtd-preview: wheel1
 *
 * This deliberately requires an explicit opt-in so Wheel-1 products are never
 * surfaced to public users until the inventory + cost feeds are wired.
 */
export function isWheel1PreviewEnabled(request: Request): boolean {
  const url = new URL(request.url);
  const queryFlag = url.searchParams.get("preview_suppliers") || "";
  const headerFlag = request.headers.get("x-wtd-preview") || "";
  const combined = `${queryFlag},${headerFlag}`.toLowerCase();
  return combined.includes("wheel1");
}
