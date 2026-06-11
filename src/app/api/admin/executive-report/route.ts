/**
 * Executive Report Admin API
 * 
 * GET /api/admin/executive-report - Get last successful send status
 * POST /api/admin/executive-report - Trigger test report
 * 
 * @created 2026-06-11
 */

import { NextRequest, NextResponse } from "next/server";
import { getLastSuccessfulSend, sendExecutiveReport, generateExecutiveReport } from "@/lib/executive-report";

// GET: Get last successful send status
export async function GET(request: NextRequest) {
  try {
    const lastSend = await getLastSuccessfulSend();
    
    return NextResponse.json({
      ok: true,
      lastSuccessfulSend: lastSend,
      configured: {
        recipient: process.env.EXECUTIVE_REPORT_EMAIL_TO ? "✓ Set" : "✗ Not set",
        cronSecret: process.env.CRON_SECRET ? "✓ Set" : "✗ Not set",
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message,
    }, { status: 500 });
  }
}

// POST: Trigger test report
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, testEmail } = body;
    
    switch (action) {
      case "preview":
        // Generate report data for preview
        const previewData = await generateExecutiveReport();
        return NextResponse.json({
          ok: true,
          action: "preview",
          data: previewData,
        });
      
      case "dryRun":
        // Full dry run with HTML generation
        const dryRunResult = await sendExecutiveReport({ dryRun: true });
        return NextResponse.json({
          ok: dryRunResult.success,
          action: "dryRun",
          ...dryRunResult,
        });
      
      case "sendTest":
        // Send to test email
        if (!testEmail) {
          return NextResponse.json({
            ok: false,
            error: "testEmail required for sendTest action",
          }, { status: 400 });
        }
        const testResult = await sendExecutiveReport({ 
          force: true, 
          testRecipient: testEmail 
        });
        return NextResponse.json({
          ok: testResult.success,
          action: "sendTest",
          ...testResult,
        });
      
      case "sendNow":
        // Force send to configured recipient
        const sendResult = await sendExecutiveReport({ force: true });
        return NextResponse.json({
          ok: sendResult.success,
          action: "sendNow",
          ...sendResult,
        });
      
      default:
        return NextResponse.json({
          ok: false,
          error: "Invalid action. Use: preview, dryRun, sendTest, sendNow",
          availableActions: {
            preview: "Generate report data without sending",
            dryRun: "Generate full report with HTML without sending",
            sendTest: "Send to a test email (requires testEmail param)",
            sendNow: "Force send to configured recipient",
          },
        }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: error.message,
    }, { status: 500 });
  }
}
