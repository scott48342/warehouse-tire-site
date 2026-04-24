/**
 * Analytics Tracking API
 * 
 * POST /api/analytics/track
 * Captures client-side page views and persists to database
 * 
 * @created 2026-04-23
 * @updated 2026-04-25 - Fixed: Actually write to database!
 */

import { NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import { trackPageView } from "@/lib/analytics/track";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cookie name for session tracking
const SESSION_COOKIE = "wt_session_id";

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * POST /api/analytics/track
 * 
 * Body:
 * - path: string (required)
 * - referrer: string (optional)
 */
export async function POST(req: Request) {
  try {
    const body = await req.text();
    let parsed;
    
    try {
      parsed = JSON.parse(body);
    } catch {
      // Accept empty/malformed beacon requests gracefully
      return new Response(null, { status: 204 });
    }

    const { path, referrer } = parsed;

    if (!path) {
      return new Response(null, { status: 204 });
    }

    // Skip admin and API routes
    if (path.startsWith("/admin") || path.startsWith("/api")) {
      return new Response(null, { status: 204 });
    }

    // Get headers for context
    const headersList = await headers();
    const cookieStore = await cookies();
    
    const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || 
               headersList.get("x-real-ip") || 
               "unknown";
    const userAgent = headersList.get("user-agent") || "";
    const host = headersList.get("host") || headersList.get("x-forwarded-host") || "";
    
    // Geo headers (Vercel provides these)
    const country = headersList.get("x-vercel-ip-country") || null;
    const city = headersList.get("x-vercel-ip-city") || null;
    const region = headersList.get("x-vercel-ip-country-region") || null;

    // Get or create session ID
    let sessionId = cookieStore.get(SESSION_COOKIE)?.value;
    const isNewSession = !sessionId;
    
    if (!sessionId) {
      sessionId = generateSessionId();
    }

    // Build full URL
    const protocol = headersList.get("x-forwarded-proto") || "https";
    const fullUrl = `${protocol}://${host}${path}`;

    // Track the page view in the database
    await trackPageView({
      sessionId,
      path,
      fullUrl,
      referrer,
      userAgent,
      country,
      city,
      region,
      isNewSession,
      hostname: host,
      // Pass cookies and headers for test detection
      cookies: Object.fromEntries(
        cookieStore.getAll().map(c => [c.name, c.value])
      ),
      headers: {
        "user-agent": userAgent,
        "x-forwarded-for": ip,
      },
    });

    // Set session cookie if new
    const response = new Response(null, { status: 204 });
    
    if (isNewSession) {
      response.headers.set(
        "Set-Cookie",
        `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`
      );
    }

    return response;
  } catch (err) {
    console.error("[analytics/track] Error:", err);
    // Still return 204 - analytics shouldn't break the site
    return new Response(null, { status: 204 });
  }
}

/**
 * GET /api/analytics/track
 * Health check
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Analytics tracking endpoint",
  });
}
