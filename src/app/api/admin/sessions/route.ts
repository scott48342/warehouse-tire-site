/**
 * Session History API
 * 
 * GET /api/admin/sessions
 * Returns recent sessions (including those that have left)
 */

import { NextRequest, NextResponse } from "next/server";
import { analyticsDb, schema } from "@/lib/analytics/db";
import { db } from "@/lib/fitment-db/db";
import { abandonedCarts } from "@/lib/fitment-db/schema";
import { sql, gte, and, eq, desc, inArray, lte } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const hoursParam = request.nextUrl.searchParams.get("hours");
    const hours = Math.min(72, Math.max(1, Number(hoursParam) || 24));
    
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = Math.min(200, Math.max(10, Number(limitParam) || 50));
    
    const siteFilter = request.nextUrl.searchParams.get("site");
    const minPages = Number(request.nextUrl.searchParams.get("minPages")) || 1;

    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Build filters
    const filters: any[] = [
      gte(schema.analyticsSessions.firstSeenAt, cutoff),
      eq(schema.analyticsSessions.isBot, false),
      eq(schema.analyticsSessions.isTest, false),
      gte(schema.analyticsSessions.pageViewCount, minPages),
    ];
    
    if (siteFilter === "local") {
      filters.push(sql`${schema.analyticsSessions.hostname} LIKE '%warehousetire.net%'`);
    } else if (siteFilter === "national") {
      filters.push(eq(schema.analyticsSessions.hostname, "shop.warehousetiredirect.com"));
    }

    const sessions = await analyticsDb
      .select({
        sessionId: schema.analyticsSessions.sessionId,
        firstSeenAt: schema.analyticsSessions.firstSeenAt,
        lastSeenAt: schema.analyticsSessions.lastSeenAt,
        landingPage: schema.analyticsSessions.landingPage,
        currentPage: schema.analyticsSessions.currentPage,
        pageViewCount: schema.analyticsSessions.pageViewCount,
        deviceType: schema.analyticsSessions.deviceType,
        country: schema.analyticsSessions.country,
        city: schema.analyticsSessions.city,
        region: schema.analyticsSessions.region,
        referrer: schema.analyticsSessions.referrer,
        utmSource: schema.analyticsSessions.utmSource,
        utmCampaign: schema.analyticsSessions.utmCampaign,
        hostname: schema.analyticsSessions.hostname,
      })
      .from(schema.analyticsSessions)
      .where(and(...filters))
      .orderBy(desc(schema.analyticsSessions.lastSeenAt))
      .limit(limit);

    // Get cart data for these sessions
    const sessionIds = sessions.map(s => s.sessionId).filter(Boolean);
    const cartsBySession: Map<string, any> = new Map();
    
    if (sessionIds.length > 0) {
      try {
        const carts = await db
          .select({
            sessionId: abandonedCarts.sessionId,
            cartId: abandonedCarts.cartId,
            itemCount: abandonedCarts.itemCount,
            estimatedTotal: abandonedCarts.estimatedTotal,
            vehicleYear: abandonedCarts.vehicleYear,
            vehicleMake: abandonedCarts.vehicleMake,
            vehicleModel: abandonedCarts.vehicleModel,
            status: abandonedCarts.status,
            customerEmail: abandonedCarts.customerEmail,
          })
          .from(abandonedCarts)
          .where(inArray(abandonedCarts.sessionId, sessionIds));
        
        for (const cart of carts) {
          if (cart.sessionId) {
            cartsBySession.set(cart.sessionId, cart);
          }
        }
      } catch (e) {
        console.error("[Sessions API] Cart fetch error:", e);
      }
    }

    // Format sessions
    const now = Date.now();
    const formattedSessions = sessions.map(s => {
      const firstSeenMs = new Date(s.firstSeenAt).getTime();
      const lastSeenMs = new Date(s.lastSeenAt).getTime();
      const durationSec = Math.floor((lastSeenMs - firstSeenMs) / 1000);
      const minutesAgo = Math.floor((now - lastSeenMs) / 60000);
      
      const isActive = minutesAgo < 5;
      
      let location = null;
      if (s.city && s.region) {
        location = `${s.city}, ${s.region}`;
      } else if (s.city || s.region) {
        location = s.city || s.region;
      }
      if (s.country && location) {
        location += `, ${s.country}`;
      } else if (s.country) {
        location = s.country;
      }

      let source = "Direct";
      if (s.utmSource) {
        source = s.utmCampaign ? `${s.utmSource} (${s.utmCampaign})` : s.utmSource;
      } else if (s.referrer) {
        try {
          source = new URL(s.referrer).hostname.replace("www.", "");
        } catch {
          source = s.referrer.slice(0, 30);
        }
      }

      const cart = cartsBySession.get(s.sessionId);
      
      return {
        sessionId: s.sessionId,
        shortId: s.sessionId.slice(0, 8),
        isActive,
        minutesAgo,
        timeAgo: minutesAgo < 60 
          ? `${minutesAgo}m ago` 
          : minutesAgo < 1440 
            ? `${Math.floor(minutesAgo / 60)}h ago`
            : `${Math.floor(minutesAgo / 1440)}d ago`,
        firstSeenAt: s.firstSeenAt,
        lastSeenAt: s.lastSeenAt,
        duration: durationSec < 60 
          ? `${durationSec}s` 
          : `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`,
        landingPage: s.landingPage,
        lastPage: s.currentPage || s.landingPage,
        pageViews: s.pageViewCount,
        device: s.deviceType || "unknown",
        location,
        source,
        hostname: s.hostname,
        site: s.hostname?.includes("warehousetire.net") ? "local" 
            : s.hostname?.includes("pos.") ? "pos" 
            : "national",
        cart: cart ? {
          cartId: cart.cartId,
          itemCount: cart.itemCount,
          total: Number(cart.estimatedTotal) || 0,
          vehicle: cart.vehicleYear && cart.vehicleMake
            ? `${cart.vehicleYear} ${cart.vehicleMake} ${cart.vehicleModel || ""}`.trim()
            : null,
          status: cart.status,
          hasEmail: !!cart.customerEmail,
        } : null,
      };
    });

    return NextResponse.json({
      generated: new Date().toISOString(),
      hours,
      totalSessions: formattedSessions.length,
      activeSessions: formattedSessions.filter(s => s.isActive).length,
      sessions: formattedSessions,
    });
  } catch (error) {
    console.error("[Sessions API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}
