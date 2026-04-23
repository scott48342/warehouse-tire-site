/**
 * Email Automation Cron Job
 * 
 * Schedule: Every 15 minutes (see vercel.json)
 * 
 * Processes all automation flows:
 * - Abandoned cart emails (1h, 24h, 48h)
 * - Exit intent follow-up emails (24h)
 * 
 * Manual trigger: POST /api/cron/email-automation
 * Status check: GET /api/cron/email-automation
 * 
 * @created 2026-04-23
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { processAllAutomations, getAutomationStats } from "@/lib/email/automation";
import { processAbandonedCarts } from "@/lib/cart/abandonedCartService";

export const runtime = "nodejs";
export const maxDuration = 60; // Allow up to 60 seconds for processing

// Secret for manual triggers (optional extra security)
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Verify the request is from Vercel Cron or authorized
 */
async function verifyRequest(req: Request): Promise<boolean> {
  const headersList = await headers();
  
  // Vercel Cron includes this header
  const isVercelCron = headersList.get("x-vercel-cron") === "true";
  if (isVercelCron) return true;

  // Allow manual trigger with secret
  if (CRON_SECRET) {
    const authHeader = headersList.get("authorization");
    if (authHeader === `Bearer ${CRON_SECRET}`) return true;
  }

  // In development, allow all
  if (process.env.NODE_ENV === "development") return true;

  return false;
}

/**
 * POST /api/cron/email-automation
 * Process all email automations
 */
export async function POST(req: Request) {
  const authorized = await verifyRequest(req);
  if (!authorized) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const startTime = Date.now();
  
  try {
    console.log("[cron/email-automation] Starting processing...");

    // Step 1: Mark carts as abandoned (if inactive for 1+ hours)
    let abandonedCount = 0;
    try {
      abandonedCount = await processAbandonedCarts();
      console.log(`[cron/email-automation] Marked ${abandonedCount} carts as abandoned`);
    } catch (err: any) {
      console.error(`[cron/email-automation] Failed to process abandoned carts:`, err.message);
    }

    // Step 2: Process all email automations
    const result = await processAllAutomations();
    
    console.log(`[cron/email-automation] Complete:`, {
      abandonedCarts: result.abandonedCart,
      exitIntent: result.exitIntent,
      durationMs: result.durationMs,
    });

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      safeMode: result.safeMode,
      cartsMarkedAbandoned: abandonedCount,
      abandonedCartEmails: result.abandonedCart,
      exitIntentEmails: result.exitIntent,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[cron/email-automation] Error:", err);
    return NextResponse.json(
      { 
        success: false, 
        error: err?.message || "Processing failed",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/email-automation
 * Status check - shows pending items
 */
export async function GET(req: Request) {
  const authorized = await verifyRequest(req);
  if (!authorized) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const stats = await getAutomationStats();

    return NextResponse.json({
      status: "ready",
      safeMode: stats.safeMode,
      pending: {
        exitIntentFollowups: stats.queue.exitIntentPending,
        abandonedCartEmails: {
          first: stats.queue.abandonedCartPending.first,
          second: stats.queue.abandonedCartPending.second,
          third: stats.queue.abandonedCartPending.third,
          total: stats.queue.abandonedCartPending.first + 
                 stats.queue.abandonedCartPending.second + 
                 stats.queue.abandonedCartPending.third,
        },
      },
    });
  } catch (err: any) {
    console.error("[cron/email-automation] GET Error:", err);
    return NextResponse.json(
      { error: err?.message || "Status check failed" },
      { status: 500 }
    );
  }
}
