/**
 * Admin API: Wheel-Size Guard Status & Logs
 * 
 * GET /api/admin/wheel-size-guard - View status, logs, usage stats
 * POST /api/admin/wheel-size-guard - Reset counters (admin only)
 */

import { NextResponse } from "next/server";
import {
  wheelSizeGuard,
  WHEEL_SIZE_SAFE_MODE,
  BATCH_RATE_LIMIT,
  USAGE_THRESHOLDS,
} from "@/lib/wheelSizeGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: View guard status, logs, and usage stats
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const view = url.searchParams.get("view") || "status";
  const limit = parseInt(url.searchParams.get("limit") || "50", 10);
  
  switch (view) {
    case "logs":
      return NextResponse.json({
        logs: wheelSizeGuard.getRecentLogs(limit),
        stats: wheelSizeGuard.getLogStats(),
      });
      
    case "admin-logs":
      return NextResponse.json({
        adminLogs: wheelSizeGuard.getAdminLogs(limit),
      });
      
    case "usage":
      return NextResponse.json({
        usage: wheelSizeGuard.getUsageStats(),
        thresholds: USAGE_THRESHOLDS,
      });
      
    case "status":
    default:
      return NextResponse.json({
        safeModeEnabled: WHEEL_SIZE_SAFE_MODE,
        config: {
          batchRateLimit: {
            minIntervalMinutes: BATCH_RATE_LIMIT.minIntervalMs / 60000,
            maxConcurrent: BATCH_RATE_LIMIT.maxConcurrent,
          },
          usageThresholds: USAGE_THRESHOLDS,
        },
        currentStatus: {
          usage: wheelSizeGuard.getUsageStats(),
          logStats: wheelSizeGuard.getLogStats(),
        },
        protectedEndpoints: [
          "POST /api/admin/catalog { action: 'populate-common' }",
          "POST /api/admin/fitment/import",
          "POST /api/admin/fitment/refresh-trims",
        ],
        documentation: {
          safeMode: "WHEEL_SIZE_SAFE_MODE=true blocks cron/background calls",
          batchJobs: "Require { confirm: true, allowBatch: true } flags",
          rateLimit: "15 min between batch runs, 1 concurrent max",
          hardLimit: "1000 calls/hour triggers automatic block",
        },
      });
  }
}

/**
 * POST: Admin actions (reset counters, etc.)
 * 
 * Body: { action: "reset-counters" | "test-block" }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;
    
    switch (action) {
      case "test-safe-mode":
        // Test if current request would be blocked
        const blockReason = wheelSizeGuard.checkSafeModeBlock();
        const triggerSource = wheelSizeGuard.detectTriggerSource();
        return NextResponse.json({
          wouldBeBlocked: !!blockReason,
          reason: blockReason,
          triggerSource,
          safeModeEnabled: WHEEL_SIZE_SAFE_MODE,
        });
        
      case "test-batch":
        // Test if a batch job would be allowed
        const batchCheck = wheelSizeGuard.checkBatchJobAllowed({
          action: "test",
          confirm: body.confirm,
          allowBatch: body.allowBatch,
          adminId: "test",
        });
        return NextResponse.json({
          batchCheck,
        });
        
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Invalid request" },
      { status: 400 }
    );
  }
}
