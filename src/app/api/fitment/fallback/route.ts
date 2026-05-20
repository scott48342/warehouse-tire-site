/**
 * Fallback Fitment API
 * 
 * Provides inferred/common OEM fitment data + aftermarket search profiles
 * for vehicles not yet in the WTD database.
 * 
 * GET /api/fitment/fallback?year=2009&make=Cadillac&model=DTS
 * 
 * @created 2026-05-20
 * @updated 2026-05-20 - Added aftermarket search profile support
 */

import { NextRequest, NextResponse } from "next/server";
import {
  lookupFallbackFitment,
  formatFallbackForJake,
  canSearchWithFallback,
  getWheelSearchHintForDiameter,
  getPlusSizeTiresForDiameter,
  isDiameterSafeForUpgrade,
  type FallbackFitmentResult,
} from "@/lib/fitment/fallbackFitmentService";

export const runtime = "edge";

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
  
  // Look up fallback fitment
  const result = lookupFallbackFitment({ year, make, model, trim });
  
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
