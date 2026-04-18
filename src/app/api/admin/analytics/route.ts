/**
 * Admin Analytics Dashboard API
 * 
 * @updated 2026-04-05 - Added test data exclusion
 * @updated 2026-04-18 - Added hostname/site filtering
 */

import { NextRequest, NextResponse } from "next/server";
import { analyticsDb, schema } from "@/lib/analytics/db";
import { sql, eq, gte, and, desc, count, countDistinct, like } from "drizzle-orm";
import { ensureAnalyticsTables } from "@/lib/analytics/track";

// Site hostname mappings
const SITE_HOSTNAMES: Record<string, string[]> = {
  national: ["shop.warehousetiredirect.com"],
  local: ["shop.warehousetire.net", "warehousetire.net"],
  pos: ["pos.warehousetiredirect.com"],
};

export async function GET(request: NextRequest) {
  try {
    await ensureAnalyticsTables();

    const excludeBots = request.nextUrl.searchParams.get("bots") !== "include";
    const includeTest = request.nextUrl.searchParams.get("includeTest") === "1";
    const siteFilter = request.nextUrl.searchParams.get("site"); // "national", "local", "pos", or null for all
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Build exclusion filters: bots + test data + site
    // Note: is_test column is NOT NULL with default false (backfilled + enforced)
    const exclusionFilters: any[] = [];
    if (excludeBots) {
      exclusionFilters.push(eq(schema.analyticsSessions.isBot, false));
    }
    if (!includeTest) {
      exclusionFilters.push(eq(schema.analyticsSessions.isTest, false));
    }
    
    // Site/hostname filtering
    if (siteFilter && SITE_HOSTNAMES[siteFilter]) {
      const hostnames = SITE_HOSTNAMES[siteFilter];
      if (hostnames.length === 1) {
        exclusionFilters.push(eq(schema.analyticsSessions.hostname, hostnames[0]));
      } else {
        // Multiple hostnames for one site (e.g., local has both warehousetire.net variants)
        exclusionFilters.push(
          sql`${schema.analyticsSessions.hostname} IN (${sql.join(hostnames.map(h => sql`${h}`), sql`, `)})`
        );
      }
    }
    
    // Combined filter for sessions
    const sessionFilter = exclusionFilters.length > 0 
      ? and(...exclusionFilters)
      : undefined;

    // Visits today (unique sessions) - excludes bots and test data
    const visitsToday = await analyticsDb
      .select({ count: count() })
      .from(schema.analyticsSessions)
      .where(
        sessionFilter
          ? and(gte(schema.analyticsSessions.firstSeenAt, todayStart), sessionFilter)
          : gte(schema.analyticsSessions.firstSeenAt, todayStart)
      );

    // Visits last 7 days - excludes bots and test data
    const visitsWeek = await analyticsDb
      .select({ count: count() })
      .from(schema.analyticsSessions)
      .where(
        sessionFilter
          ? and(gte(schema.analyticsSessions.firstSeenAt, weekAgo), sessionFilter)
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

    // Top landing pages (last 7 days) - excludes bots and test data
    const topLandingPages = await analyticsDb
      .select({
        page: schema.analyticsSessions.landingPage,
        count: count(),
      })
      .from(schema.analyticsSessions)
      .where(
        sessionFilter
          ? and(gte(schema.analyticsSessions.firstSeenAt, weekAgo), sessionFilter)
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

    // Top referrers (last 7 days, non-null only, excluding internal) - excludes bots and test data
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
          sessionFilter || sql`1=1`
        )
      )
      .groupBy(schema.analyticsSessions.referrer)
      .orderBy(desc(count()))
      .limit(10);

    // Top UTM campaigns (last 7 days) - excludes bots and test data
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
          sessionFilter || sql`1=1`
        )
      )
      .groupBy(
        schema.analyticsSessions.utmSource,
        schema.analyticsSessions.utmMedium,
        schema.analyticsSessions.utmCampaign
      )
      .orderBy(desc(count()))
      .limit(10);

    // Device breakdown (last 7 days) - excludes bots and test data
    const deviceBreakdown = await analyticsDb
      .select({
        device: schema.analyticsSessions.deviceType,
        count: count(),
      })
      .from(schema.analyticsSessions)
      .where(
        sessionFilter
          ? and(gte(schema.analyticsSessions.firstSeenAt, weekAgo), sessionFilter)
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

    // Test session count (for transparency)
    const testCount = await analyticsDb
      .select({ count: count() })
      .from(schema.analyticsSessions)
      .where(
        and(
          gte(schema.analyticsSessions.firstSeenAt, weekAgo),
          eq(schema.analyticsSessions.isTest, true)
        )
      );

    return NextResponse.json({
      generated: new Date().toISOString(),
      excludingBots: excludeBots,
      excludingTest: !includeTest,
      siteFilter: siteFilter || "all",
      availableSites: ["all", "national", "local", "pos"],
      summary: {
        visitsToday: visitsToday[0]?.count || 0,
        visitsWeek: visitsWeek[0]?.count || 0,
        pageViewsToday: pageViewsToday[0]?.count || 0,
        pageViewsWeek: pageViewsWeek[0]?.count || 0,
        botsWeek: botCount[0]?.count || 0,
        testSessionsWeek: testCount[0]?.count || 0,
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
