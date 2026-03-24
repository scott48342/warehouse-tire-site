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
  
  console.log("[cron/prewarm] Starting scheduled prewarm job...");
  
  try {
    const result = await runPrewarmJob({
      // Use all configured targets
      targets: PREWARM_TARGETS,
      // Standard settings
      maxSkusPerPattern: 200,
      concurrency: 8,
    });
    
    console.log(`[cron/prewarm] Completed in ${result.duration}ms:`, {
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
