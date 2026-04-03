/**
 * Cron Job: Sync Techfeed from WheelPros SFTP
 * 
 * Triggered daily by Vercel Cron.
 * Downloads the TechGuide CSV and rebuilds wheels_by_sku.json.gz
 * 
 * Schedule: Daily at 3 AM EST (cron: 0 8 * * *)
 * 
 * NOTE: This updates the product catalog (specs, images, pricing).
 * Inventory sync (sync-inventory) handles stock quantities separately.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max (CSV is ~50-100MB)

// Dynamic import to avoid Turbopack bundling ssh2 at build time
async function getTechfeedSync() {
  return import("@/lib/techfeedSync");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "run";
  
  // Status check
  if (action === "status") {
    const { getLastTechfeedSyncResult } = await getTechfeedSync();
    const lastResult = getLastTechfeedSyncResult();
    return NextResponse.json({
      ok: true,
      action: "status",
      lastSync: lastResult,
      at: new Date().toISOString(),
    });
  }
  
  // Run sync
  console.log("[cron/sync-techfeed] Starting techfeed sync...");
  const t0 = Date.now();
  
  try {
    const { runTechfeedSync } = await getTechfeedSync();
    const result = await runTechfeedSync();
    
    console.log(`[cron/sync-techfeed] Completed in ${result.durationMs}ms:`, {
      skus: result.skusProcessed,
      styles: result.stylesProcessed,
      feedMB: (result.feedSize / 1024 / 1024).toFixed(2),
      errors: result.errors.length,
    });
    
    return NextResponse.json({
      ok: result.success,
      action: "sync",
      result,
      at: new Date().toISOString(),
    });
    
  } catch (error: any) {
    console.error("[cron/sync-techfeed] Sync failed:", error);
    
    return NextResponse.json({
      ok: false,
      error: error?.message || String(error),
      durationMs: Date.now() - t0,
      at: new Date().toISOString(),
    }, { status: 500 });
  }
}
