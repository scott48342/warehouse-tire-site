/**
 * Page View Tracking API
 * 
 * POST /api/analytics/pageview
 * 
 * Receives page views from client Analytics component and records them
 * in analytics_sessions and analytics_pageviews tables for session history.
 */

import { NextRequest, NextResponse } from "next/server";
import { trackPageView, shouldTrack } from "@/lib/analytics/track";
import { cookies, headers } from "next/headers";

export const dynamic = "force-dynamic";

// Session ID cookie name
const SESSION_COOKIE = "wtd_analytics_sid";
const SESSION_MAX_AGE = 30 * 60; // 30 minutes

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path, referrer } = body;

    if (!path) {
      return NextResponse.json({ ok: false, error: "path required" }, { status: 400 });
    }

    // Skip tracking for admin/api routes
    if (!shouldTrack(path)) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Get or create session ID
    const cookieStore = await cookies();
    let sessionId = cookieStore.get(SESSION_COOKIE)?.value;
    const isNewSession = !sessionId;
    
    if (!sessionId) {
      sessionId = generateSessionId();
    }

    // Get request context
    const headersList = await headers();
    const userAgent = headersList.get("user-agent") || null;
    const forwardedFor = headersList.get("x-forwarded-for");
    const realIp = headersList.get("x-real-ip");
    
    // Get geo info from Vercel headers
    const country = headersList.get("x-vercel-ip-country") || null;
    const city = headersList.get("x-vercel-ip-city") || null;
    const region = headersList.get("x-vercel-ip-country-region") || null;

    // Get hostname for multi-site tracking
    const host = headersList.get("host") || headersList.get("x-forwarded-host") || null;
    
    // Build full URL for UTM extraction
    const fullUrl = host ? `https://${host}${path}` : path;

    // Get cookies and headers for test detection
    const cookieObj: Record<string, string> = {};
    cookieStore.getAll().forEach(c => { cookieObj[c.name] = c.value; });
    
    const headerObj: Record<string, string> = {};
    headersList.forEach((value, key) => { headerObj[key] = value; });

    // Track the page view
    const result = await trackPageView({
      sessionId,
      path,
      fullUrl,
      referrer: referrer || null,
      userAgent,
      country,
      city,
      region,
      isNewSession,
      cookies: cookieObj,
      headers: headerObj,
      hostname: host,
    });

    // Set/refresh session cookie
    const response = NextResponse.json({ 
      ok: result.success, 
      sessionId,
      isNewSession,
      isBot: result.isBot,
      isTest: result.isTest,
    });
    
    response.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    return response;

  } catch (error) {
    console.error("[analytics/pageview] Error:", error);
    // Always return 200 for analytics - don't break client
    return NextResponse.json({ ok: false });
  }
}
