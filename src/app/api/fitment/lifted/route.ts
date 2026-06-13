/**
 * /api/fitment/lifted
 * 
 * Unified lifted fitment endpoint that combines:
 * 1. Base vehicle fitment from resolveUniversalFitment()
 * 2. Lifted recommendations overlay from VEHICLE_LIFT_PROFILES
 * 
 * This is the SINGLE SOURCE OF TRUTH for lifted fitment.
 * Both mobile and desktop should call this API.
 * 
 * @created 2026-06-13
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveUniversalFitment } from "@/lib/fitment/universalFitmentResolver";
import {
  getLiftRecommendation,
  type LiftLevel,
  type LiftRecommendation,
  type VehicleLiftProfile,
} from "@/lib/liftedRecommendations";

// ============================================================================
// TYPES
// ============================================================================

export interface LiftedFitmentRequest {
  year: string;
  make: string;
  model: string;
  trim?: string;
  liftLevel: "stock" | "daily" | "offroad" | "extreme";
}

export interface LiftedFitmentResponse {
  success: boolean;
  
  // Base vehicle info (from resolveUniversalFitment)
  vehicle: {
    year: number;
    make: string;
    model: string;
    trim: string | null;
  };
  
  // Base fitment data
  baseFitment: {
    boltPattern: string | null;
    centerBore: number | null;
    threadSize: string | null;
    seatType: string | null;
    oemTireSizes: string[];
    oemWheelSizes: Array<{ diameter: number; width: number }>;
    source: string;
    confidence: string;
    qualityTier: string;
  };
  
  // Lift level info
  liftLevel: {
    id: string;
    name: string;
    inches: number;
  };
  
  // Lifted recommendations (null if stock or no profile)
  liftedRecommendations: {
    hasProfile: boolean;
    profile: {
      make: string;
      model: string;
      platform?: string;
    } | null;
    recommendation: {
      tireDiameterMin: number;
      tireDiameterMax: number;
      commonTireSizes: string[];
      wheelDiameterMin: number;
      wheelDiameterMax: number;
      popularWheelSizes: number[];
      wheelWidthMin: number;
      wheelWidthMax: number;
      offsetMin: number;
      offsetMax: number;
      offsetLabel: string;
      stanceDescription: string;
      notes: string[];
    } | null;
  };
  
  // Combined shopping suggestions
  shoppingSuggestions: {
    tireSizes: string[];
    wheelDiameters: number[];
    offsetRange: { min: number; max: number } | null;
  };
  
  // Debug info
  debug: {
    resolverSource: string;
    liftedProfileFound: boolean;
    aliasUsed: boolean;
    resolutionTimeMs: number;
  };
}

// ============================================================================
// LIFT LEVEL CONFIG
// ============================================================================

const LIFT_LEVELS = {
  stock: { id: "stock", name: "Stock", inches: 0 },
  daily: { id: "daily", name: "Leveled", inches: 2 },
  offroad: { id: "offroad", name: "Lifted", inches: 4 },
  extreme: { id: "extreme", name: "Extreme", inches: 6 },
} as const;

// ============================================================================
// HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);
  
  const year = searchParams.get("year");
  const make = searchParams.get("make");
  const model = searchParams.get("model");
  const trim = searchParams.get("trim") || undefined;
  const liftLevelParam = searchParams.get("liftLevel") || "stock";
  
  // Validate required params
  if (!year || !make || !model) {
    return NextResponse.json(
      { success: false, error: "Missing required params: year, make, model" },
      { status: 400 }
    );
  }
  
  // Validate lift level
  if (!["stock", "daily", "offroad", "extreme"].includes(liftLevelParam)) {
    return NextResponse.json(
      { success: false, error: "Invalid liftLevel. Must be: stock, daily, offroad, extreme" },
      { status: 400 }
    );
  }
  
  const liftLevel = liftLevelParam as keyof typeof LIFT_LEVELS;
  const liftConfig = LIFT_LEVELS[liftLevel];
  
  try {
    // =========================================================================
    // STEP 1: Get base fitment from resolveUniversalFitment
    // =========================================================================
    console.log(`[fitment/lifted] Resolving base fitment for ${year} ${make} ${model}`);
    
    const baseFitmentResult = await resolveUniversalFitment({
      year: parseInt(year, 10),
      make,
      model,
      trim,
    });
    
    if (!baseFitmentResult) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Vehicle not found in fitment database",
          vehicle: { year: parseInt(year, 10), make, model, trim: trim || null },
        },
        { status: 404 }
      );
    }
    
    // =========================================================================
    // STEP 2: Get lifted recommendations overlay
    // =========================================================================
    let liftedProfile: VehicleLiftProfile | null = null;
    let liftedRecommendation: LiftRecommendation | null = null;
    
    if (liftLevel !== "stock") {
      // Use the RESOLVED make/model from universalFitmentResolver
      // This ensures aliases are handled correctly
      const resolvedMake = baseFitmentResult.make;
      const resolvedModel = baseFitmentResult.model;
      const resolvedYear = baseFitmentResult.year;
      
      console.log(`[fitment/lifted] Looking up lifted profile for: ${resolvedMake} ${resolvedModel} (resolved from ${make} ${model})`);
      
      const liftResult = getLiftRecommendation(
        resolvedMake,
        resolvedModel,
        liftLevel as LiftLevel,
        resolvedYear
      );
      
      if (liftResult) {
        liftedProfile = liftResult.profile;
        liftedRecommendation = liftResult.recommendation;
        console.log(`[fitment/lifted] ✅ Found lifted profile: ${liftedProfile.key}`);
      } else {
        // Try with original make/model as fallback
        const fallbackResult = getLiftRecommendation(
          make,
          model,
          liftLevel as LiftLevel,
          parseInt(year, 10)
        );
        if (fallbackResult) {
          liftedProfile = fallbackResult.profile;
          liftedRecommendation = fallbackResult.recommendation;
          console.log(`[fitment/lifted] ✅ Found lifted profile via fallback: ${liftedProfile.key}`);
        } else {
          console.log(`[fitment/lifted] ⚠️ No lifted profile found for ${resolvedMake} ${resolvedModel}`);
        }
      }
    }
    
    // =========================================================================
    // STEP 3: Build combined shopping suggestions
    // =========================================================================
    let shoppingSuggestions: LiftedFitmentResponse["shoppingSuggestions"];
    
    if (liftLevel === "stock" || !liftedRecommendation) {
      // Stock or no lifted profile - use OEM data
      shoppingSuggestions = {
        tireSizes: baseFitmentResult.oemTireSizes || [],
        wheelDiameters: (baseFitmentResult.oemWheelSizes || []).map(w => w.diameter),
        offsetRange: null, // OEM offset, no filter needed
      };
    } else {
      // Lifted profile exists - use lifted recommendations
      shoppingSuggestions = {
        tireSizes: liftedRecommendation.commonTireSizes,
        wheelDiameters: liftedRecommendation.popularWheelSizes,
        offsetRange: {
          min: liftedRecommendation.offsetMin,
          max: liftedRecommendation.offsetMax,
        },
      };
    }
    
    // =========================================================================
    // STEP 4: Build response
    // =========================================================================
    const response: LiftedFitmentResponse = {
      success: true,
      
      vehicle: {
        year: baseFitmentResult.year,
        make: baseFitmentResult.make,
        model: baseFitmentResult.model,
        trim: baseFitmentResult.trim || null,
      },
      
      baseFitment: {
        boltPattern: baseFitmentResult.boltPattern,
        centerBore: baseFitmentResult.centerBore,
        threadSize: baseFitmentResult.threadSize || null,
        seatType: baseFitmentResult.lugSeatType || null,
        oemTireSizes: baseFitmentResult.oemTireSizes || [],
        oemWheelSizes: baseFitmentResult.oemWheelSizes || [],
        source: baseFitmentResult.source,
        confidence: baseFitmentResult.confidence,
        qualityTier: baseFitmentResult.qualityTier,
      },
      
      liftLevel: liftConfig,
      
      liftedRecommendations: {
        hasProfile: !!liftedProfile,
        profile: liftedProfile ? {
          make: liftedProfile.make,
          model: liftedProfile.model,
          platform: liftedProfile.platform,
        } : null,
        recommendation: liftedRecommendation ? {
          tireDiameterMin: liftedRecommendation.tireDiameterMin,
          tireDiameterMax: liftedRecommendation.tireDiameterMax,
          commonTireSizes: liftedRecommendation.commonTireSizes,
          wheelDiameterMin: liftedRecommendation.wheelDiameterMin,
          wheelDiameterMax: liftedRecommendation.wheelDiameterMax,
          popularWheelSizes: liftedRecommendation.popularWheelSizes,
          wheelWidthMin: liftedRecommendation.wheelWidthMin,
          wheelWidthMax: liftedRecommendation.wheelWidthMax,
          offsetMin: liftedRecommendation.offsetMin,
          offsetMax: liftedRecommendation.offsetMax,
          offsetLabel: liftedRecommendation.offsetLabel,
          stanceDescription: liftedRecommendation.stanceDescription,
          notes: liftedRecommendation.notes,
        } : null,
      },
      
      shoppingSuggestions,
      
      debug: {
        resolverSource: baseFitmentResult.source,
        liftedProfileFound: !!liftedProfile,
        aliasUsed: baseFitmentResult.normalized.matchedVariant !== null && 
                   baseFitmentResult.normalized.matchedVariant.toLowerCase() !== model.toLowerCase(),
        resolutionTimeMs: Date.now() - startTime,
      },
    };
    
    console.log(`[fitment/lifted] ✅ Response ready in ${response.debug.resolutionTimeMs}ms`);
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error("[fitment/lifted] Error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
