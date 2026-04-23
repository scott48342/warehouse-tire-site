/**
 * Email Automation Stats API
 * 
 * GET /api/admin/email-automation/stats
 * Returns comprehensive stats for the email automation dashboard
 * 
 * @created 2025-07-21
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { abandonedCarts, emailSubscribers } from "@/lib/fitment-db/schema";
import { eq, and, isNotNull, isNull, sql, gte, lte, count } from "drizzle-orm";

export const runtime = "nodejs";

interface AutomationStats {
  // Top-level metrics
  totalSubscribers: number;
  exitIntentCaptures: number;
  abandonedCartEmailsSent: number;
  exitIntentEmailsSent: number;
  totalEmailClicks: number;
  totalRecoveredCarts: number;
  totalRecoveredOrders: number;
  estimatedRecoveredRevenue: number;
  
  // Subscriber breakdown by source
  subscribersBySource: {
    exit_intent: number;
    checkout: number;
    cart_save: number;
    newsletter: number;
    quote: number;
    other: number;
  };
  
  // Email flow performance
  flows: {
    abandonedCart1: FlowStats;
    abandonedCart2: FlowStats;
    abandonedCart3: FlowStats;
    exitIntentImmediate: FlowStats;
    exitIntentFollowup: FlowStats;
  };
  
  // Recent activity
  recentActivity: RecentActivityItem[];
  
  // Time-based trends (last 7 days, last 30 days)
  trends: {
    last7Days: TrendStats;
    last30Days: TrendStats;
  };
}

interface FlowStats {
  name: string;
  sent: number;
  opened: number;
  clicked: number;
  recovered: number;
  openRate: number;
  clickRate: number;
  recoveryRate: number;
}

interface RecentActivityItem {
  id: string;
  email: string | null;
  source: string;
  vehicle: string | null;
  eventType: "subscriber" | "cart_abandoned" | "email_sent" | "email_clicked" | "recovered";
  sentStatus: "pending" | "sent" | "none";
  clickStatus: "clicked" | "opened" | "none";
  createdAt: string;
  cartId?: string;
  cartValue?: number;
}

interface TrendStats {
  subscribersGained: number;
  emailsSent: number;
  clicks: number;
  recoveries: number;
  revenue: number;
}

export async function GET() {
  try {
    // =========================================================================
    // 1. Total Subscribers (unique emails, excluding test data)
    // =========================================================================
    const [totalSubResult] = await db
      .select({ count: sql<number>`COUNT(DISTINCT email)::int` })
      .from(emailSubscribers)
      .where(eq(emailSubscribers.isTest, false));
    const totalSubscribers = totalSubResult?.count || 0;

    // =========================================================================
    // 2. Subscribers by source
    // =========================================================================
    const sourceResults = await db
      .select({
        source: emailSubscribers.source,
        count: count(),
      })
      .from(emailSubscribers)
      .where(eq(emailSubscribers.isTest, false))
      .groupBy(emailSubscribers.source);

    const subscribersBySource = {
      exit_intent: 0,
      checkout: 0,
      cart_save: 0,
      newsletter: 0,
      quote: 0,
      other: 0,
    };
    
    for (const row of sourceResults) {
      const source = row.source as keyof typeof subscribersBySource;
      if (source in subscribersBySource) {
        subscribersBySource[source] = Number(row.count);
      } else {
        subscribersBySource.other += Number(row.count);
      }
    }

    const exitIntentCaptures = subscribersBySource.exit_intent;

    // =========================================================================
    // 3. Abandoned Cart Email Stats (by email stage)
    // =========================================================================
    
    // First email sent
    const [cart1Sent] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(abandonedCarts)
      .where(and(
        eq(abandonedCarts.isTest, false),
        isNotNull(abandonedCarts.firstEmailSentAt)
      ));

    // Second email sent
    const [cart2Sent] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(abandonedCarts)
      .where(and(
        eq(abandonedCarts.isTest, false),
        isNotNull(abandonedCarts.secondEmailSentAt)
      ));

    // Third email sent
    const [cart3Sent] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(abandonedCarts)
      .where(and(
        eq(abandonedCarts.isTest, false),
        isNotNull(abandonedCarts.thirdEmailSentAt)
      ));

    const abandonedCartEmailsSent = 
      (cart1Sent?.count || 0) + 
      (cart2Sent?.count || 0) + 
      (cart3Sent?.count || 0);

    // =========================================================================
    // 4. Email Engagement (opens, clicks)
    // =========================================================================
    
    // Total opens
    const [opensResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(email_open_count), 0)::int` })
      .from(abandonedCarts)
      .where(eq(abandonedCarts.isTest, false));
    
    // Total clicks
    const [clicksResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(email_click_count), 0)::int` })
      .from(abandonedCarts)
      .where(eq(abandonedCarts.isTest, false));

    const totalEmailClicks = clicksResult?.total || 0;

    // Carts that were opened
    const [openedCartsResult] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(abandonedCarts)
      .where(and(
        eq(abandonedCarts.isTest, false),
        isNotNull(abandonedCarts.emailOpenedAt)
      ));

    // Carts that were clicked
    const [clickedCartsResult] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(abandonedCarts)
      .where(and(
        eq(abandonedCarts.isTest, false),
        isNotNull(abandonedCarts.emailClickedAt)
      ));

    // =========================================================================
    // 5. Recovery Stats
    // =========================================================================
    
    // Total recovered carts
    const [recoveredResult] = await db
      .select({ 
        count: sql<number>`COUNT(*)::int`,
        revenue: sql<number>`COALESCE(SUM(estimated_total::numeric), 0)::numeric`
      })
      .from(abandonedCarts)
      .where(and(
        eq(abandonedCarts.isTest, false),
        eq(abandonedCarts.status, "recovered")
      ));

    const totalRecoveredCarts = recoveredResult?.count || 0;
    const totalRecoveredRevenue = Number(recoveredResult?.revenue || 0);

    // Recovered specifically after email
    const [recoveredAfterEmailResult] = await db
      .select({ 
        count: sql<number>`COUNT(*)::int`,
        revenue: sql<number>`COALESCE(SUM(estimated_total::numeric), 0)::numeric`
      })
      .from(abandonedCarts)
      .where(and(
        eq(abandonedCarts.isTest, false),
        eq(abandonedCarts.status, "recovered"),
        eq(abandonedCarts.recoveredAfterEmail, true)
      ));

    const recoveredAfterEmail = recoveredAfterEmailResult?.count || 0;
    const estimatedRecoveredRevenue = Number(recoveredAfterEmailResult?.revenue || 0);

    // =========================================================================
    // 6. Exit Intent Email Stats
    // =========================================================================
    
    // Exit intent immediate (using lastCampaignSentAt as marker - null means followup not sent yet)
    // The immediate email is sent right away, so count all exit_intent subscribers as having received it
    const exitIntentImmediateSent = exitIntentCaptures;
    
    // Exit intent followups sent (those with lastCampaignSentAt set)
    const [exitFollowupResult] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(emailSubscribers)
      .where(and(
        eq(emailSubscribers.source, "exit_intent"),
        eq(emailSubscribers.isTest, false),
        isNotNull(emailSubscribers.lastCampaignSentAt)
      ));

    const exitIntentFollowupSent = exitFollowupResult?.count || 0;
    const exitIntentEmailsSent = exitIntentImmediateSent + exitIntentFollowupSent;

    // =========================================================================
    // 7. Build Flow Stats
    // =========================================================================
    
    const cart1SentCount = cart1Sent?.count || 0;
    const cart2SentCount = cart2Sent?.count || 0;
    const cart3SentCount = cart3Sent?.count || 0;
    const totalCartsOpened = openedCartsResult?.count || 0;
    const totalCartsClicked = clickedCartsResult?.count || 0;

    // For flow-level stats, we approximate based on overall engagement rates
    // since we don't track opens/clicks per email stage
    const overallOpenRate = cart1SentCount > 0 ? totalCartsOpened / cart1SentCount : 0;
    const overallClickRate = cart1SentCount > 0 ? totalCartsClicked / cart1SentCount : 0;
    const overallRecoveryRate = cart1SentCount > 0 ? recoveredAfterEmail / cart1SentCount : 0;

    const flows = {
      abandonedCart1: {
        name: "Abandoned Cart - 1 Hour",
        sent: cart1SentCount,
        opened: Math.round(cart1SentCount * overallOpenRate),
        clicked: Math.round(cart1SentCount * overallClickRate),
        recovered: Math.round(recoveredAfterEmail * 0.5), // Rough attribution
        openRate: Math.round(overallOpenRate * 100),
        clickRate: Math.round(overallClickRate * 100),
        recoveryRate: Math.round(overallRecoveryRate * 100),
      },
      abandonedCart2: {
        name: "Abandoned Cart - 24 Hours",
        sent: cart2SentCount,
        opened: Math.round(cart2SentCount * overallOpenRate * 0.8), // Typically lower
        clicked: Math.round(cart2SentCount * overallClickRate * 0.8),
        recovered: Math.round(recoveredAfterEmail * 0.3),
        openRate: Math.round(overallOpenRate * 80),
        clickRate: Math.round(overallClickRate * 80),
        recoveryRate: cart2SentCount > 0 ? Math.round((recoveredAfterEmail * 0.3 / cart2SentCount) * 100) : 0,
      },
      abandonedCart3: {
        name: "Abandoned Cart - 48 Hours",
        sent: cart3SentCount,
        opened: Math.round(cart3SentCount * overallOpenRate * 0.6),
        clicked: Math.round(cart3SentCount * overallClickRate * 0.6),
        recovered: Math.round(recoveredAfterEmail * 0.2),
        openRate: Math.round(overallOpenRate * 60),
        clickRate: Math.round(overallClickRate * 60),
        recoveryRate: cart3SentCount > 0 ? Math.round((recoveredAfterEmail * 0.2 / cart3SentCount) * 100) : 0,
      },
      exitIntentImmediate: {
        name: "Exit Intent - Immediate",
        sent: exitIntentImmediateSent,
        opened: 0, // Not tracked separately
        clicked: 0,
        recovered: 0,
        openRate: 0,
        clickRate: 0,
        recoveryRate: 0,
      },
      exitIntentFollowup: {
        name: "Exit Intent - 24h Follow-up",
        sent: exitIntentFollowupSent,
        opened: 0,
        clicked: 0,
        recovered: 0,
        openRate: 0,
        clickRate: 0,
        recoveryRate: 0,
      },
    };

    // =========================================================================
    // 8. Recent Activity
    // =========================================================================
    
    // Get recent subscribers
    const recentSubscribers = await db
      .select({
        id: emailSubscribers.id,
        email: emailSubscribers.email,
        source: emailSubscribers.source,
        vehicleYear: emailSubscribers.vehicleYear,
        vehicleMake: emailSubscribers.vehicleMake,
        vehicleModel: emailSubscribers.vehicleModel,
        createdAt: emailSubscribers.createdAt,
      })
      .from(emailSubscribers)
      .where(eq(emailSubscribers.isTest, false))
      .orderBy(sql`created_at DESC`)
      .limit(20);

    // Get recent abandoned carts with email activity
    const recentCarts = await db
      .select({
        id: abandonedCarts.id,
        cartId: abandonedCarts.cartId,
        email: abandonedCarts.customerEmail,
        status: abandonedCarts.status,
        vehicleYear: abandonedCarts.vehicleYear,
        vehicleMake: abandonedCarts.vehicleMake,
        vehicleModel: abandonedCarts.vehicleModel,
        estimatedTotal: abandonedCarts.estimatedTotal,
        firstEmailSentAt: abandonedCarts.firstEmailSentAt,
        emailOpenedAt: abandonedCarts.emailOpenedAt,
        emailClickedAt: abandonedCarts.emailClickedAt,
        recoveredAt: abandonedCarts.recoveredAt,
        createdAt: abandonedCarts.createdAt,
        abandonedAt: abandonedCarts.abandonedAt,
      })
      .from(abandonedCarts)
      .where(and(
        eq(abandonedCarts.isTest, false),
        isNotNull(abandonedCarts.customerEmail)
      ))
      .orderBy(sql`created_at DESC`)
      .limit(20);

    // Combine and format recent activity
    const recentActivity: RecentActivityItem[] = [];

    // Add subscriber events
    for (const sub of recentSubscribers) {
      const vehicle = sub.vehicleYear && sub.vehicleMake && sub.vehicleModel
        ? `${sub.vehicleYear} ${sub.vehicleMake} ${sub.vehicleModel}`
        : null;
      
      recentActivity.push({
        id: sub.id,
        email: sub.email,
        source: sub.source,
        vehicle,
        eventType: "subscriber",
        sentStatus: sub.source === "exit_intent" ? "sent" : "none",
        clickStatus: "none",
        createdAt: sub.createdAt.toISOString(),
      });
    }

    // Add cart events
    for (const cart of recentCarts) {
      const vehicle = cart.vehicleYear && cart.vehicleMake && cart.vehicleModel
        ? `${cart.vehicleYear} ${cart.vehicleMake} ${cart.vehicleModel}`
        : null;
      
      let eventType: RecentActivityItem["eventType"] = "cart_abandoned";
      if (cart.status === "recovered") {
        eventType = "recovered";
      } else if (cart.emailClickedAt) {
        eventType = "email_clicked";
      } else if (cart.firstEmailSentAt) {
        eventType = "email_sent";
      }

      recentActivity.push({
        id: cart.id,
        email: cart.email,
        source: "abandoned_cart",
        vehicle,
        eventType,
        sentStatus: cart.firstEmailSentAt ? "sent" : "pending",
        clickStatus: cart.emailClickedAt ? "clicked" : cart.emailOpenedAt ? "opened" : "none",
        createdAt: cart.abandonedAt?.toISOString() || cart.createdAt.toISOString(),
        cartId: cart.cartId,
        cartValue: Number(cart.estimatedTotal),
      });
    }

    // Sort by date descending and limit
    recentActivity.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const limitedActivity = recentActivity.slice(0, 30);

    // =========================================================================
    // 9. Trends (Last 7 days and 30 days)
    // =========================================================================
    
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 7-day trends
    const [subs7d] = await db
      .select({ count: sql<number>`COUNT(DISTINCT email)::int` })
      .from(emailSubscribers)
      .where(and(
        eq(emailSubscribers.isTest, false),
        gte(emailSubscribers.createdAt, sevenDaysAgo)
      ));

    const [emails7d] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(abandonedCarts)
      .where(and(
        eq(abandonedCarts.isTest, false),
        isNotNull(abandonedCarts.firstEmailSentAt),
        gte(abandonedCarts.firstEmailSentAt, sevenDaysAgo)
      ));

    const [clicks7d] = await db
      .select({ total: sql<number>`COALESCE(SUM(email_click_count), 0)::int` })
      .from(abandonedCarts)
      .where(and(
        eq(abandonedCarts.isTest, false),
        gte(abandonedCarts.emailClickedAt, sevenDaysAgo)
      ));

    const [recovered7d] = await db
      .select({ 
        count: sql<number>`COUNT(*)::int`,
        revenue: sql<number>`COALESCE(SUM(estimated_total::numeric), 0)::numeric`
      })
      .from(abandonedCarts)
      .where(and(
        eq(abandonedCarts.isTest, false),
        eq(abandonedCarts.status, "recovered"),
        eq(abandonedCarts.recoveredAfterEmail, true),
        gte(abandonedCarts.recoveredAt, sevenDaysAgo)
      ));

    // 30-day trends
    const [subs30d] = await db
      .select({ count: sql<number>`COUNT(DISTINCT email)::int` })
      .from(emailSubscribers)
      .where(and(
        eq(emailSubscribers.isTest, false),
        gte(emailSubscribers.createdAt, thirtyDaysAgo)
      ));

    const [emails30d] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(abandonedCarts)
      .where(and(
        eq(abandonedCarts.isTest, false),
        isNotNull(abandonedCarts.firstEmailSentAt),
        gte(abandonedCarts.firstEmailSentAt, thirtyDaysAgo)
      ));

    const [clicks30d] = await db
      .select({ total: sql<number>`COALESCE(SUM(email_click_count), 0)::int` })
      .from(abandonedCarts)
      .where(and(
        eq(abandonedCarts.isTest, false),
        gte(abandonedCarts.emailClickedAt, thirtyDaysAgo)
      ));

    const [recovered30d] = await db
      .select({ 
        count: sql<number>`COUNT(*)::int`,
        revenue: sql<number>`COALESCE(SUM(estimated_total::numeric), 0)::numeric`
      })
      .from(abandonedCarts)
      .where(and(
        eq(abandonedCarts.isTest, false),
        eq(abandonedCarts.status, "recovered"),
        eq(abandonedCarts.recoveredAfterEmail, true),
        gte(abandonedCarts.recoveredAt, thirtyDaysAgo)
      ));

    const trends = {
      last7Days: {
        subscribersGained: subs7d?.count || 0,
        emailsSent: emails7d?.count || 0,
        clicks: clicks7d?.total || 0,
        recoveries: recovered7d?.count || 0,
        revenue: Number(recovered7d?.revenue || 0),
      },
      last30Days: {
        subscribersGained: subs30d?.count || 0,
        emailsSent: emails30d?.count || 0,
        clicks: clicks30d?.total || 0,
        recoveries: recovered30d?.count || 0,
        revenue: Number(recovered30d?.revenue || 0),
      },
    };

    // =========================================================================
    // Return stats
    // =========================================================================
    
    const stats: AutomationStats = {
      totalSubscribers,
      exitIntentCaptures,
      abandonedCartEmailsSent,
      exitIntentEmailsSent,
      totalEmailClicks,
      totalRecoveredCarts,
      totalRecoveredOrders: totalRecoveredCarts, // Same for now
      estimatedRecoveredRevenue,
      subscribersBySource,
      flows,
      recentActivity: limitedActivity,
      trends,
    };

    return NextResponse.json(stats);
  } catch (err: any) {
    console.error("[admin/email-automation/stats] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
