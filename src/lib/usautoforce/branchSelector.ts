/**
 * US AutoForce Branch Selector
 *
 * Picks the correct USAF fulfillment warehouse for a cart/order:
 * 1. Rank USAF warehouses by distance from the customer's destination ZIP.
 * 2. Run AIS StockCheck with the nearest branches as primary/alternates.
 * 3. Filter to branches where quantityAvailable >= requested quantity for
 *    EVERY USAF item in the cart.
 * 4. Choose the nearest stocking branch.
 * 5. If no nearby branch can fill the complete order, expand to ALL branches;
 *    as a last resort pick the branch that covers the most units
 *    (never blindly default to Wixom/Appleton).
 *
 * The selected branch is used for BOTH the freight-quote origin and the
 * <branch> element submitted with the USAF order, so the shipping quote
 * always matches actual fulfillment.
 *
 * @created 2026-09-03
 */

import zipcodes from "zipcodes";
import { checkStockBySize } from "./client";
import { USAUTOFORCE_WAREHOUSES } from "./warehouses";
import type { USAutoForceWarehouse } from "./types";

// ============================================================================
// TYPES
// ============================================================================

export interface UsafBranchItem {
  /** USAF part number (e.g., "358060") */
  partNumber: string;
  /** Quantity needed */
  quantity: number;
  /** Tire size (e.g., "285/70R17") - used for StockCheck; parsed from name if missing */
  size?: string;
  /** Product name - fallback source for size parsing */
  name?: string;
}

export interface UsafBranchSelection {
  /** Selected branch code (e.g., "4506") */
  branchCode: string;
  /** Full warehouse record */
  warehouse: USAutoForceWarehouse;
  /** Straight-line distance from warehouse to destination ZIP (miles) */
  distanceMiles: number;
  /** True if this branch can fill ALL items at full quantity */
  complete: boolean;
  /** Per-item availability at the selected branch */
  availability: Array<{ partNumber: string; requested: number; available: number }>;
  /** How the branch was chosen */
  method: "nearest-complete" | "expanded-complete" | "best-coverage" | "fallback-main";
}

interface RankedWarehouse {
  warehouse: USAutoForceWarehouse;
  distanceMiles: number;
}

// ============================================================================
// GEO HELPERS
// ============================================================================

const EARTH_RADIUS_MILES = 3958.8;

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
}

/** Warehouse coords are derived from warehouse ZIP (cached at module level) */
const warehouseCoordsCache = new Map<string, { lat: number; lon: number } | null>();

function getWarehouseCoords(w: USAutoForceWarehouse): { lat: number; lon: number } | null {
  if (warehouseCoordsCache.has(w.code)) return warehouseCoordsCache.get(w.code)!;
  const info = zipcodes.lookup(w.zip);
  const coords = info ? { lat: info.latitude, lon: info.longitude } : null;
  warehouseCoordsCache.set(w.code, coords);
  return coords;
}

/**
 * Get USAF warehouses ranked by distance from a destination ZIP.
 * Returns empty array if the destination ZIP can't be geocoded.
 */
export function getNearestWarehouses(destZip: string, limit?: number): RankedWarehouse[] {
  const dest = zipcodes.lookup(String(destZip).trim().slice(0, 5));
  if (!dest) return [];

  const ranked: RankedWarehouse[] = [];
  for (const w of USAUTOFORCE_WAREHOUSES) {
    const coords = getWarehouseCoords(w);
    if (!coords) continue;
    ranked.push({
      warehouse: w,
      distanceMiles: Math.round(haversineMiles(dest.latitude, dest.longitude, coords.lat, coords.lon)),
    });
  }
  ranked.sort((a, b) => a.distanceMiles - b.distanceMiles);
  return limit ? ranked.slice(0, limit) : ranked;
}

// ============================================================================
// SIZE PARSING
// ============================================================================

/** Parse a tire size like "285/70R17", "LT285/70R17", "P285/70R17" from a string */
export function parseTireSize(text?: string): string | null {
  if (!text) return null;
  const m = text.match(/\b(?:LT|P)?(\d{3})\/(\d{2,3})\s?Z?R(\d{2}(?:\.\d)?)\b/i);
  if (!m) return null;
  return `${m[1]}/${m[2]}R${m[3]}`;
}

// ============================================================================
// STOCK LOOKUP (per-branch availability)
// ============================================================================

/**
 * Query StockCheck for a set of sizes against a primary branch + alternates,
 * and build a map of partNumber -> branchCode -> quantityAvailable.
 */
async function getBranchAvailability(
  sizes: string[],
  primaryBranch: string,
  alternateBranches: string[]
): Promise<Map<string, Map<string, number>>> {
  const availability = new Map<string, Map<string, number>>();

  // Query each unique size (usually just 1-2 per cart)
  for (const size of sizes) {
    try {
      const result = await checkStockBySize(size, {
        branch: primaryBranch,
        alternateBranches,
        quantity: 1, // get everything; we filter quantities ourselves
      });

      if (!result.success) continue;

      for (const item of result.items) {
        if (!availability.has(item.partNumber)) {
          availability.set(item.partNumber, new Map());
        }
        const branchMap = availability.get(item.partNumber)!;
        for (const wh of item.availability || []) {
          const qty = Number(wh.quantityAvailable) || 0;
          // Keep the max seen per branch (defensive against dupes)
          branchMap.set(wh.code, Math.max(branchMap.get(wh.code) || 0, qty));
        }
      }
    } catch (err) {
      console.error(`[usaf-branch] StockCheck failed for size ${size}:`, err);
    }
  }

  return availability;
}

/**
 * Given availability + ranked branches, find the nearest branch that can
 * fill EVERY item at full quantity.
 */
function findNearestCompleteBranch(
  items: Array<{ partNumber: string; quantity: number }>,
  availability: Map<string, Map<string, number>>,
  rankedBranches: RankedWarehouse[]
): RankedWarehouse | null {
  for (const ranked of rankedBranches) {
    const code = ranked.warehouse.code;
    const coversAll = items.every(item => {
      const branchMap = availability.get(item.partNumber);
      if (!branchMap) return false;
      return (branchMap.get(code) || 0) >= item.quantity;
    });
    if (coversAll) return ranked;
  }
  return null;
}

/**
 * Find the branch covering the most total units (tie-break: nearest).
 */
function findBestCoverageBranch(
  items: Array<{ partNumber: string; quantity: number }>,
  availability: Map<string, Map<string, number>>,
  rankedBranches: RankedWarehouse[]
): RankedWarehouse | null {
  let best: { ranked: RankedWarehouse; units: number } | null = null;

  for (const ranked of rankedBranches) {
    const code = ranked.warehouse.code;
    let units = 0;
    for (const item of items) {
      const avail = availability.get(item.partNumber)?.get(code) || 0;
      units += Math.min(avail, item.quantity);
    }
    if (units > 0 && (!best || units > best.units)) {
      best = { ranked, units };
    }
  }

  return best?.ranked || null;
}

function buildAvailabilityReport(
  items: Array<{ partNumber: string; quantity: number }>,
  availability: Map<string, Map<string, number>>,
  branchCode: string
): UsafBranchSelection["availability"] {
  return items.map(item => ({
    partNumber: item.partNumber,
    requested: item.quantity,
    available: availability.get(item.partNumber)?.get(branchCode) || 0,
  }));
}

// ============================================================================
// CACHE (short-lived, per serverless instance)
// ============================================================================

const selectionCache = new Map<string, { at: number; value: UsafBranchSelection | null }>();
const SELECTION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

function cacheKey(items: UsafBranchItem[], destZip: string): string {
  const parts = items
    .map(i => `${i.partNumber}x${i.quantity}`)
    .sort()
    .join(",");
  return `${destZip}:${parts}`;
}

// ============================================================================
// MAIN SELECTOR
// ============================================================================

/** How many nearby branches to check in the first pass */
const NEARBY_BRANCH_COUNT = 12;

/**
 * Select the USAF fulfillment branch for a set of items shipping to destZip.
 *
 * Returns null only if the destination can't be geocoded AND no stock exists
 * anywhere. Callers should treat null as "use legacy default behavior".
 */
export async function selectUsafBranch(
  items: UsafBranchItem[],
  destZip: string
): Promise<UsafBranchSelection | null> {
  if (!items.length) return null;

  const key = cacheKey(items, destZip);
  const cached = selectionCache.get(key);
  if (cached && Date.now() - cached.at < SELECTION_CACHE_TTL_MS) {
    return cached.value;
  }

  const result = await selectUsafBranchUncached(items, destZip);
  selectionCache.set(key, { at: Date.now(), value: result });
  return result;
}

/**
 * Convenience wrapper for checkout quote lines.
 * Filters to USAF-sourced tire/wheel lines and selects the fulfillment branch.
 * Returns null when the cart has no USAF items.
 */
export async function selectUsafBranchForCartLines(
  lines: Array<{ sku?: string; name: string; qty: number; meta?: Record<string, unknown> }>,
  destZip: string
): Promise<UsafBranchSelection | null> {
  const usafLines = lines.filter(l => {
    if (!l.sku) return false;
    const cartType = String((l.meta as any)?.cartType || "");
    if (cartType !== "tire" && cartType !== "wheel") return false;
    const source = String((l.meta as any)?.source || "").toLowerCase();
    return source.includes("usautoforce") || source === "usaf";
  });

  if (usafLines.length === 0) return null;

  return selectUsafBranch(
    usafLines.map(l => ({ partNumber: l.sku!, quantity: l.qty, name: l.name })),
    destZip
  );
}

async function selectUsafBranchUncached(
  items: UsafBranchItem[],
  destZip: string
): Promise<UsafBranchSelection | null> {
  // Resolve sizes for StockCheck (from explicit size or parsed from name)
  const sizes = [...new Set(
    items
      .map(i => i.size || parseTireSize(i.name) || parseTireSize(i.partNumber))
      .filter((s): s is string => !!s)
  )];

  if (sizes.length === 0) {
    console.warn("[usaf-branch] No tire sizes resolvable for items; cannot select branch");
    return null;
  }

  const neededItems = items.map(i => ({ partNumber: i.partNumber, quantity: i.quantity }));

  // Rank all warehouses by distance
  const allRanked = getNearestWarehouses(destZip);
  if (allRanked.length === 0) {
    console.warn(`[usaf-branch] Could not geocode destination ZIP ${destZip}`);
    return null;
  }

  // ---- PASS 1: nearest N branches ----
  const nearby = allRanked.slice(0, NEARBY_BRANCH_COUNT);
  const nearbyCodes = nearby.map(r => r.warehouse.code);

  let availability = await getBranchAvailability(
    sizes,
    nearbyCodes[0],
    nearbyCodes.slice(1)
  );

  let selected = findNearestCompleteBranch(neededItems, availability, nearby);
  if (selected) {
    const sel: UsafBranchSelection = {
      branchCode: selected.warehouse.code,
      warehouse: selected.warehouse,
      distanceMiles: selected.distanceMiles,
      complete: true,
      availability: buildAvailabilityReport(neededItems, availability, selected.warehouse.code),
      method: "nearest-complete",
    };
    console.log(`[usaf-branch] Selected ${sel.branchCode} (${sel.warehouse.city}, ${sel.warehouse.state}) - ${sel.distanceMiles}mi, complete stock`);
    return sel;
  }

  // ---- PASS 2: expand to ALL branches ----
  const remainingCodes = allRanked.slice(NEARBY_BRANCH_COUNT).map(r => r.warehouse.code);
  if (remainingCodes.length > 0) {
    const expandedAvailability = await getBranchAvailability(
      sizes,
      remainingCodes[0],
      remainingCodes.slice(1)
    );

    // Merge into the existing availability map
    for (const [pn, branchMap] of expandedAvailability) {
      if (!availability.has(pn)) availability.set(pn, new Map());
      const existing = availability.get(pn)!;
      for (const [code, qty] of branchMap) {
        existing.set(code, Math.max(existing.get(code) || 0, qty));
      }
    }

    selected = findNearestCompleteBranch(neededItems, availability, allRanked);
    if (selected) {
      const sel: UsafBranchSelection = {
        branchCode: selected.warehouse.code,
        warehouse: selected.warehouse,
        distanceMiles: selected.distanceMiles,
        complete: true,
        availability: buildAvailabilityReport(neededItems, availability, selected.warehouse.code),
        method: "expanded-complete",
      };
      console.log(`[usaf-branch] Selected ${sel.branchCode} (${sel.warehouse.city}, ${sel.warehouse.state}) - ${sel.distanceMiles}mi, complete stock (expanded search)`);
      return sel;
    }
  }

  // ---- PASS 3: best coverage (partial) ----
  const bestCoverage = findBestCoverageBranch(neededItems, availability, allRanked);
  if (bestCoverage) {
    const sel: UsafBranchSelection = {
      branchCode: bestCoverage.warehouse.code,
      warehouse: bestCoverage.warehouse,
      distanceMiles: bestCoverage.distanceMiles,
      complete: false,
      availability: buildAvailabilityReport(neededItems, availability, bestCoverage.warehouse.code),
      method: "best-coverage",
    };
    console.warn(`[usaf-branch] No branch has complete stock; selected ${sel.branchCode} (${sel.warehouse.city}, ${sel.warehouse.state}) with best coverage`);
    return sel;
  }

  // ---- PASS 4: nothing anywhere - fall back to main warehouse (Appleton) ----
  const main = allRanked.find(r => r.warehouse.code === "4101");
  if (main) {
    const sel: UsafBranchSelection = {
      branchCode: "4101",
      warehouse: main.warehouse,
      distanceMiles: main.distanceMiles,
      complete: false,
      availability: buildAvailabilityReport(neededItems, availability, "4101"),
      method: "fallback-main",
    };
    console.warn(`[usaf-branch] No stock found at any branch; falling back to main warehouse 4101`);
    return sel;
  }

  return null;
}
