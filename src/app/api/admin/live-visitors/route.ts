/**
 * Live Visitors API
 * 
 * GET /api/admin/live-visitors
 * Returns currently active visitors on the site
 * 
 * @created 2026-04-18
 * @updated 2026-04-27 - Switched to funnel_events table
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

    // Build site filter condition
    let siteCondition = "";
    if (siteFilter === "local") {
      siteCondition = "AND store_mode = 'local'";
    } else if (siteFilter === "national") {
      siteCondition = "AND store_mode = 'national'";
    }

    // Get active visitors from funnel_events
    const result = await pool.query(`
      WITH recent_sessions AS (
        SELECT DISTINCT session_id
        FROM funnel_events
        WHERE created_at >= NOW() - INTERVAL '${activeMinutes} minutes'
          AND session_id IS NOT NULL
          AND session_id != ''
          ${siteCondition}
      ),
      session_summary AS (
        SELECT 
          fe.session_id,
          MIN(fe.created_at) as first_seen_at,
          MAX(fe.created_at) as last_seen_at,
          COUNT(*) as event_count,
          (ARRAY_AGG(fe.page_url ORDER BY fe.created_at ASC))[1] as landing_page,
          (ARRAY_AGG(fe.page_url ORDER BY fe.created_at DESC))[1] as current_page,
          (ARRAY_AGG(fe.traffic_source ORDER BY fe.created_at ASC))[1] as traffic_source,
          (ARRAY_AGG(fe.device_type ORDER BY fe.created_at ASC))[1] as device_type,
          (ARRAY_AGG(fe.store_mode ORDER BY fe.created_at ASC))[1] as store_mode,
          (ARRAY_AGG(fe.referrer ORDER BY fe.created_at ASC))[1] as referrer,
          (ARRAY_AGG(fe.utm_source ORDER BY fe.created_at ASC))[1] as utm_source,
          (ARRAY_AGG(fe.utm_campaign ORDER BY fe.created_at ASC))[1] as utm_campaign
        FROM funnel_events fe
        WHERE fe.session_id IN (SELECT session_id FROM recent_sessions)
        GROUP BY fe.session_id
      )
      SELECT * FROM session_summary
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

      // Extract paths from URLs
      let currentPage = "/";
      let landingPage = "/";
      let hostname = "shop.warehousetiredirect.com";
      try {
        if (v.current_page) {
          const url = new URL(v.current_page);
          currentPage = url.pathname + url.search;
          hostname = url.hostname;
        }
        if (v.landing_page) {
          const url = new URL(v.landing_page);
          landingPage = url.pathname + url.search;
        }
      } catch {}

      // Determine source
      let source = "Direct";
      if (v.utm_source) {
        source = v.utm_campaign 
          ? `${v.utm_source} (${v.utm_campaign})`
          : v.utm_source;
      } else if (v.traffic_source && v.traffic_source !== "direct") {
        source = v.traffic_source;
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
        id: v.session_id?.slice(0, 8) || "unknown",
        sessionId: v.session_id,
        currentPage,
        landingPage,
        pageViews: parseInt(v.event_count) || 1,
        device: v.device_type || "unknown",
        location: null, // funnel_events doesn't have geo yet
        country: null,
        city: null,
        region: null,
        source,
        secondsAgo,
        lastSeenAgo: formatTimeAgo(secondsAgo),
        sessionDuration: formatDuration(sessionDurationSec),
        hostname,
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
