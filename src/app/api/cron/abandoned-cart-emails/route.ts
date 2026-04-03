/**
 * Abandoned Cart Email Cron Job
 * 
 * Schedule: Every 15 minutes (see vercel.json)
 * 
 * Processes the 3-email recovery sequence:
 * - Email 1: 1 hour after abandonment
 * - Email 2: 24 hours after abandonment
 * - Email 3: 48 hours after abandonment
 * 
 * Manual trigger: POST /api/cron/abandoned-cart-emails
 * Status check: GET /api/cron/abandoned-cart-emails
 * 
 * @created 2026-04-03
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { processAbandonedCarts } from "@/lib/cart/abandonedCartService";
import { 
  processAbandonedCartEmails,
  EMAIL_SAFE_MODE,
  EMAIL_SCHEDULE,
  findCartsForFirstEmail,
  findCartsForSecondEmail,
  findCartsForThirdEmail,
} from "@/lib/cart/abandonedCartEmail";

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
 * POST /api/cron/abandoned-cart-emails
 * Process abandoned cart emails
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
    console.log("[cron/abandoned-cart-emails] Starting processing...");

    // Step 1: Mark carts as abandoned (if inactive for 1+ hours)
    const abandonedCount = await processAbandonedCarts();
    console.log(`[cron/abandoned-cart-emails] Marked ${abandonedCount} carts as abandoned`);

    // Step 2: Send emails
    const emailResult = await processAbandonedCartEmails();
    console.log(`[cron/abandoned-cart-emails] Email results:`, {
      processed: emailResult.processed,
      sent: emailResult.sent,
      logged: emailResult.logged,
      skipped: emailResult.skipped,
      errors: emailResult.errors,
    });

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      safeMode: EMAIL_SAFE_MODE,
      abandonedCarts: abandonedCount,
      emails: {
        processed: emailResult.processed,
        sent: emailResult.sent,
        logged: emailResult.logged,
        skipped: emailResult.skipped,
        errors: emailResult.errors,
      },
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[cron/abandoned-cart-emails] Error:", err);
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
 * GET /api/cron/abandoned-cart-emails
 * Status check - shows pending carts
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
    const [first, second, third] = await Promise.all([
      findCartsForFirstEmail(),
      findCartsForSecondEmail(),
      findCartsForThirdEmail(),
    ]);

    return NextResponse.json({
      status: "ready",
      safeMode: EMAIL_SAFE_MODE,
      schedule: EMAIL_SCHEDULE,
      pending: {
        firstEmail: first.length,
        secondEmail: second.length,
        thirdEmail: third.length,
        total: first.length + second.length + third.length,
      },
      pendingCarts: {
        first: first.map(c => ({
          cartId: c.cartId,
          email: c.customerEmail,
          value: c.estimatedTotal,
          abandonedAt: c.abandonedAt,
        })),
        second: second.map(c => ({
          cartId: c.cartId,
          email: c.customerEmail,
          value: c.estimatedTotal,
          firstSentAt: c.firstEmailSentAt,
        })),
        third: third.map(c => ({
          cartId: c.cartId,
          email: c.customerEmail,
          value: c.estimatedTotal,
          secondSentAt: c.secondEmailSentAt,
        })),
      },
    });
  } catch (err: any) {
    console.error("[cron/abandoned-cart-emails] GET Error:", err);
    return NextResponse.json(
      { error: err?.message || "Status check failed" },
      { status: 500 }
    );
  }
}
