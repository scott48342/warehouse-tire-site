/**
 * Cron: Send Email Campaign Batches
 * 
 * GET /api/cron/email-campaigns/send-batch
 * 
 * This cron job:
 * 1. Finds campaigns in "sending" status
 * 2. Processes a batch of pending recipients for each
 * 3. Marks campaigns as "sent" when complete
 * 
 * Should run every 1-2 minutes during active sends.
 * 
 * @created 2026-04-03
 */

import { NextRequest, NextResponse } from "next/server";
import { campaignService } from "@/lib/email/campaigns";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // 2 minutes max

export async function GET(req: NextRequest) {
  try {
    // Verify cron secret if configured
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.get("authorization");
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const results: Array<{
      campaignId: string;
      sent: number;
      failed: number;
      remaining: number;
      completed: boolean;
    }> = [];

    // Find campaigns in progress
    const campaigns = await campaignService.findCampaignsInProgress();

    console.log(`[cron/email-campaigns/send-batch] Found ${campaigns.length} campaigns in progress`);

    for (const campaign of campaigns) {
      try {
        const result = await campaignService.processSendBatch(campaign.id);
        
        results.push({
          campaignId: campaign.id,
          sent: result.sent,
          failed: result.failed,
          remaining: result.remaining,
          completed: result.remaining === 0 && result.sent === 0 && result.failed === 0,
        });

        console.log(`[cron/email-campaigns/send-batch] Campaign ${campaign.id}: sent=${result.sent}, failed=${result.failed}, remaining=${result.remaining}`);
      } catch (err: any) {
        console.error(`[cron/email-campaigns/send-batch] Error processing ${campaign.id}:`, err);
        results.push({
          campaignId: campaign.id,
          sent: 0,
          failed: 0,
          remaining: -1,
          completed: false,
        });
      }
    }

    const totalSent = results.reduce((sum, r) => sum + r.sent, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
    const completedCount = results.filter(r => r.completed).length;

    return NextResponse.json({
      campaignsProcessed: campaigns.length,
      totalSent,
      totalFailed,
      completed: completedCount,
      results,
    });
  } catch (err: any) {
    console.error("[cron/email-campaigns/send-batch] error:", err);
    return NextResponse.json(
      { error: err.message || "Cron job failed" },
      { status: 500 }
    );
  }
}
