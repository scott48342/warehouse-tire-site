/**
 * Admin Analytics Dashboard API
 */

import { NextRequest, NextResponse } from "next/server";
import { analyticsDb, schema } from "@/lib/analytics/db";
import { sql, eq, gte, and, desc, count, countDistinct } from "drizzle-orm";
import { ensureAnalyticsTables } from "@/lib/analytics/track";

export async function GET(request: NextRequest) {
  try {
    await ensureAnalyticsTables();

    const excludeBots = request.nextUrl.searchParams.get("bots") !== "include";
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Build bot filter
    const botFilter = excludeBots 
      ? eq(schema.analyticsSessions.isBot, false)
      : undefined;

    // Visits today (unique sessions)
    const visitsToday = await analyticsDb
      .select({ count: count() })
      .from(schema.analyticsSessions)
      .where(
        botFilter
          ? and(gte(schema.analyticsSessions.firstSeenAt, todayStart), botFilter)
          : gte(schema.analyticsSessions.firstSeenAt, todayStart)
      );

    // Visits last 7 days
    const visitsWeek = await analyticsDb
      .select({ count: count() })
      .from(schema.analyticsSessions)
      .where(
        botFilter
          ? and(gte(schema.analyticsSessions.firstSeenAt, weekAgo), botFilter)
          : gte(schema.analyticsSessions.firstSeenAt, weekAgo)
      );

    // Page views today
    const pageViewsToday = await analyticsDb
      .select({ count: count() })
      .from(schema.analyticsPageviews)
      .where(gte(schema.analyticsPageviews.timestamp, todayStart));

    // Page views last 7 days
    const pageViewsWeek = await analyticsDb
      .select({ count: count() })
      .from(schema.analyticsPageviews)
      .where(gte(schema.analyticsPageviews.timestamp, weekAgo));

    // Top landing pages (last 7 days)
    const topLandingPages = await analyticsDb
      .select({
        page: schema.analyticsSessions.landingPage,
        count: count(),
      })
      .from(schema.analyticsSessions)
      .where(
        botFilter
          ? and(gte(schema.analyticsSessions.firstSeenAt, weekAgo), botFilter)
          : gte(schema.analyticsSessions.firstSeenAt, weekAgo)
      )
      .groupBy(schema.analyticsSessions.landingPage)
      .orderBy(desc(count()))
      .limit(10);

    // Top viewed pages (last 7 days)
    const topPages = await analyticsDb
      .select({
        page: schema.analyticsPageviews.path,
        count: count(),
      })
      .from(schema.analyticsPageviews)
      .where(gte(schema.analyticsPageviews.timestamp, weekAgo))
      .groupBy(schema.analyticsPageviews.path)
      .orderBy(desc(count()))
      .limit(10);

    // Top referrers (last 7 days, non-null only, excluding internal)
    const topReferrers = await analyticsDb
      .select({
        referrer: schema.analyticsSessions.referrer,
        count: count(),
      })
      .from(schema.analyticsSessions)
      .where(
        and(
          gte(schema.analyticsSessions.firstSeenAt, weekAgo),
          sql`${schema.analyticsSessions.referrer} IS NOT NULL`,
          sql`${schema.analyticsSessions.referrer} != ''`,
          // Exclude internal referrers
          sql`${schema.analyticsSessions.referrer} NOT LIKE '%vercel.app%'`,
          sql`${schema.analyticsSessions.referrer} NOT LIKE '%warehousetiredirect.com%'`,
          sql`${schema.analyticsSessions.referrer} NOT LIKE '%localhost%'`,
          botFilter || sql`1=1`
        )
      )
      .groupBy(schema.analyticsSessions.referrer)
      .orderBy(desc(count()))
      .limit(10);

    // Top UTM campaigns (last 7 days)
    const topCampaigns = await analyticsDb
      .select({
        source: schema.analyticsSessions.utmSource,
        medium: schema.analyticsSessions.utmMedium,
        campaign: schema.analyticsSessions.utmCampaign,
        count: count(),
      })
      .from(schema.analyticsSessions)
      .where(
        and(
          gte(schema.analyticsSessions.firstSeenAt, weekAgo),
          sql`${schema.analyticsSessions.utmSource} IS NOT NULL`,
          botFilter || sql`1=1`
        )
      )
      .groupBy(
        schema.analyticsSessions.utmSource,
        schema.analyticsSessions.utmMedium,
        schema.analyticsSessions.utmCampaign
      )
      .orderBy(desc(count()))
      .limit(10);

    // Device breakdown (last 7 days)
    const deviceBreakdown = await analyticsDb
      .select({
        device: schema.analyticsSessions.deviceType,
        count: count(),
      })
      .from(schema.analyticsSessions)
      .where(
        botFilter
          ? and(gte(schema.analyticsSessions.firstSeenAt, weekAgo), botFilter)
          : gte(schema.analyticsSessions.firstSeenAt, weekAgo)
      )
      .groupBy(schema.analyticsSessions.deviceType)
      .orderBy(desc(count()));

    // Bot count (for transparency)
    const botCount = await analyticsDb
      .select({ count: count() })
      .from(schema.analyticsSessions)
      .where(
        and(
          gte(schema.analyticsSessions.firstSeenAt, weekAgo),
          eq(schema.analyticsSessions.isBot, true)
        )
      );

    return NextResponse.json({
      generated: new Date().toISOString(),
      excludingBots: excludeBots,
      summary: {
        visitsToday: visitsToday[0]?.count || 0,
        visitsWeek: visitsWeek[0]?.count || 0,
        pageViewsToday: pageViewsToday[0]?.count || 0,
        pageViewsWeek: pageViewsWeek[0]?.count || 0,
        botsWeek: botCount[0]?.count || 0,
      },
      topLandingPages,
      topPages,
      topReferrers,
      topCampaigns,
      deviceBreakdown,
    });
  } catch (error) {
    console.error("[Analytics API] Dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
