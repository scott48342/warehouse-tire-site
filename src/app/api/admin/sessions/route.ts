/**
 * Session History API
 * 
 * GET /api/admin/sessions
 * Returns recent sessions aggregated from funnel_events
 * 
 * @updated 2026-04-27 - Switched to funnel_events table (was analytics_sessions)
 */

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { db } from "@/lib/fitment-db/db";
import { abandonedCarts } from "@/lib/fitment-db/schema";
import { inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET(request: NextRequest) {
  try {
    const hoursParam = request.nextUrl.searchParams.get("hours");
    const hours = Math.min(72, Math.max(1, Number(hoursParam) || 24));
    
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = Math.min(200, Math.max(10, Number(limitParam) || 50));
    
    const siteFilter = request.nextUrl.searchParams.get("site");
    const minPages = Number(request.nextUrl.searchParams.get("minPages")) || 1;

    // Build site filter condition
    let siteCondition = "";
    if (siteFilter === "local") {
      siteCondition = "AND store_mode = 'local'";
    } else if (siteFilter === "national") {
      siteCondition = "AND store_mode = 'national'";
    }

    // Aggregate sessions from funnel_events
    const result = await pool.query(`
      WITH session_summary AS (
        SELECT 
          session_id,
          MIN(created_at) as first_seen_at,
          MAX(created_at) as last_seen_at,
          COUNT(*) as event_count,
          -- Get first event's data
          (ARRAY_AGG(page_url ORDER BY created_at ASC))[1] as landing_page,
          (ARRAY_AGG(page_url ORDER BY created_at DESC))[1] as current_page,
          (ARRAY_AGG(traffic_source ORDER BY created_at ASC))[1] as traffic_source,
          (ARRAY_AGG(device_type ORDER BY created_at ASC))[1] as device_type,
          (ARRAY_AGG(store_mode ORDER BY created_at ASC))[1] as store_mode,
          (ARRAY_AGG(referrer ORDER BY created_at ASC))[1] as referrer,
          (ARRAY_AGG(utm_source ORDER BY created_at ASC))[1] as utm_source,
          (ARRAY_AGG(utm_campaign ORDER BY created_at ASC))[1] as utm_campaign,
          (ARRAY_AGG(ip_address ORDER BY created_at ASC))[1] as ip_address,
          (ARRAY_AGG(user_agent ORDER BY created_at ASC))[1] as user_agent,
          -- Check for cart events
          MAX(CASE WHEN event_name = 'add_to_cart' THEN 1 ELSE 0 END) as has_cart
        FROM funnel_events
        WHERE created_at >= NOW() - INTERVAL '${hours} hours'
          AND session_id IS NOT NULL
          AND session_id != ''
          ${siteCondition}
        GROUP BY session_id
        HAVING COUNT(*) >= ${minPages}
      )
      SELECT * FROM session_summary
      ORDER BY last_seen_at DESC
      LIMIT ${limit}
    `);

    const sessions = result.rows;

    // Get cart data for these sessions
    const sessionIds = sessions.map((s: any) => s.session_id).filter(Boolean);
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
    const formattedSessions = sessions.map((s: any) => {
      const firstSeenMs = new Date(s.first_seen_at).getTime();
      const lastSeenMs = new Date(s.last_seen_at).getTime();
      const durationSec = Math.floor((lastSeenMs - firstSeenMs) / 1000);
      const minutesAgo = Math.floor((now - lastSeenMs) / 60000);
      
      const isActive = minutesAgo < 5;

      // Extract path from URL
      let landingPath = "/";
      let currentPath = "/";
      try {
        if (s.landing_page) {
          const url = new URL(s.landing_page);
          landingPath = url.pathname + url.search;
        }
        if (s.current_page) {
          const url = new URL(s.current_page);
          currentPath = url.pathname + url.search;
        }
      } catch {
        landingPath = s.landing_page || "/";
        currentPath = s.current_page || landingPath;
      }

      // Determine hostname/site from landing page
      let hostname = "shop.warehousetiredirect.com";
      try {
        if (s.landing_page) {
          hostname = new URL(s.landing_page).hostname;
        }
      } catch {}

      // Format source
      let source = "Direct";
      if (s.utm_source) {
        source = s.utm_campaign ? `${s.utm_source} (${s.utm_campaign})` : s.utm_source;
      } else if (s.traffic_source && s.traffic_source !== "direct") {
        source = s.traffic_source;
      } else if (s.referrer) {
        try {
          source = new URL(s.referrer).hostname.replace("www.", "");
        } catch {
          source = s.referrer.slice(0, 30);
        }
      }

      const cart = cartsBySession.get(s.session_id);
      
      return {
        sessionId: s.session_id,
        shortId: s.session_id?.slice(0, 8) || "unknown",
        isActive,
        minutesAgo,
        timeAgo: minutesAgo < 60 
          ? `${minutesAgo}m ago` 
          : minutesAgo < 1440 
            ? `${Math.floor(minutesAgo / 60)}h ago`
            : `${Math.floor(minutesAgo / 1440)}d ago`,
        firstSeenAt: s.first_seen_at,
        lastSeenAt: s.last_seen_at,
        duration: durationSec < 60 
          ? `${durationSec}s` 
          : `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`,
        landingPage: landingPath,
        lastPage: currentPath,
        pageViews: parseInt(s.event_count) || 1,
        device: s.device_type || "unknown",
        location: null, // funnel_events doesn't have geo data yet
        source,
        hostname,
        site: s.store_mode === "local" ? "local" 
            : hostname?.includes("pos.") ? "pos" 
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
      activeSessions: formattedSessions.filter((s: any) => s.isActive).length,
      sessions: formattedSessions,
    });
  } catch (error) {
    console.error("[Sessions API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions", details: String(error) },
      { status: 500 }
    );
  }
}
