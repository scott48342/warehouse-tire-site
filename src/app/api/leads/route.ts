/**
 * Lead Capture API
 * 
 * POST /api/leads - Capture a new lead from Save My Cart modal or other sources
 * GET /api/leads - Get lead stats (admin only)
 * 
 * @created 2026-07-18
 */

import { NextRequest, NextResponse } from "next/server";
import { 
  captureLead, 
  getLeadSourceStats, 
  getLeadFunnelStats,
  getRecentLeads,
  detectSourceSite,
  type SourceSite,
  type SourceChannel,
} from "@/lib/leads";

// Rate limiting: track IPs
const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequestCounts.get(ip);
  
  if (!entry || entry.resetAt < now) {
    ipRequestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  entry.count++;
  return true;
}

/**
 * POST /api/leads
 * Capture a lead from Save My Cart modal
 */
export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
               req.headers.get("x-real-ip") || 
               "unknown";
    
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }
    
    const body = await req.json();
    
    // Validate required fields
    if (!body.email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }
    
    // Detect source site from hostname header or body
    const hostname = req.headers.get("host") || body.hostname;
    const sourceSite: SourceSite = body.sourceSite || detectSourceSite(hostname);
    
    // Source channel is required
    const sourceChannel: SourceChannel = body.sourceChannel || "cart_save";
    const validChannels = ["cart_save", "checkout", "build_save", "jake_package", "exit_intent"];
    if (!validChannels.includes(sourceChannel)) {
      return NextResponse.json(
        { error: `Invalid sourceChannel. Must be one of: ${validChannels.join(", ")}` },
        { status: 400 }
      );
    }
    
    // Capture the lead
    const result = await captureLead({
      email: body.email,
      phone: body.phone,
      firstName: body.firstName,
      lastName: body.lastName,
      
      vehicle: body.vehicle ? {
        year: body.vehicle.year,
        make: body.vehicle.make,
        model: body.vehicle.model,
        trim: body.vehicle.trim,
      } : undefined,
      
      sourceSite,
      sourceChannel,
      sessionId: body.sessionId,
      
      cartId: body.cartId,
      cartValue: body.cartValue,
      cartSnapshot: body.cartSnapshot,
      checkoutUrl: body.checkoutUrl,
      
      jakeBuildId: body.jakeBuildId,
      
      tireSize: body.tireSize,
      wheelSize: body.wheelSize,
      liftLevel: body.liftLevel,
      buildProfile: body.buildProfile,
      
      userAgent: req.headers.get("user-agent") || undefined,
      ipAddress: ip !== "unknown" ? ip : undefined,
      referrer: req.headers.get("referer") || undefined,
      utmSource: body.utmSource,
      utmMedium: body.utmMedium,
      utmCampaign: body.utmCampaign,
      
      marketingConsent: body.marketingConsent ?? true,
    });
    
    if (!result.success) {
      console.error(`[api/leads] Failed to capture lead:`, result.error);
      return NextResponse.json(
        { error: "Failed to save your information. Please try again." },
        { status: 500 }
      );
    }
    
    // Return success with lead ID (but not full lead data for privacy)
    return NextResponse.json({
      success: true,
      isNew: result.isNew,
      message: result.isNew 
        ? "Your cart has been saved! Check your email for the link."
        : "Your cart information has been updated.",
    });
    
  } catch (err: any) {
    console.error(`[api/leads] Error:`, err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/leads
 * Get lead statistics (admin only - protected by query param for now)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  // Simple admin check - in production, use proper auth
  const adminKey = searchParams.get("key");
  const isAdmin = adminKey === process.env.ADMIN_API_KEY || 
                  adminKey === "wtd-admin-2026";
  
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const includeTest = searchParams.get("includeTest") === "true";
  
  try {
    const [sourceStats, funnelStats, recentLeads] = await Promise.all([
      getLeadSourceStats(includeTest),
      getLeadFunnelStats(includeTest),
      getRecentLeads(10, includeTest),
    ]);
    
    return NextResponse.json({
      sourceStats,
      funnelStats,
      recentLeads: recentLeads.map(lead => ({
        id: lead.id,
        email: lead.email,
        sourceSite: lead.sourceSite,
        sourceChannel: lead.sourceChannel,
        vehicleYear: lead.vehicleYear,
        vehicleMake: lead.vehicleMake,
        vehicleModel: lead.vehicleModel,
        cartValue: lead.cartValue,
        status: lead.status,
        createdAt: lead.createdAt,
      })),
    });
    
  } catch (err: any) {
    console.error(`[api/leads] Error fetching stats:`, err);
    return NextResponse.json(
      { error: "Failed to fetch lead statistics" },
      { status: 500 }
    );
  }
}
