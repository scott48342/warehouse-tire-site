/**
 * Live Visitors API
 * 
 * GET /api/admin/live-visitors
 * Returns currently active visitors on the site from analytics_sessions
 * 
 * @created 2026-04-18
 * @updated 2026-04-30 - Reverted to analytics_sessions (funnel_events is separate)
 */

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { db } from "@/lib/fitment-db/db";
import { abandonedCarts } from "@/lib/fitment-db/schema";
import { sql, and, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET(request: NextRequest) {
  try {
    // Active = seen in last N minutes (default 5)
    const minutesParam = request.nextUrl.searchParams.get("minutes");
    const activeMinutes = Math.min(60, Math.max(1, Number(minutesParam) || 5));
    
    const siteFilter = request.nextUrl.searchParams.get("site");

    // Build site filter condition based on hostname
    let siteCondition = "";
    if (siteFilter === "local") {
      siteCondition = "AND hostname LIKE '%warehousetire.net%'";
    } else if (siteFilter === "national") {
      siteCondition = "AND (hostname LIKE '%warehousetiredirect.com%' OR hostname IS NULL)";
    }

    // Get active visitors from analytics_sessions
    const result = await pool.query(`
      SELECT 
        session_id,
        first_seen_at,
        last_seen_at,
        landing_page,
        current_page,
        page_view_count,
        referrer,
        utm_source,
        utm_medium,
        utm_campaign,
        device_type,
        country,
        city,
        region,
        hostname
      FROM analytics_sessions
      WHERE last_seen_at >= NOW() - INTERVAL '${activeMinutes} minutes'
        AND is_bot = false
        AND is_test = false
        ${siteCondition}
      ORDER BY last_seen_at DESC
      LIMIT 100
    `);

    const visitors = result.rows;

    // Get cart data for these sessions
    const sessionIds = visitors.map((v: any) => v.session_id).filter(Boolean);
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
    const formattedVisitors = visitors.map((v: any) => {
      const cart = cartsBySession.get(v.session_id);
      const now = Date.now();
      const lastSeenMs = new Date(v.last_seen_at).getTime();
      const firstSeenMs = new Date(v.first_seen_at).getTime();
      const secondsAgo = Math.floor((now - lastSeenMs) / 1000);
      const sessionDurationSec = Math.floor((lastSeenMs - firstSeenMs) / 1000);

      // Determine source
      let source = "Direct";
      if (v.utm_source) {
        source = v.utm_campaign 
          ? `${v.utm_source} (${v.utm_campaign})`
          : v.utm_source;
      } else if (v.referrer) {
        try {
          const refUrl = new URL(v.referrer);
          const host = refUrl.hostname.replace("www.", "");
          if (refUrl.searchParams.get("gclid")) {
            source = "google_ads";
          } else if (host.includes("google")) {
            source = "google";
          } else if (host.includes("facebook") || host.includes("fb.")) {
            source = "facebook";
          } else {
            source = host;
          }
        } catch {
          source = v.referrer.slice(0, 30);
        }
      }
      
      // Check landing page for ad click IDs
      if (source === "Direct" && v.landing_page) {
        try {
          const landingUrl = new URL(`https://example.com${v.landing_page}`);
          if (landingUrl.searchParams.get("gclid") || landingUrl.searchParams.get("gad_source")) {
            source = "google_ads";
          } else if (landingUrl.searchParams.get("fbclid")) {
            source = "facebook";
          } else if (landingUrl.searchParams.get("msclkid")) {
            source = "bing_ads";
          }
        } catch {}
      }

      // Determine site from hostname
      let site = "national";
      const hostname = v.hostname || "";
      if (hostname.includes("warehousetire.net")) {
        site = "local";
      } else if (hostname.includes("pos.")) {
        site = "pos";
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
        id: v.session_id?.slice(0, 8) || "unknown",
        sessionId: v.session_id,
        currentPage: v.current_page || v.landing_page || "/",
        landingPage: v.landing_page || "/",
        pageViews: parseInt(v.page_view_count) || 1,
        device: v.device_type || "unknown",
        location: v.city && v.region 
          ? `${v.city}, ${v.region}` 
          : v.city || v.region || v.country || null,
        country: v.country,
        city: v.city,
        region: v.region,
        source,
        secondsAgo,
        lastSeenAgo: formatTimeAgo(secondsAgo),
        sessionDuration: formatDuration(sessionDurationSec),
        hostname: v.hostname || "shop.warehousetiredirect.com",
        site,
        cart: cartData,
      };
    });

    // Summary stats
    const totalActive = formattedVisitors.length;
    const byDevice = {
      mobile: formattedVisitors.filter((v: any) => v.device === "mobile").length,
      desktop: formattedVisitors.filter((v: any) => v.device === "desktop").length,
      tablet: formattedVisitors.filter((v: any) => v.device === "tablet").length,
    };
    const withCart = formattedVisitors.filter((v: any) => v.cart !== null).length;
    
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
        withCart,
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
      { error: "Failed to fetch live visitors", details: String(error) },
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
