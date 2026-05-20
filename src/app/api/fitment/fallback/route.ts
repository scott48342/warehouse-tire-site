/**
 * Fallback Fitment API
 * 
 * Provides inferred/common OEM fitment data + aftermarket search profiles
 * for vehicles not yet in the WTD database.
 * 
 * LOOKUP PRIORITY:
 * 1. Curated fallback profiles (fast, sync)
 * 2. External Wheel-Size API lookup (slower, async)
 * 3. Ask customer to verify
 * 
 * GET /api/fitment/fallback?year=2009&make=Cadillac&model=DTS
 * GET /api/fitment/fallback?year=1998&make=Pontiac&model=Transport&external=true
 * 
 * Query params:
 * - year, make, model (required)
 * - trim (optional)
 * - diameter (optional) - get hints for specific wheel diameter
 * - external (optional) - if "true" or "1", try external lookup for unknown vehicles
 * 
 * @created 2026-05-20
 * @updated 2026-05-20 - Added aftermarket search profile support
 * @updated 2026-05-20 - Added external Wheel-Size API lookup support
 */

import { NextRequest, NextResponse } from "next/server";
import {
  lookupFallbackFitment,
  lookupFallbackFitmentWithExternal,
  formatFallbackForJake,
  canSearchWithFallback,
  getWheelSearchHintForDiameter,
  getPlusSizeTiresForDiameter,
  isDiameterSafeForUpgrade,
  type FallbackFitmentResult,
  type FallbackFitmentResultWithExternal,
} from "@/lib/fitment/fallbackFitmentService";

// Can't use edge runtime due to external API calls that need Node.js fetch
export const runtime = "nodejs";

interface FallbackAPIResponse {
  success: boolean;
  confidence: string;
  source: string;
  vehicleKey: string;
  
  // OEM specs
  specs: {
    boltPattern?: string;
    centerBore?: number;
    threadSize?: string;
    tireSizes?: { size: string; isOem: boolean; trimLevel?: string }[];
    wheelDiameters?: number[];
    wheelWidths?: number[];
    offsetRange?: { min: number; max: number };
    platform?: string;
    sharedWith?: string[];
  };
  
  // Aftermarket search profile (NEW)
  aftermarket?: {
    available: boolean;
    safeDiameters?: number[];
    wheelSearchHints?: {
      diameter: number;
      widths: number[];
      offsetRange: { min: number; max: number };
      notes?: string;
    }[];
    plusSizeTires?: {
      size: string;
      wheelDiameter: number;
      notes?: string;
    }[];
    surrogateVehicle?: {
      year: number;
      make: string;
      model: string;
      trim?: string;
      reason: string;
    };
  };
  
  // Search capabilities
  capabilities: {
    canSearchTires: boolean;
    canSearchWheels: boolean;
    canSearchAftermarketWheels: boolean;
    reason?: string;
  };
  
  // Messaging for Jake
  messaging: {
    confidenceMessage: string;
    warningMessage?: string;
    verifyPrompt?: string;
    formattedResponse: string;
    safetyNotes?: string[];
  };
  
  // For analytics/logging
  meta: {
    timestamp: number;
    requestedVehicle: {
      year: number;
      make: string;
      model: string;
      trim?: string;
    };
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const yearParam = searchParams.get("year");
  const make = searchParams.get("make");
  const model = searchParams.get("model");
  const trim = searchParams.get("trim") || undefined;
  const diameterParam = searchParams.get("diameter"); // Optional: get hints for specific diameter
  const externalParam = searchParams.get("external"); // Optional: try external lookup
  
  // Validate required params
  if (!yearParam || !make || !model) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing required parameters: year, make, model",
      },
      { status: 400 }
    );
  }
  
  const year = parseInt(yearParam, 10);
  if (isNaN(year) || year < 1950 || year > 2030) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid year parameter",
      },
      { status: 400 }
    );
  }
  
  // Default: try external lookup for unknown vehicles (can be disabled with external=false)
  const tryExternal = externalParam !== "false" && externalParam !== "0";
  
  // Look up fallback fitment
  let result: FallbackFitmentResultWithExternal;
  
  if (tryExternal) {
    // Use async version that tries external API for unknown vehicles
    result = await lookupFallbackFitmentWithExternal({ year, make, model, trim });
  } else {
    // Fast path: curated-only lookup
    result = lookupFallbackFitment({ year, make, model, trim });
  }
  
  // Check search capabilities
  const capabilities = canSearchWithFallback(result);
  
  // Format for Jake
  const formattedResponse = formatFallbackForJake(result);
  
  // Build response
  const response: FallbackAPIResponse = {
    success: result.success,
    confidence: result.confidence,
    source: result.source,
    vehicleKey: result.vehicleKey,
    
    specs: {
      boltPattern: result.boltPattern,
      centerBore: result.centerBore,
      threadSize: result.threadSize,
      tireSizes: result.tireSizes,
      wheelDiameters: result.wheelDiameters,
      wheelWidths: result.wheelWidths,
      offsetRange: result.offsetRange,
      platform: result.platform,
      sharedWith: result.sharedWith,
    },
    
    aftermarket: {
      available: result.hasAftermarketProfile,
      safeDiameters: result.safeAftermarketDiameters,
      wheelSearchHints: result.wheelSearchHints?.map(hint => ({
        diameter: hint.diameter,
        widths: hint.widths,
        offsetRange: hint.offsetRange,
        notes: hint.notes,
      })),
      plusSizeTires: result.plusSizeTires?.map(tire => ({
        size: tire.size,
        wheelDiameter: tire.wheelDiameter,
        notes: tire.notes,
      })),
      surrogateVehicle: result.surrogateVehicle,
    },
    
    capabilities,
    
    messaging: {
      confidenceMessage: result.confidenceMessage,
      warningMessage: result.warningMessage,
      verifyPrompt: result.verifyPrompt,
      formattedResponse,
      safetyNotes: result.safetyNotes,
    },
    
    meta: {
      timestamp: result.lookupTimestamp,
      requestedVehicle: { year, make, model, trim },
      // External lookup metadata (if attempted)
      externalLookup: result.externalLookupAttempted ? {
        attempted: true,
        succeeded: result.externalLookupSucceeded || false,
        source: result.externalLookupSource,
        cached: result.externalLookupCached,
        durationMs: result.externalLookupDurationMs,
      } : undefined,
    },
  };
  
  // If a specific diameter was requested, include focused data
  if (diameterParam) {
    const diameter = parseInt(diameterParam, 10);
    if (!isNaN(diameter)) {
      const wheelHint = getWheelSearchHintForDiameter(result, diameter);
      const plusTires = getPlusSizeTiresForDiameter(result, diameter);
      const isSafe = isDiameterSafeForUpgrade(result, diameter);
      
      (response as any).focusedDiameter = {
        diameter,
        isSafeUpgrade: isSafe,
        wheelHint,
        plusSizeTires: plusTires,
      };
    }
  }
  
  // Cache for 1 hour (static data)
  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
