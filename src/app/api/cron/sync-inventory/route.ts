/**
 * Cron Job: Sync Inventory from WheelPros SFTP
 * 
 * Triggered every 2 hours by Vercel Cron.
 * Downloads the inventory feed and caches to Redis.
 * 
 * Schedule: every 2 hours (cron: 0 0,2,4,6,8,10,12,14,16,18,20,22 * * *)
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max (feed is ~38MB)

// Dynamic import to avoid Turbopack bundling ssh2 at build time
async function getInventorySync() {
  return import("@/lib/inventorySync");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "run";
  
  // Status check
  if (action === "status") {
    const { getLastSyncResult } = await getInventorySync();
    const lastResult = getLastSyncResult();
    return NextResponse.json({
      ok: true,
      action: "status",
      lastSync: lastResult,
      at: new Date().toISOString(),
    });
  }
  
  // Run sync
  console.log("[cron/sync-inventory] Starting inventory sync...");
  const t0 = Date.now();
  
  try {
    const { runInventorySyncAndStore } = await getInventorySync();
    const result = await runInventorySyncAndStore();
    
    console.log(`[cron/sync-inventory] Completed in ${result.durationMs}ms:`, {
      processed: result.recordsProcessed,
      cached: result.recordsCached,
      errors: result.errors.length,
    });
    
    return NextResponse.json({
      ok: result.success,
      action: "sync",
      result,
      at: new Date().toISOString(),
    });
    
  } catch (error: any) {
    console.error("[cron/sync-inventory] Sync failed:", error);
    
    return NextResponse.json({
      ok: false,
      error: error?.message || String(error),
      durationMs: Date.now() - t0,
      at: new Date().toISOString(),
    }, { status: 500 });
  }
}
