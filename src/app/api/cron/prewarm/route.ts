/**
 * Cron Job: Prewarm Availability Cache
 * 
 * Triggered every 25 minutes by Vercel Cron.
 * Keeps the shared Redis cache warm for common vehicle searches.
 * 
 * Schedule: every 25 minutes (cron: 0,25,50 * * * *)
 * This ensures cache stays warm before 30-minute TTL expires.
 */

import { NextResponse } from "next/server";
import { runPrewarmJob, PREWARM_TARGETS } from "@/lib/availabilityPrewarm";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max

/**
 * Verify the request is from Vercel Cron (not a random caller)
 */
function isValidCronRequest(req: Request): boolean {
  // Vercel sends this header for cron jobs
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  // If CRON_SECRET is set, verify it
  if (cronSecret) {
    return authHeader === `Bearer ${cronSecret}`;
  }
  
  // In development or if no secret set, allow all
  // Vercel Cron jobs are authenticated at the infrastructure level
  return true;
}

export async function GET(req: Request) {
  // Optional: verify cron authenticity
  if (!isValidCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const t0 = Date.now();
  
  // Only run Priority 1 targets in cron (must complete in 300s)
  // Priority 1 = F-150, Silverado 1500, Ram 1500 (3 patterns × 150 SKUs = ~450 checks)
  // Full prewarm can be triggered manually via /api/warmup/availability?action=run
  const priority1Targets = PREWARM_TARGETS.filter(t => t.priority === 1);
  
  console.log(`[cron/prewarm] Starting scheduled prewarm job (${priority1Targets.length} priority-1 targets)...`);
  
  try {
    const result = await runPrewarmJob({
      // Only Priority 1 targets for cron (keeps under 5 min)
      targets: priority1Targets,
      // Reduced SKUs per pattern to ensure completion
      maxSkusPerPattern: 150,
      concurrency: 8,
    });
    
    console.log(`[cron/prewarm] Priority-1 completed in ${result.duration}ms:`, {
      targets: result.targetsProcessed,
      checked: result.totalSkusChecked,
      available: result.totalSkusAvailable,
      cached: result.totalSkusCached,
      errors: result.errors.length,
    });
    
    return NextResponse.json({
      ok: true,
      duration: result.duration,
      summary: {
        targetsProcessed: result.targetsProcessed,
        totalSkusChecked: result.totalSkusChecked,
        totalSkusAvailable: result.totalSkusAvailable,
        totalSkusCached: result.totalSkusCached,
        errors: result.errors.length,
      },
      // Include target breakdown for monitoring
      targets: result.targetResults.map(t => ({
        name: t.name,
        boltPattern: t.boltPattern,
        checked: t.checked,
        cached: t.cached,
        durationMs: t.durationMs,
      })),
      at: new Date().toISOString(),
    });
    
  } catch (error: any) {
    console.error("[cron/prewarm] Job failed:", error);
    
    return NextResponse.json({
      ok: false,
      error: error?.message || String(error),
      duration: Date.now() - t0,
      at: new Date().toISOString(),
    }, { status: 500 });
  }
}
