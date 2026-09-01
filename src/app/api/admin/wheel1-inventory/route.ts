/**
 * Admin API: Wheel-1 Inventory Sync
 *
 * GET  /api/admin/wheel1-inventory          → sync status + last run stats
 * POST /api/admin/wheel1-inventory          → trigger manual sync
 * POST /api/admin/wheel1-inventory?action=probe → probe API fields (safe read-only)
 *
 * Protected by ADMIN_API_KEY header.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/vehicleFitment";
import { runWheel1InventorySync } from "@/lib/wheel1/inventorySync";

const ADMIN_KEY   = process.env.ADMIN_API_KEY;
const WHEEL1_KEY  = process.env.WHEEL1_API_KEY;
const BASE_URL    = "https://api.thewheelgroup.info/api/v1";

function isAuthorized(req: NextRequest): boolean {
  const key = req.headers.get("x-admin-key") || req.headers.get("authorization")?.replace("Bearer ", "");
  return !!ADMIN_KEY && key === ADMIN_KEY;
}

// ─── GET: status ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = getPool();
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) as total_skus,
        COUNT(*) FILTER (WHERE inventory_qty > 0)   as in_stock,
        COUNT(*) FILTER (WHERE inventory_qty = 0)   as out_of_stock,
        COUNT(*) FILTER (WHERE inventory_qty IS NULL) as not_synced,
        COUNT(*) FILTER (WHERE dealer_cost IS NOT NULL) as has_real_cost,
        COUNT(*) FILTER (WHERE map_price IS NOT NULL)   as has_map,
        MIN(inventory_synced_at) as oldest_sync,
        MAX(inventory_synced_at) as latest_sync,
        -- Cost coverage breakdown
        COUNT(*) FILTER (WHERE dealer_cost IS NULL AND msrp IS NOT NULL) as using_estimated_cost
      FROM wheel1_products
      WHERE is_discontinued = FALSE
    `);

    const stats = rows[0];

    return NextResponse.json({
      supplier: "wheel1",
      apiKeyConfigured: !!WHEEL1_KEY,
      stats: {
        totalSkus:        parseInt(stats.total_skus),
        inStock:          parseInt(stats.in_stock),
        outOfStock:       parseInt(stats.out_of_stock),
        notSynced:        parseInt(stats.not_synced),
        hasRealCost:      parseInt(stats.has_real_cost),
        hasMap:           parseInt(stats.has_map),
        usingEstimatedCost: parseInt(stats.using_estimated_cost),
        oldestSync:       stats.oldest_sync,
        latestSync:       stats.latest_sync,
      },
      pricingFormula: {
        landedCost:  "dealer_cost + (diameter_inches × $1.00)",
        sellPrice:   "max(landedCost × 1.30, map_price)",
        costFallback: "msrp × 0.68 when dealer_cost is null",
        freeShipping: "freight baked in - customer sees FREE SHIPPING",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// ─── POST: sync or probe ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const action = req.nextUrl.searchParams.get("action");

  // Probe: safe read-only field discovery
  if (action === "probe") {
    if (!WHEEL1_KEY) {
      return NextResponse.json({ error: "WHEEL1_API_KEY not configured" }, { status: 400 });
    }

    try {
      const res = await fetch(`${BASE_URL}/inventory`, {
        headers: { "X-API-Key": WHEEL1_KEY, Accept: "application/json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        return NextResponse.json({ error: `API ${res.status}` }, { status: res.status });
      }

      const data = await res.json();
      const records = Array.isArray(data) ? data
        : (data.data ?? data.items ?? data.results ?? []);

      const sample   = records.slice(0, 3);
      const fields   = sample[0] ? Object.keys(sample[0]) : [];

      return NextResponse.json({
        recordCount: records.length,
        fields,
        sample,
        skuCandidates:  fields.filter(f => /sku|part|item|number/i.test(f)),
        costCandidates: fields.filter(f => /cost|price|dealer|net/i.test(f)),
        mapCandidates:  fields.filter(f => /map/i.test(f)),
        qtyCandidates:  fields.filter(f => /qty|quant|stock|count|inv|on.hand/i.test(f)),
        whCandidates:   fields.filter(f => /warehouse|location|wh|depot/i.test(f)),
      });
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
  }

  // Full sync
  if (!WHEEL1_KEY) {
    return NextResponse.json({
      error: "WHEEL1_API_KEY not configured in environment",
      hint: "Add WHEEL1_API_KEY=<your_key> to Vercel environment variables",
    }, { status: 400 });
  }

  const result = await runWheel1InventorySync(WHEEL1_KEY);

  return NextResponse.json(result, {
    status: result.success ? 200 : 500,
  });
}
