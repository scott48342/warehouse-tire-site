/**
 * Analytics Tracking Endpoint
 * Called client-side to record page views
 */

import { NextRequest, NextResponse } from "next/server";
import { trackPageView, shouldTrack } from "@/lib/analytics/track";
import { cookies } from "next/headers";

const SESSION_COOKIE = "_wtd_sid";
const SESSION_MAX_AGE = 60 * 30; // 30 minutes

function generateSessionId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path, referrer } = body;

    // Validate path
    if (!path || typeof path !== "string") {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    // Check if we should track this path
    if (!shouldTrack(path)) {
      return NextResponse.json({ tracked: false, reason: "excluded" });
    }

    // Get or create session
    const cookieStore = await cookies();
    let sessionId = cookieStore.get(SESSION_COOKIE)?.value;
    const isNewSession = !sessionId;

    if (!sessionId) {
      sessionId = generateSessionId();
    }

    // Get metadata from headers
    const userAgent = request.headers.get("user-agent");
    const country = request.headers.get("x-vercel-ip-country");
    const fullUrl = request.headers.get("referer") || `https://shop.warehousetiredirect.com${path}`;
    
    // Get hostname from request (for multi-site tracking)
    const hostname = request.headers.get("host") || request.headers.get("x-forwarded-host") || null;

    // Track the page view
    const result = await trackPageView({
      sessionId,
      path,
      fullUrl,
      referrer: referrer || request.headers.get("referer"),
      userAgent,
      country,
      isNewSession,
      hostname,
    });

    // Set/refresh session cookie
    const response = NextResponse.json({
      tracked: result.success,
      isBot: result.isBot,
      isNewSession,
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
    console.error("[Analytics API] Error:", error);
    return NextResponse.json({ error: "Tracking failed" }, { status: 500 });
  }
}

// Also support GET for simple beacon-style tracking
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("p");
  if (!path) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  // Reuse POST logic
  const fakeBody = JSON.stringify({ path });
  const fakeRequest = new NextRequest(request.url, {
    method: "POST",
    body: fakeBody,
    headers: request.headers,
  });

  return POST(fakeRequest);
}
