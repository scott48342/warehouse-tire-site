/**
 * Daily Executive Report Cron Endpoint
 * 
 * GET /api/cron/daily-executive-report
 * 
 * Sends the daily executive summary email.
 * 
 * Security:
 * - Requires CRON_SECRET header or query param
 * - Duplicate-send protection (won't send same report twice)
 * 
 * Options:
 * - ?dryRun=true - Generate report without sending
 * - ?force=true - Send even if already sent today
 * - ?testEmail=x@y.com - Send to test recipient
 * 
 * Schedule: Daily at 8:00 AM Eastern Time
 * Vercel Cron: 0 12 * * * (12:00 UTC = 8:00 AM EDT)
 * 
 * @created 2026-06-11
 */

import { NextRequest, NextResponse } from "next/server";
import { sendExecutiveReport, getLastSuccessfulSend } from "@/lib/executive-report";

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY
// ═══════════════════════════════════════════════════════════════════════════════

function validateCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  
  // In development, allow without secret
  if (process.env.NODE_ENV === "development" && !cronSecret) {
    console.log("[cron/executive-report] Development mode - skipping auth");
    return true;
  }
  
  if (!cronSecret) {
    console.error("[cron/executive-report] CRON_SECRET not configured");
    return false;
  }
  
  // Check header (Vercel Cron uses this)
  const headerSecret = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (headerSecret === cronSecret) {
    return true;
  }
  
  // Check query param (for manual testing)
  const querySecret = request.nextUrl.searchParams.get("secret");
  if (querySecret === cronSecret) {
    return true;
  }
  
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  // Validate secret
  if (!validateCronSecret(request)) {
    console.error("[cron/executive-report] Unauthorized request");
    return NextResponse.json(
      { ok: false, error: "Unauthorized - invalid or missing CRON_SECRET" },
      { status: 401 }
    );
  }
  
  // Parse options
  const searchParams = request.nextUrl.searchParams;
  const dryRun = searchParams.get("dryRun") === "true";
  const force = searchParams.get("force") === "true";
  const testEmail = searchParams.get("testEmail");
  
  console.log(`[cron/executive-report] Starting (dryRun=${dryRun}, force=${force}, testEmail=${testEmail || "none"})`);
  
  // Production-only check (unless dry run or force)
  if (process.env.NODE_ENV !== "production" && !dryRun && !force && !testEmail) {
    console.log("[cron/executive-report] Not production - skipping actual send");
    return NextResponse.json({
      ok: true,
      message: "Skipped - not production environment. Use dryRun=true or force=true to test.",
      environment: process.env.NODE_ENV,
    });
  }
  
  try {
    const result = await sendExecutiveReport({
      force,
      dryRun,
      testRecipient: testEmail || undefined,
    });
    
    const duration = Date.now() - startTime;
    
    if (result.success) {
      if (result.alreadySent) {
        console.log(`[cron/executive-report] Report already sent for ${result.reportDate}`);
        return NextResponse.json({
          ok: true,
          message: "Report already sent for this date",
          reportDate: result.reportDate,
          recipient: result.recipient,
          duration,
        });
      }
      
      if (result.dryRun) {
        console.log(`[cron/executive-report] Dry run completed for ${result.reportDate}`);
        return NextResponse.json({
          ok: true,
          message: "Dry run completed - email not sent",
          reportDate: result.reportDate,
          recipient: result.recipient,
          data: result.data,
          html: result.html,
          duration,
        });
      }
      
      console.log(`[cron/executive-report] Email sent successfully: ${result.messageId}`);
      return NextResponse.json({
        ok: true,
        message: "Executive report sent successfully",
        reportDate: result.reportDate,
        recipient: result.recipient,
        messageId: result.messageId,
        duration,
      });
    } else {
      console.error(`[cron/executive-report] Failed: ${result.error}`);
      return NextResponse.json({
        ok: false,
        error: result.error,
        reportDate: result.reportDate,
        recipient: result.recipient,
        duration,
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("[cron/executive-report] Unexpected error:", error);
    return NextResponse.json({
      ok: false,
      error: error.message || "Unexpected error",
      duration: Date.now() - startTime,
    }, { status: 500 });
  }
}

// Also support POST for Vercel Cron
export async function POST(request: NextRequest) {
  return GET(request);
}
