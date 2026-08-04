/**
 * Vercel Cron: Sync Wheel-1 Inventory
 * Schedule: every 4 hours  (vercel.json: "0 * /4 * * *" — no space in actual config)
 *
 * Fetches live inventory from The Wheel Group API and upserts:
 *   - inventory_qty, warehouse_stock, primary_warehouse
 *   - dealer_cost (real cost replaces MSRP estimate)
 *   - map_price (fills gaps in catalog MAP data)
 */

import { NextRequest, NextResponse } from "next/server";
import { runWheel1InventorySync } from "@/lib/wheel1/inventorySync";

export const maxDuration = 300; // 5 minutes (Vercel Pro limit)
export const dynamic     = "force-dynamic";

export async function GET(req: NextRequest) {
  // Protect against external hits.
  // FIX (2026-08-04): Vercel cron does NOT send "x-vercel-cron-signature".
  // When CRON_SECRET is set, Vercel sends "Authorization: Bearer <CRON_SECRET>".
  // The old header check 401'd every scheduled run — this cron never fired
  // (inventory was stale since 6/30, only manual admin-key runs worked).
  const authHeader = req.headers.get("authorization");
  const validCron  = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const adminKey   = req.headers.get("x-admin-key");
  const validAdmin = !!process.env.ADMIN_API_KEY && adminKey === process.env.ADMIN_API_KEY;

  if (!validCron && !validAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.WHEEL1_API_KEY;
  if (!apiKey) {
    console.warn("[cron/sync-wheel1-inventory] WHEEL1_API_KEY not set — skipping");
    return NextResponse.json({
      skipped: true,
      reason: "WHEEL1_API_KEY not configured",
    });
  }

  const result = await runWheel1InventorySync(apiKey);

  return NextResponse.json(result, {
    status: result.success ? 200 : 500,
  });
}
