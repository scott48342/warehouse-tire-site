/**
 * Admin Automation Stats API
 * 
 * GET /api/admin/automation-stats
 * Returns comprehensive stats for email automation system
 * 
 * @created 2026-04-23
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { emailSubscribers, abandonedCarts, emailCampaigns, emailCampaignRecipients } from "@/lib/fitment-db/schema";
import { eq, and, sql, count, gte, isNotNull, isNull, desc, lt } from "drizzle-orm";
import { getAutomationStats } from "@/lib/email/automation";
import { EMAIL_SAFE_MODE, EMAIL_SCHEDULE } from "@/lib/cart/abandonedCartEmail";

export const runtime = "nodejs";

export async function GET() {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get automation queue stats
    const automationStats = await getAutomationStats();

    // Subscriber stats
    const [subscriberStats] = await db
      .select({
        total: count(),
        withVehicle: sql<number>`COUNT(*) FILTER (WHERE ${emailSubscribers.vehicleYear} IS NOT NULL)`,
        unsubscribed: sql<number>`COUNT(*) FILTER (WHERE ${emailSubscribers.unsubscribed} = true)`,
        last24h: sql<number>`COUNT(*) FILTER (WHERE ${emailSubscribers.createdAt} >= ${oneDayAgo})`,
        last7d: sql<number>`COUNT(*) FILTER (WHERE ${emailSubscribers.createdAt} >= ${sevenDaysAgo})`,
        last30d: sql<number>`COUNT(*) FILTER (WHERE ${emailSubscribers.createdAt} >= ${thirtyDaysAgo})`,
      })
      .from(emailSubscribers)
      .where(eq(emailSubscribers.isTest, false));

    // Source breakdown
    const sourceBreakdown = await db
      .select({
        source: emailSubscribers.source,
        count: count(),
      })
      .from(emailSubscribers)
      .where(eq(emailSubscribers.isTest, false))
      .groupBy(emailSubscribers.source);

    // Abandoned cart email stats
    const [cartEmailStats] = await db
      .select({
        totalAbandoned: count(),
        withEmail: sql<number>`COUNT(*) FILTER (WHERE ${abandonedCarts.customerEmail} IS NOT NULL)`,
        emailsSent: sql<number>`SUM(${abandonedCarts.emailSentCount})`,
        firstSent: sql<number>`COUNT(*) FILTER (WHERE ${abandonedCarts.firstEmailSentAt} IS NOT NULL)`,
        secondSent: sql<number>`COUNT(*) FILTER (WHERE ${abandonedCarts.secondEmailSentAt} IS NOT NULL)`,
        thirdSent: sql<number>`COUNT(*) FILTER (WHERE ${abandonedCarts.thirdEmailSentAt} IS NOT NULL)`,
        recovered: sql<number>`COUNT(*) FILTER (WHERE ${abandonedCarts.status} = 'recovered')`,
        recoveredAfterEmail: sql<number>`COUNT(*) FILTER (WHERE ${abandonedCarts.recoveredAfterEmail} = true)`,
        emailOpened: sql<number>`COUNT(*) FILTER (WHERE ${abandonedCarts.emailOpenedAt} IS NOT NULL)`,
        emailClicked: sql<number>`COUNT(*) FILTER (WHERE ${abandonedCarts.emailClickedAt} IS NOT NULL)`,
      })
      .from(abandonedCarts)
      .where(and(
        eq(abandonedCarts.isTest, false),
        gte(abandonedCarts.createdAt, thirtyDaysAgo)
      ));

    // Exit intent stats (last 30 days)
    const [exitIntentStats] = await db
      .select({
        total: count(),
        last24h: sql<number>`COUNT(*) FILTER (WHERE ${emailSubscribers.createdAt} >= ${oneDayAgo})`,
        last7d: sql<number>`COUNT(*) FILTER (WHERE ${emailSubscribers.createdAt} >= ${sevenDaysAgo})`,
        followupSent: sql<number>`COUNT(*) FILTER (WHERE ${emailSubscribers.lastCampaignSentAt} IS NOT NULL)`,
      })
      .from(emailSubscribers)
      .where(and(
        eq(emailSubscribers.source, "exit_intent"),
        eq(emailSubscribers.isTest, false),
        gte(emailSubscribers.createdAt, thirtyDaysAgo)
      ));

    // Campaign stats (last 30 days)
    const [campaignStats] = await db
      .select({
        total: count(),
        sent: sql<number>`COUNT(*) FILTER (WHERE ${emailCampaigns.status} = 'sent')`,
        scheduled: sql<number>`COUNT(*) FILTER (WHERE ${emailCampaigns.status} = 'scheduled')`,
        draft: sql<number>`COUNT(*) FILTER (WHERE ${emailCampaigns.status} = 'draft')`,
        totalSent: sql<number>`SUM(${emailCampaigns.sentCount})`,
        totalOpened: sql<number>`SUM(${emailCampaigns.openCount})`,
        totalClicked: sql<number>`SUM(${emailCampaigns.clickCount})`,
      })
      .from(emailCampaigns)
      .where(eq(emailCampaigns.isTest, false));

    // Recent activity
    const recentSubscribers = await db
      .select({
        email: emailSubscribers.email,
        source: emailSubscribers.source,
        vehicleMake: emailSubscribers.vehicleMake,
        vehicleModel: emailSubscribers.vehicleModel,
        createdAt: emailSubscribers.createdAt,
      })
      .from(emailSubscribers)
      .where(eq(emailSubscribers.isTest, false))
      .orderBy(desc(emailSubscribers.createdAt))
      .limit(10);

    return NextResponse.json({
      safeMode: EMAIL_SAFE_MODE,
      emailSchedule: EMAIL_SCHEDULE,
      
      queue: {
        exitIntentFollowups: automationStats.queue.exitIntentPending,
        abandonedCartEmails: automationStats.queue.abandonedCartPending,
      },

      subscribers: {
        total: Number(subscriberStats?.total || 0),
        withVehicle: Number(subscriberStats?.withVehicle || 0),
        unsubscribed: Number(subscriberStats?.unsubscribed || 0),
        last24h: Number(subscriberStats?.last24h || 0),
        last7d: Number(subscriberStats?.last7d || 0),
        last30d: Number(subscriberStats?.last30d || 0),
        bySource: Object.fromEntries(
          sourceBreakdown.map(r => [r.source, Number(r.count)])
        ),
      },

      abandonedCart: {
        totalAbandoned: Number(cartEmailStats?.totalAbandoned || 0),
        withEmail: Number(cartEmailStats?.withEmail || 0),
        emailsSent: Number(cartEmailStats?.emailsSent || 0),
        firstSent: Number(cartEmailStats?.firstSent || 0),
        secondSent: Number(cartEmailStats?.secondSent || 0),
        thirdSent: Number(cartEmailStats?.thirdSent || 0),
        recovered: Number(cartEmailStats?.recovered || 0),
        recoveredAfterEmail: Number(cartEmailStats?.recoveredAfterEmail || 0),
        emailOpened: Number(cartEmailStats?.emailOpened || 0),
        emailClicked: Number(cartEmailStats?.emailClicked || 0),
        recoveryRate: Number(cartEmailStats?.emailsSent || 0) > 0
          ? (Number(cartEmailStats?.recoveredAfterEmail || 0) / Number(cartEmailStats?.emailsSent || 0) * 100).toFixed(1)
          : "0",
        openRate: Number(cartEmailStats?.emailsSent || 0) > 0
          ? (Number(cartEmailStats?.emailOpened || 0) / Number(cartEmailStats?.emailsSent || 0) * 100).toFixed(1)
          : "0",
        clickRate: Number(cartEmailStats?.emailsSent || 0) > 0
          ? (Number(cartEmailStats?.emailClicked || 0) / Number(cartEmailStats?.emailsSent || 0) * 100).toFixed(1)
          : "0",
      },

      exitIntent: {
        total: Number(exitIntentStats?.total || 0),
        last24h: Number(exitIntentStats?.last24h || 0),
        last7d: Number(exitIntentStats?.last7d || 0),
        followupSent: Number(exitIntentStats?.followupSent || 0),
      },

      campaigns: {
        total: Number(campaignStats?.total || 0),
        sent: Number(campaignStats?.sent || 0),
        scheduled: Number(campaignStats?.scheduled || 0),
        draft: Number(campaignStats?.draft || 0),
        totalEmailsSent: Number(campaignStats?.totalSent || 0),
        totalOpened: Number(campaignStats?.totalOpened || 0),
        totalClicked: Number(campaignStats?.totalClicked || 0),
      },

      recentSubscribers: recentSubscribers.map(s => ({
        email: s.email,
        source: s.source,
        vehicle: s.vehicleMake ? `${s.vehicleMake} ${s.vehicleModel || ""}`.trim() : null,
        createdAt: s.createdAt,
      })),
    });
  } catch (err: any) {
    console.error("[admin/automation-stats] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
