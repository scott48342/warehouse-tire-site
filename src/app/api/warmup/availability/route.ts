import { NextResponse } from "next/server";
import {
  runPrewarmJob,
  startPrewarmScheduler,
  stopPrewarmScheduler,
  isPrewarmRunning,
  isSchedulerRunning,
  PREWARM_TARGETS,
} from "@/lib/availabilityPrewarm";
import { getCacheStats, clearCache, resetMetrics, runHealthCheck } from "@/lib/availabilityCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300; // 5 minutes max for pre-warm

/**
 * GET /api/warmup/availability
 * 
 * Get pre-warm status and cache statistics.
 * 
 * Query params:
 * - action: "status" | "run" | "start-scheduler" | "stop-scheduler" | "clear-cache" | "reset-metrics"
 * - dryRun: "1" to simulate without actually checking availability
 * - targets: Comma-separated target names to warm (default: all)
 * - maxSkus: Max SKUs per pattern (default: 200)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "status";
  const dryRun = url.searchParams.get("dryRun") === "1";
  const targetNames = url.searchParams.get("targets")?.split(",").map(t => t.trim()).filter(Boolean);
  const maxSkus = Number(url.searchParams.get("maxSkus")) || undefined;
  
  const t0 = Date.now();
  
  try {
    switch (action) {
      case "status": {
        const [cacheStats, healthCheck] = await Promise.all([
          getCacheStats(),
          runHealthCheck(),
        ]);
        return NextResponse.json({
          ok: true,
          action: "status",
          prewarm: {
            running: isPrewarmRunning(),
            schedulerRunning: isSchedulerRunning(),
            targets: PREWARM_TARGETS.map(t => ({
              name: t.name,
              boltPattern: t.boltPattern,
              priority: t.priority,
            })),
          },
          cache: cacheStats,
          health: healthCheck,
          sharedCacheEnabled: healthCheck.redis.connected,
          at: new Date().toISOString(),
        });
      }
        
      case "run":
        // Filter targets if specified
        let targets = PREWARM_TARGETS;
        if (targetNames && targetNames.length > 0) {
          targets = PREWARM_TARGETS.filter(t => 
            targetNames.some(name => 
              t.name.toLowerCase().includes(name.toLowerCase()) ||
              t.boltPattern === name
            )
          );
          if (targets.length === 0) {
            return NextResponse.json({
              ok: false,
              error: `No matching targets found for: ${targetNames.join(", ")}`,
              availableTargets: PREWARM_TARGETS.map(t => t.name),
            }, { status: 400 });
          }
        }
        
        const result = await runPrewarmJob({
          targets,
          maxSkusPerPattern: maxSkus,
          dryRun,
        });
        
        return NextResponse.json({
          ok: result.success,
          action: "run",
          dryRun,
          result,
          at: new Date().toISOString(),
        });
        
      case "start-scheduler":
        startPrewarmScheduler();
        return NextResponse.json({
          ok: true,
          action: "start-scheduler",
          schedulerRunning: isSchedulerRunning(),
          at: new Date().toISOString(),
        });
        
      case "stop-scheduler":
        stopPrewarmScheduler();
        return NextResponse.json({
          ok: true,
          action: "stop-scheduler",
          schedulerRunning: isSchedulerRunning(),
          at: new Date().toISOString(),
        });
        
      case "clear-cache":
        await clearCache();
        return NextResponse.json({
          ok: true,
          action: "clear-cache",
          cache: await getCacheStats(),
          at: new Date().toISOString(),
        });
        
      case "reset-metrics":
        resetMetrics();
        return NextResponse.json({
          ok: true,
          action: "reset-metrics",
          cache: await getCacheStats(),
          at: new Date().toISOString(),
        });
        
      default:
        return NextResponse.json({
          ok: false,
          error: `Unknown action: ${action}`,
          validActions: ["status", "run", "start-scheduler", "stop-scheduler", "clear-cache", "reset-metrics"],
        }, { status: 400 });
    }
  } catch (err: any) {
    console.error("[warmup/availability] Error:", err);
    return NextResponse.json({
      ok: false,
      error: err?.message || String(err),
      at: new Date().toISOString(),
    }, { status: 500 });
  }
}

/**
 * POST /api/warmup/availability
 * 
 * Run pre-warm job (POST for mutation actions).
 * Accepts JSON body for configuration.
 */
export async function POST(req: Request) {
  const t0 = Date.now();
  
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // No body is fine
    }
    
    const dryRun = body.dryRun === true;
    const targetNames = Array.isArray(body.targets) ? body.targets : undefined;
    const maxSkus = typeof body.maxSkusPerPattern === "number" ? body.maxSkusPerPattern : undefined;
    const concurrency = typeof body.concurrency === "number" ? body.concurrency : undefined;
    
    // Filter targets if specified
    let targets = PREWARM_TARGETS;
    if (targetNames && targetNames.length > 0) {
      targets = PREWARM_TARGETS.filter(t => 
        targetNames.some((name: string) => 
          t.name.toLowerCase().includes(name.toLowerCase()) ||
          t.boltPattern === name
        )
      );
    }
    
    const result = await runPrewarmJob({
      targets,
      maxSkusPerPattern: maxSkus,
      concurrency,
      dryRun,
    });
    
    return NextResponse.json({
      ok: result.success,
      dryRun,
      result,
      totalMs: Date.now() - t0,
      at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[warmup/availability] POST Error:", err);
    return NextResponse.json({
      ok: false,
      error: err?.message || String(err),
      totalMs: Date.now() - t0,
      at: new Date().toISOString(),
    }, { status: 500 });
  }
}
