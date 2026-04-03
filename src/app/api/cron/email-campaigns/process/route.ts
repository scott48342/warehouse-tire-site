/**
 * Cron: Process Email Campaigns
 * 
 * GET /api/cron/email-campaigns/process
 * 
 * This cron job:
 * 1. Finds scheduled campaigns ready to start
 * 2. Moves them to "sending" status
 * 
 * Should run every 1-5 minutes.
 * 
 * @created 2026-04-03
 */

import { NextRequest, NextResponse } from "next/server";
import { campaignService } from "@/lib/email/campaigns";
import { db } from "@/lib/fitment-db/db";
import { emailCampaigns } from "@/lib/fitment-db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

    const startedCampaigns: string[] = [];
    const errors: string[] = [];

    // Find scheduled campaigns ready to start
    const scheduledCampaigns = await campaignService.findScheduledCampaignsToStart();

    console.log(`[cron/email-campaigns/process] Found ${scheduledCampaigns.length} campaigns to start`);

    for (const campaign of scheduledCampaigns) {
      try {
        // Move to sending status
        await db
          .update(emailCampaigns)
          .set({
            status: "sending",
            startedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(emailCampaigns.id, campaign.id));

        startedCampaigns.push(campaign.id);
        console.log(`[cron/email-campaigns/process] Started campaign ${campaign.id}: ${campaign.name}`);
      } catch (err: any) {
        errors.push(`${campaign.id}: ${err.message}`);
        console.error(`[cron/email-campaigns/process] Error starting ${campaign.id}:`, err);
      }
    }

    return NextResponse.json({
      processed: scheduledCampaigns.length,
      started: startedCampaigns.length,
      startedCampaigns,
      errors,
    });
  } catch (err: any) {
    console.error("[cron/email-campaigns/process] error:", err);
    return NextResponse.json(
      { error: err.message || "Cron job failed" },
      { status: 500 }
    );
  }
}
