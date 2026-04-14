/**
 * Fitment Coverage Analytics API
 * 
 * Receives and stores fitment coverage events.
 * Provides aggregated stats for reporting.
 * 
 * POST: Record a fitment coverage event
 * GET: Retrieve aggregated stats (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

// Check if Redis is configured
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const isRedisConfigured = Boolean(REDIS_URL && REDIS_TOKEN);

// Use Upstash Redis for event storage (only if configured)
const redis = isRedisConfigured
  ? new Redis({
      url: REDIS_URL!,
      token: REDIS_TOKEN!,
    })
  : null;

const EVENTS_KEY = "fitment:coverage:events";
const STATS_KEY = "fitment:coverage:stats";
const MAX_EVENTS = 10000; // Keep last 10k events

interface FitmentCoverageEvent {
  year: string;
  make: string;
  model: string;
  trim?: string;
  modification?: string;
  hasConfig: boolean;
  source: "config" | "legacy" | "none";
  confidence: "high" | "medium" | "low";
  wheelDiameter?: number;
  autoSelected: boolean;
  productType: "tires" | "wheels";
  timestamp?: number;
}

// ============================================================================
// POST: Record event
// ============================================================================

export async function POST(req: NextRequest) {
  // If Redis not configured, silently accept but don't store
  if (!redis) {
    return NextResponse.json({ success: true, stored: false });
  }
  
  try {
    const event: FitmentCoverageEvent = await req.json();
    
    // Validate required fields
    if (!event.year || !event.make || !event.model) {
      return NextResponse.json(
        { error: "Missing required fields: year, make, model" },
        { status: 400 }
      );
    }
    
    // Add timestamp
    event.timestamp = Date.now();
    
    // Store event in Redis list (LPUSH for newest first)
    await redis.lpush(EVENTS_KEY, JSON.stringify(event));
    
    // Trim to max events
    await redis.ltrim(EVENTS_KEY, 0, MAX_EVENTS - 1);
    
    // Update running stats
    await updateRunningStats(event);
    
    return NextResponse.json({ success: true, stored: true });
  } catch (err) {
    console.error("[fitment-coverage] Error recording event:", err);
    return NextResponse.json(
      { error: "Failed to record event" },
      { status: 500 }
    );
  }
}

// ============================================================================
// GET: Retrieve stats
// ============================================================================

export async function GET(req: NextRequest) {
  // If Redis not configured, return empty stats
  if (!redis) {
    return NextResponse.json({
      totalSelections: 0,
      configBacked: 0,
      legacyFallback: 0,
      noData: 0,
      configCoveragePercent: 0,
      fallbackPercent: 0,
      byConfidence: { high: 0, medium: 0, low: 0 },
      byProductType: { tires: 0, wheels: 0 },
      redisConfigured: false,
      message: "Redis not configured. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable tracking.",
    });
  }
  
  try {
    const { searchParams } = req.nextUrl;
    const hours = parseInt(searchParams.get("hours") || "24", 10);
    const detailed = searchParams.get("detailed") === "true";
    
    // Get running stats
    const statsRaw = await redis.get(STATS_KEY);
    const stats = (statsRaw as any) || {
      totalSelections: 0,
      configBacked: 0,
      legacyFallback: 0,
      noData: 0,
      byMake: {},
      byConfidence: { high: 0, medium: 0, low: 0 },
      byProductType: { tires: 0, wheels: 0 },
    };
    
    // Calculate percentages
    const configCoveragePercent = stats.totalSelections > 0
      ? ((stats.configBacked / stats.totalSelections) * 100).toFixed(1)
      : "0.0";
    
    const fallbackPercent = stats.totalSelections > 0
      ? (((stats.legacyFallback + stats.noData) / stats.totalSelections) * 100).toFixed(1)
      : "0.0";
    
    const response: any = {
      totalSelections: stats.totalSelections,
      configBacked: stats.configBacked,
      legacyFallback: stats.legacyFallback,
      noData: stats.noData,
      configCoveragePercent: parseFloat(configCoveragePercent),
      fallbackPercent: parseFloat(fallbackPercent),
      byConfidence: stats.byConfidence,
      byProductType: stats.byProductType,
    };
    
    // Include per-make breakdown if detailed
    if (detailed) {
      response.byMake = stats.byMake;
      
      // Get recent events for time-based analysis
      const cutoff = Date.now() - (hours * 60 * 60 * 1000);
      const recentEventsRaw = await redis.lrange(EVENTS_KEY, 0, 999);
      const recentEvents = recentEventsRaw
        .map((e: any) => {
          try {
            return typeof e === 'string' ? JSON.parse(e) : e;
          } catch {
            return null;
          }
        })
        .filter((e: any) => e && e.timestamp && e.timestamp >= cutoff);
      
      // Recent stats
      const recentConfig = recentEvents.filter((e: any) => e.source === "config").length;
      const recentTotal = recentEvents.length;
      
      response.last24h = {
        total: recentTotal,
        configBacked: recentConfig,
        configCoveragePercent: recentTotal > 0
          ? parseFloat(((recentConfig / recentTotal) * 100).toFixed(1))
          : 0,
      };
    }
    
    return NextResponse.json(response);
  } catch (err) {
    console.error("[fitment-coverage] Error retrieving stats:", err);
    return NextResponse.json(
      { error: "Failed to retrieve stats" },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper: Update running stats
// ============================================================================

async function updateRunningStats(event: FitmentCoverageEvent): Promise<void> {
  if (!redis) return;
  
  try {
    // Get current stats
    const statsRaw = await redis.get(STATS_KEY);
    const stats = (statsRaw as any) || {
      totalSelections: 0,
      configBacked: 0,
      legacyFallback: 0,
      noData: 0,
      byMake: {},
      byConfidence: { high: 0, medium: 0, low: 0 },
      byProductType: { tires: 0, wheels: 0 },
    };
    
    // Increment counters
    stats.totalSelections++;
    
    if (event.source === "config") {
      stats.configBacked++;
    } else if (event.source === "legacy") {
      stats.legacyFallback++;
    } else {
      stats.noData++;
    }
    
    // By make
    const make = event.make.toLowerCase();
    if (!stats.byMake[make]) {
      stats.byMake[make] = { total: 0, config: 0, fallback: 0 };
    }
    stats.byMake[make].total++;
    if (event.source === "config") {
      stats.byMake[make].config++;
    } else {
      stats.byMake[make].fallback++;
    }
    
    // By confidence
    if (!stats.byConfidence[event.confidence]) {
      stats.byConfidence[event.confidence] = 0;
    }
    stats.byConfidence[event.confidence]++;
    
    // By product type
    if (!stats.byProductType[event.productType]) {
      stats.byProductType[event.productType] = 0;
    }
    stats.byProductType[event.productType]++;
    
    // Save updated stats
    await redis.set(STATS_KEY, JSON.stringify(stats));
  } catch (err) {
    console.error("[updateRunningStats] Error:", err);
  }
}
