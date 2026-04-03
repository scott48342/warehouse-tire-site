/**
 * Cron: Process Recurring Email Campaigns
 * 
 * GET /api/cron/email-campaigns/recurring
 * 
 * This cron job:
 * 1. Finds campaigns with sendMode="recurring_monthly"
 * 2. Creates new campaign instances based on monthlyRuleJson
 * 3. Schedules them for the next occurrence
 * 
 * Should run daily at midnight.
 * 
 * @created 2026-04-03
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { emailCampaigns } from "@/lib/fitment-db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { campaignService, type MonthlyRule, type CampaignContent, type AudienceRules } from "@/lib/email/campaigns";

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

    const created: string[] = [];
    const errors: string[] = [];

    // Find recurring campaign templates (sent campaigns with recurring mode)
    const recurringCampaigns = await db
      .select()
      .from(emailCampaigns)
      .where(
        and(
          eq(emailCampaigns.sendMode, "recurring_monthly"),
          isNotNull(emailCampaigns.monthlyRuleJson),
          // Only templates (sent or the original draft)
          eq(emailCampaigns.status, "sent")
        )
      );

    console.log(`[cron/recurring] Found ${recurringCampaigns.length} recurring campaign templates`);

    const now = new Date();
    const today = now.getDate();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    for (const template of recurringCampaigns) {
      try {
        const rule = template.monthlyRuleJson as MonthlyRule;
        if (!rule || !rule.dayOfMonth) continue;

        // Check if it's time to create next month's instance
        // We create the instance on the day of the month specified
        if (today !== rule.dayOfMonth) continue;

        // Check if we already created one this month
        const instanceName = `${template.name} - ${thisMonth + 1}/${thisYear}`;
        const existing = await db
          .select()
          .from(emailCampaigns)
          .where(eq(emailCampaigns.name, instanceName))
          .limit(1);

        if (existing.length > 0) {
          console.log(`[cron/recurring] Skipping ${template.id}: instance already exists for this month`);
          continue;
        }

        // Parse scheduled time
        const [hours, minutes] = (rule.timeOfDay || "09:00").split(":").map(Number);
        const scheduledFor = new Date(thisYear, thisMonth, rule.dayOfMonth, hours, minutes);

        // Merge audience rules if override provided
        const audienceRules = {
          ...(template.audienceRulesJson as AudienceRules),
          ...(rule.audienceRulesOverride || {}),
        };

        // Create the instance campaign
        const instance = await campaignService.createCampaign({
          name: instanceName,
          campaignType: template.campaignType,
          subject: template.subject,
          previewText: template.previewText || undefined,
          fromName: template.fromName || undefined,
          replyTo: template.replyTo || undefined,
          contentJson: template.contentJson as CampaignContent,
          audienceRulesJson: audienceRules,
          includeFreeShippingBanner: template.includeFreeShippingBanner,
          includePriceMatch: template.includePriceMatch,
          utmCampaign: `${template.utmCampaign || template.name.toLowerCase().replace(/\s+/g, "-")}-${thisMonth + 1}-${thisYear}`,
          notes: `Auto-created from recurring template ${template.id}`,
        });

        // Schedule it
        await campaignService.scheduleCampaign(instance.id, scheduledFor);

        created.push(instance.id);
        console.log(`[cron/recurring] Created recurring instance ${instance.id} for template ${template.id}`);
      } catch (err: any) {
        errors.push(`${template.id}: ${err.message}`);
        console.error(`[cron/recurring] Error processing ${template.id}:`, err);
      }
    }

    return NextResponse.json({
      templatesChecked: recurringCampaigns.length,
      instancesCreated: created.length,
      created,
      errors,
    });
  } catch (err: any) {
    console.error("[cron/email-campaigns/recurring] error:", err);
    return NextResponse.json(
      { error: err.message || "Cron job failed" },
      { status: 500 }
    );
  }
}
