/**
 * Session History API
 * 
 * GET /api/admin/sessions
 * Returns recent sessions from analytics_sessions + analytics_pageviews tables
 * 
 * @updated 2026-04-30 - Reverted to analytics tables (funnel_events is separate)
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

    // Build site filter condition based on hostname
    let siteCondition = "";
    if (siteFilter === "local") {
      siteCondition = "AND s.hostname LIKE '%warehousetire.net%'";
    } else if (siteFilter === "national") {
      siteCondition = "AND (s.hostname LIKE '%warehousetiredirect.com%' OR s.hostname IS NULL)";
    }

    // Query analytics_sessions with pageview data
    const result = await pool.query(`
      SELECT 
        s.session_id,
        s.first_seen_at,
        s.last_seen_at,
        s.landing_page,
        s.current_page,
        s.page_view_count,
        s.referrer,
        s.utm_source,
        s.utm_medium,
        s.utm_campaign,
        s.device_type,
        s.user_agent,
        s.is_bot,
        s.country,
        s.city,
        s.region,
        s.hostname,
        s.is_test,
        -- Get page journey from pageviews table
        (
          SELECT ARRAY_AGG(DISTINCT path ORDER BY path)
          FROM analytics_pageviews pv
          WHERE pv.session_id = s.session_id
          LIMIT 50
        ) as pages_visited,
        -- Get ordered page journey
        (
          SELECT ARRAY_AGG(
            json_build_object('path', pv.path, 'time', pv.timestamp)
            ORDER BY pv.timestamp ASC
          )
          FROM (
            SELECT path, timestamp
            FROM analytics_pageviews
            WHERE session_id = s.session_id
            ORDER BY timestamp ASC
            LIMIT 50
          ) pv
        ) as page_journey
      FROM analytics_sessions s
      WHERE s.first_seen_at >= NOW() - INTERVAL '${hours} hours'
        AND s.is_bot = false
        AND s.is_test = false
        AND s.page_view_count >= ${minPages}
        ${siteCondition}
      ORDER BY s.last_seen_at DESC
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

      // Format source
      let source = "Direct";
      if (s.utm_source) {
        source = s.utm_campaign ? `${s.utm_source} (${s.utm_campaign})` : s.utm_source;
      } else if (s.referrer) {
        try {
          const refUrl = new URL(s.referrer);
          const host = refUrl.hostname.replace("www.", "");
          // Detect ad click IDs in referrer
          if (refUrl.searchParams.get("gclid")) {
            source = "google_ads";
          } else if (refUrl.searchParams.get("fbclid")) {
            source = "facebook";
          } else if (host.includes("google")) {
            source = "google";
          } else if (host.includes("facebook") || host.includes("fb.")) {
            source = "facebook";
          } else if (host.includes("bing")) {
            source = "bing";
          } else {
            source = host;
          }
        } catch {
          source = s.referrer.slice(0, 30);
        }
      }
      
      // Check landing page for ad click IDs
      if (source === "Direct" && s.landing_page) {
        try {
          const landingUrl = new URL(`https://example.com${s.landing_page}`);
          if (landingUrl.searchParams.get("gclid") || landingUrl.searchParams.get("gad_source")) {
            source = "google_ads";
          } else if (landingUrl.searchParams.get("fbclid")) {
            source = "facebook";
          } else if (landingUrl.searchParams.get("msclkid")) {
            source = "bing_ads";
          }
        } catch {}
      }

      const cart = cartsBySession.get(s.session_id);
      
      // Parse page journey
      const pages: string[] = [];
      const events: Array<{ path: string; time: string }> = [];
      
      if (Array.isArray(s.page_journey)) {
        for (const item of s.page_journey) {
          if (item && typeof item === 'object') {
            const path = item.path || '/';
            events.push({ path, time: item.time });
            if (!pages.includes(path)) {
              pages.push(path);
            }
          }
        }
      } else if (Array.isArray(s.pages_visited)) {
        pages.push(...s.pages_visited.filter(Boolean));
      }

      // Determine site from hostname
      let site = "national";
      const hostname = s.hostname || "";
      if (hostname.includes("warehousetire.net")) {
        site = "local";
      } else if (hostname.includes("pos.")) {
        site = "pos";
      }
      
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
        landingPage: s.landing_page || "/",
        lastPage: s.current_page || s.landing_page || "/",
        pageViews: parseInt(s.page_view_count) || 1,
        pages,
        events,
        device: s.device_type || "unknown",
        location: s.city && s.region 
          ? `${s.city}, ${s.region}` 
          : s.city || s.region || s.country || null,
        country: s.country,
        city: s.city,
        region: s.region,
        source,
        hostname: s.hostname || "shop.warehousetiredirect.com",
        site,
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

    // Summary stats
    const totalSessions = formattedSessions.length;
    const activeSessions = formattedSessions.filter((s: any) => s.isActive).length;
    const withCart = formattedSessions.filter((s: any) => s.cart !== null).length;
    const deepSessions = formattedSessions.filter((s: any) => s.pageViews >= 5).length;

    return NextResponse.json({
      generated: new Date().toISOString(),
      hours,
      totalSessions,
      activeSessions,
      withCart,
      deepSessions,
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
