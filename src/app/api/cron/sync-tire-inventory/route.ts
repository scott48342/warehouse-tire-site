/**
 * Cron Job: Sync Tire Inventory from WheelPros SFTP
 * 
 * Triggered every 2 hours by Vercel Cron.
 * Downloads the tire inventory feed and updates wp_inventory in Postgres.
 * 
 * Schedule: every 2 hours (cron: 0 1,3,5,7,9,11,13,15,17,19,21,23 * * *)
 * Offset by 1 hour from wheel inventory sync to spread load.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max

// Dynamic import to avoid Turbopack bundling ssh2 at build time
async function getTireInventorySync() {
  return import("@/lib/tireInventorySync");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "run";
  
  // Status check
  if (action === "status") {
    const { getLastTireSyncResult } = await getTireInventorySync();
    const lastResult = getLastTireSyncResult();
    return NextResponse.json({
      ok: true,
      action: "status",
      lastSync: lastResult,
      at: new Date().toISOString(),
    });
  }
  
  // Run sync
  console.log("[cron/sync-tire-inventory] Starting tire inventory sync...");
  const t0 = Date.now();
  
  try {
    const { runTireInventorySync } = await getTireInventorySync();
    const result = await runTireInventorySync();
    
    console.log(`[cron/sync-tire-inventory] Completed in ${result.durationMs}ms:`, {
      processed: result.recordsProcessed,
      updated: result.recordsUpdated,
      errors: result.errors.length,
    });
    
    return NextResponse.json({
      ok: result.success,
      action: "sync",
      result,
      at: new Date().toISOString(),
    });
    
  } catch (error: any) {
    console.error("[cron/sync-tire-inventory] Sync failed:", error);
    
    return NextResponse.json({
      ok: false,
      error: error?.message || String(error),
      durationMs: Date.now() - t0,
      at: new Date().toISOString(),
    }, { status: 500 });
  }
}
