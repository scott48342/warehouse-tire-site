/**
 * Live Visitors API
 * 
 * GET /api/admin/live-visitors
 * Returns currently active visitors on the site
 * 
 * @created 2026-04-18
 * @updated 2026-04-18 - Added cart data for visitors
 */

import { NextRequest, NextResponse } from "next/server";
import { analyticsDb, schema } from "@/lib/analytics/db";
import { db } from "@/lib/fitment-db/db";
import { abandonedCarts } from "@/lib/fitment-db/schema";
import { sql, gte, and, eq, desc, inArray } from "drizzle-orm";
import { ensureAnalyticsTables } from "@/lib/analytics/track";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    await ensureAnalyticsTables();

    // Active = seen in last N minutes (default 5)
    const minutesParam = request.nextUrl.searchParams.get("minutes");
    const activeMinutes = Math.min(60, Math.max(1, Number(minutesParam) || 5));
    
    const excludeBots = request.nextUrl.searchParams.get("bots") !== "include";
    const includeTest = request.nextUrl.searchParams.get("includeTest") === "1";
    const siteFilter = request.nextUrl.searchParams.get("site");

    const cutoff = new Date(Date.now() - activeMinutes * 60 * 1000);

    // Build filters
    const filters: any[] = [
      gte(schema.analyticsSessions.lastSeenAt, cutoff),
    ];
    
    if (excludeBots) {
      filters.push(eq(schema.analyticsSessions.isBot, false));
    }
    if (!includeTest) {
      filters.push(eq(schema.analyticsSessions.isTest, false));
    }
    if (siteFilter === "national") {
      filters.push(eq(schema.analyticsSessions.hostname, "shop.warehousetiredirect.com"));
    } else if (siteFilter === "local") {
      filters.push(
        sql`${schema.analyticsSessions.hostname} IN ('shop.warehousetire.net', 'warehousetire.net')`
      );
    } else if (siteFilter === "pos") {
      filters.push(eq(schema.analyticsSessions.hostname, "pos.warehousetiredirect.com"));
    }

    // Get active visitors
    const visitors = await analyticsDb
      .select({
        sessionId: schema.analyticsSessions.sessionId,
        currentPage: schema.analyticsSessions.currentPage,
        landingPage: schema.analyticsSessions.landingPage,
        firstSeenAt: schema.analyticsSessions.firstSeenAt,
        lastSeenAt: schema.analyticsSessions.lastSeenAt,
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
      .limit(100);

    // Get cart data for these sessions
    const sessionIds = visitors.map(v => v.sessionId).filter(Boolean);
    let cartsBySession: Map<string, any> = new Map();
    
    if (sessionIds.length > 0) {
      try {
        const carts = await db
          .select({
            sessionId: abandonedCarts.sessionId,
            cartId: abandonedCarts.cartId,
            items: abandonedCarts.items,
            itemCount: abandonedCarts.itemCount,
            estimatedTotal: abandonedCarts.estimatedTotal,
            vehicleYear: abandonedCarts.vehicleYear,
            vehicleMake: abandonedCarts.vehicleMake,
            vehicleModel: abandonedCarts.vehicleModel,
            status: abandonedCarts.status,
            customerEmail: abandonedCarts.customerEmail,
          })
          .from(abandonedCarts)
          .where(
            and(
              inArray(abandonedCarts.sessionId, sessionIds),
              // Only active/abandoned carts, not recovered
              sql`${abandonedCarts.status} IN ('active', 'abandoned')`
            )
          );
        
        for (const cart of carts) {
          if (cart.sessionId) {
            cartsBySession.set(cart.sessionId, cart);
          }
        }
      } catch (e) {
        console.error("[Live Visitors] Failed to fetch cart data:", e);
      }
    }

    // Format visitors with computed fields
    const formattedVisitors = visitors.map(v => {
      const cart = cartsBySession.get(v.sessionId);
      const now = Date.now();
      const lastSeenMs = new Date(v.lastSeenAt).getTime();
      const firstSeenMs = new Date(v.firstSeenAt).getTime();
      const secondsAgo = Math.floor((now - lastSeenMs) / 1000);
      const sessionDurationSec = Math.floor((lastSeenMs - firstSeenMs) / 1000);

      // Format location
      let location = null;
      if (v.city && v.region && v.country) {
        location = `${v.city}, ${v.region}, ${v.country}`;
      } else if (v.city && v.country) {
        location = `${v.city}, ${v.country}`;
      } else if (v.region && v.country) {
        location = `${v.region}, ${v.country}`;
      } else if (v.country) {
        location = v.country;
      }

      // Determine source
      let source = "Direct";
      if (v.utmSource) {
        source = v.utmCampaign 
          ? `${v.utmSource} (${v.utmCampaign})`
          : v.utmSource;
      } else if (v.referrer) {
        try {
          const refUrl = new URL(v.referrer);
          source = refUrl.hostname.replace("www.", "");
        } catch {
          source = v.referrer.slice(0, 30);
        }
      }

      // Format cart data if available
      let cartData = null;
      if (cart) {
        const items = Array.isArray(cart.items) ? cart.items : [];
        const wheels = items.filter((i: any) => i.type === "wheel");
        const tires = items.filter((i: any) => i.type === "tire");
        
        cartData = {
          cartId: cart.cartId,
          itemCount: cart.itemCount || items.length,
          total: Number(cart.estimatedTotal) || 0,
          vehicle: cart.vehicleYear && cart.vehicleMake
            ? `${cart.vehicleYear} ${cart.vehicleMake} ${cart.vehicleModel || ""}`.trim()
            : null,
          hasEmail: !!cart.customerEmail,
          summary: [
            wheels.length > 0 ? `${wheels.length} wheel${wheels.length > 1 ? "s" : ""}` : null,
            tires.length > 0 ? `${tires.length} tire${tires.length > 1 ? "s" : ""}` : null,
          ].filter(Boolean).join(", ") || "Empty",
          items: items.slice(0, 4).map((i: any) => ({
            type: i.type,
            brand: i.brand,
            model: i.model,
            qty: i.quantity,
            price: i.unitPrice,
          })),
        };
      }

      return {
        id: v.sessionId.slice(0, 8), // Short ID for display
        sessionId: v.sessionId,
        currentPage: v.currentPage || v.landingPage,
        landingPage: v.landingPage,
        pageViews: v.pageViewCount,
        device: v.deviceType || "unknown",
        location,
        country: v.country,
        city: v.city,
        region: v.region,
        source,
        secondsAgo,
        lastSeenAgo: formatTimeAgo(secondsAgo),
        sessionDuration: formatDuration(sessionDurationSec),
        hostname: v.hostname,
        cart: cartData,
      };
    });

    // Summary stats
    const totalActive = formattedVisitors.length;
    const byDevice = {
      mobile: formattedVisitors.filter(v => v.device === "mobile").length,
      desktop: formattedVisitors.filter(v => v.device === "desktop").length,
      tablet: formattedVisitors.filter(v => v.device === "tablet").length,
    };
    
    // Group by current page
    const byPage: Record<string, number> = {};
    for (const v of formattedVisitors) {
      const page = v.currentPage || "/";
      byPage[page] = (byPage[page] || 0) + 1;
    }

    return NextResponse.json({
      generated: new Date().toISOString(),
      activeMinutes,
      totalActive,
      summary: {
        total: totalActive,
        byDevice,
        topPages: Object.entries(byPage)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([page, count]) => ({ page, count })),
      },
      visitors: formattedVisitors,
    });
  } catch (error) {
    console.error("[Live Visitors API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch live visitors" },
      { status: 500 }
    );
  }
}

function formatTimeAgo(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}
