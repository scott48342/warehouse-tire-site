/**
 * Universal Fitment Profile API
 * 
 * GET /api/fitment/profile?year=2023&make=Chevrolet&model=Silverado+2500+HD
 * 
 * This is the PUBLIC WRAPPER around universalFitmentResolver.
 * All systems (tires, wheels, packages, POS, Jake) should use this API
 * to get consistent fitment data.
 * 
 * @created 2026-06-13 - Migrated to universalFitmentResolver
 */

import { NextResponse } from "next/server";
import { resolveUniversalFitment, type UniversalFitmentResult } from "@/lib/fitment/universalFitmentResolver";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/fitment/profile
 * 
 * Query params:
 * - year (required): Vehicle year
 * - make (required): Vehicle make
 * - model (required): Vehicle model
 * - trim (optional): Vehicle trim/modification
 * - modification (optional): Legacy param, alias for trim
 * - wheelDiameter (optional): Filter for specific wheel diameter
 * - debug (optional): Include debug info in response
 * 
 * Returns: UniversalFitmentResult
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");
  
  // Support both 'trim' and 'modification' params for backward compat
  const modification = url.searchParams.get("modification");
  const trimParam = url.searchParams.get("trim");
  const trim = modification || trimParam || undefined;
  
  const wheelDiameter = url.searchParams.get("wheelDiameter");
  const debug = url.searchParams.get("debug") === "1" || url.searchParams.get("debug") === "true";

  // Validation
  if (!year || !make || !model) {
    return NextResponse.json(
      { 
        error: "Missing required params: year, make, model",
        found: false,
      },
      { status: 400 }
    );
  }

  const yearNum = parseInt(year, 10);
  if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
    return NextResponse.json(
      { 
        error: "Invalid year",
        found: false,
      },
      { status: 400 }
    );
  }

  try {
    // Use the universal resolver
    const result = await resolveUniversalFitment({
      year: yearNum,
      make,
      model,
      trim: trim || null,
      wheelDiameter: wheelDiameter ? parseInt(wheelDiameter, 10) : null,
    });

    // Build response
    const response: any = {
      // Core fitment data
      found: result.found,
      year: result.year,
      make: result.make,
      model: result.model,
      trim: result.trim,
      modificationId: result.modificationId,
      
      // Bolt pattern and hardware
      boltPattern: result.boltPattern,
      centerBore: result.centerBore,
      threadSize: result.threadSize,
      lugSeatType: result.lugSeatType,
      
      // Tire data
      oemTireSizes: result.oemTireSizes,
      oemTireSizesStaggered: result.oemTireSizesStaggered,
      
      // Wheel ranges
      wheelDiameterRange: result.wheelDiameterRange,
      wheelWidthRange: result.wheelWidthRange,
      offsetRange: result.offsetRange,
      
      // OEM specs
      oemWheelSizes: result.oemWheelSizes,
      
      // Metadata
      source: result.source,
      qualityTier: result.qualityTier,
      confidence: result.confidence,
      canonicalVehicleKey: result.canonicalVehicleKey,
      
      // Available trims (for UI)
      availableTrims: result.availableTrims,
      
      // Warnings
      warnings: result.warnings,
      
      // For backward compatibility with old API shape
      vehicle: {
        year: result.year,
        make: result.make,
        model: result.model,
        trim: result.trim,
      },
      fitment: {
        boltPattern: result.boltPattern,
        centerBore: result.centerBore,
        threadSize: result.threadSize,
        lugSeatType: result.lugSeatType,
      },
      derived: {
        allowedDiameters: result.wheelDiameterRange 
          ? Array.from({ length: result.wheelDiameterRange.max - result.wheelDiameterRange.min + 1 }, 
              (_, i) => result.wheelDiameterRange!.min + i)
          : [],
        allowedWidths: result.wheelWidthRange
          ? [result.wheelWidthRange.min, result.wheelWidthRange.max]
          : [],
        allowedOffsets: result.offsetRange
          ? [result.offsetRange.min, result.offsetRange.max]
          : [],
        boltPattern: result.boltPattern,
        centerBore: result.centerBore,
      },
    };

    // Include debug info if requested
    if (debug) {
      response.debug = result.debug;
      response.normalized = result.normalized;
      response.input = result.input;
    }

    // Return 404 if not found
    if (!result.found) {
      return NextResponse.json(response, { status: 404 });
    }

    return NextResponse.json(response);
    
  } catch (err: any) {
    console.error("[api/fitment/profile] Error:", err);
    return NextResponse.json(
      { 
        error: err?.message || String(err),
        found: false,
      },
      { status: 500 }
    );
  }
}
