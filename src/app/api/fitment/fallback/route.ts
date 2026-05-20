/**
 * Fallback Fitment API
 * 
 * Provides inferred fitment data when primary WTD database doesn't have
 * the requested vehicle. Used by Jake to continue helping customers.
 * 
 * GET /api/fitment/fallback?year=2009&make=Cadillac&model=DTS
 * 
 * @created 2026-05-20
 */

import { NextRequest, NextResponse } from "next/server";
import {
  lookupFallbackFitment,
  formatFallbackForJake,
  canSearchWithFallback,
  getPrimaryTireSize,
  type FallbackFitmentResult,
} from "@/lib/fitment/fallbackFitmentService";
import { trackFitmentGap } from "@/lib/analytics/fitmentGapTracker";
import { logMissingFitment } from "@/lib/fitment/missingFitmentService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  
  const year = parseInt(searchParams.get("year") || "0", 10);
  const make = searchParams.get("make") || "";
  const model = searchParams.get("model") || "";
  const trim = searchParams.get("trim") || undefined;
  const sessionId = searchParams.get("sessionId") || undefined;
  const source = searchParams.get("source") || "api"; // "jake" | "api" | "widget"
  
  // Validate required params
  if (!year || !make || !model) {
    return NextResponse.json(
      { error: "Missing required parameters: year, make, model" },
      { status: 400 }
    );
  }
  
  // Perform fallback lookup
  const result = lookupFallbackFitment({ year, make, model, trim });
  
  // Track this as a fitment gap request (async, don't await)
  trackFitmentGap({
    year,
    make,
    model,
    trim,
    sessionId,
    source,
    fallbackResult: {
      success: result.success,
      confidence: result.confidence,
      source: result.source,
      hasBoltPattern: !!result.boltPattern,
      hasTireSizes: !!(result.tireSizes && result.tireSizes.length > 0),
    },
  }).catch(err => console.error("[fallback-fitment] Failed to track gap:", err));
  
  // Log to missing fitment requests table for admin management
  logMissingFitment({
    year,
    make,
    model,
    trim,
    source: source as any,
    sessionId,
    hostname: request.headers.get("host") || undefined,
    fallbackUsed: result.success,
    fallbackConfidence: result.confidence,
    fallbackTireSize: getPrimaryTireSize(result) || undefined,
    fallbackBoltPattern: result.boltPattern,
  }).catch(err => console.error("[fallback-fitment] Failed to log missing:", err));
  
  // Build response
  const searchCapabilities = canSearchWithFallback(result);
  const primaryTireSize = getPrimaryTireSize(result);
  
  return NextResponse.json({
    success: result.success,
    confidence: result.confidence,
    source: result.source,
    vehicle: {
      year,
      make,
      model,
      trim,
    },
    
    // Fitment data
    fitment: result.success ? {
      boltPattern: result.boltPattern,
      centerBore: result.centerBore,
      tireSizes: result.tireSizes,
      wheelDiameters: result.wheelDiameters,
      wheelWidths: result.wheelWidths,
      offsetRange: result.offsetRange,
      platform: result.platform,
      sharedWith: result.sharedWith,
    } : null,
    
    // Search capabilities
    searchCapabilities: {
      canSearchTires: searchCapabilities.canSearchTires,
      canSearchWheels: searchCapabilities.canSearchWheels,
      primaryTireSize,
      reason: searchCapabilities.reason,
    },
    
    // Jake-friendly messaging
    messaging: {
      confidence: result.confidenceMessage,
      warning: result.warningMessage,
      verifyPrompt: result.verifyPrompt,
      formatted: formatFallbackForJake(result),
    },
    
    // Meta
    meta: {
      vehicleKey: result.vehicleKey,
      lookupMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * POST endpoint for Jake to report fallback events with more context
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year, make, model, trim, sessionId, conversationId, action } = body;
    
    if (!year || !make || !model) {
      return NextResponse.json(
        { error: "Missing required fields: year, make, model" },
        { status: 400 }
      );
    }
    
    // Perform lookup
    const result = lookupFallbackFitment({ year, make, model, trim });
    
    // Track with additional context
    await trackFitmentGap({
      year,
      make,
      model,
      trim,
      sessionId,
      conversationId,
      source: "jake",
      action, // "lookup" | "search_tires" | "search_wheels" | "cart_created"
      fallbackResult: {
        success: result.success,
        confidence: result.confidence,
        source: result.source,
        hasBoltPattern: !!result.boltPattern,
        hasTireSizes: !!(result.tireSizes && result.tireSizes.length > 0),
      },
    });
    
    const searchCapabilities = canSearchWithFallback(result);
    
    return NextResponse.json({
      success: result.success,
      confidence: result.confidence,
      source: result.source,
      fitment: result.success ? {
        boltPattern: result.boltPattern,
        centerBore: result.centerBore,
        tireSizes: result.tireSizes,
        wheelDiameters: result.wheelDiameters,
      } : null,
      searchCapabilities,
      messaging: {
        formatted: formatFallbackForJake(result),
        verifyPrompt: result.verifyPrompt,
      },
    });
  } catch (error) {
    console.error("[fallback-fitment] POST error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
