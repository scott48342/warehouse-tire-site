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

    // 2026-09-18 (audit F7): trim omitted and certified trims disagree. Do not
    // hand back the auto-picked first row as if it were this vehicle's fitment.
    if (result.trimRequired && result.trimAmbiguity) {
      // R3: also fires when a trim was requested but did not match any row (the
      // resolver would otherwise hand back an arbitrary first row).
      const amb = result.trimAmbiguity;
      return NextResponse.json({
        found: false,
        trimRequired: true,
        certifiable: false,
        ambiguous: amb.ambiguous,
        resolution: amb.resolution,
        year: result.year,
        make: result.make,
        model: result.model,
        trim: null,
        modificationId: null,
        error: amb.resolution === "error"
          ? `Trim required: fitment could not be verified (${amb.error ?? "ambiguity check error"})`
          : "Trim required: certified trims for this vehicle do not fully agree on fitment",
        fieldStates: amb.fieldStates,
        conflictingFields: amb.conflictingFields,
        unknownFields: amb.unknownFields,
        agreedFields: amb.agreedFields,
        sharedSpecs: amb.sharedSpecs,
        sharedFitment: {
          boltPattern: amb.sharedSpecs.boltPattern,
          centerBore: amb.sharedSpecs.centerBoreMm,
        },
        candidateTrims: amb.candidates,
        availableTrims: result.availableTrims,
        warnings: result.warnings,
        ...(debug ? { debug: result.debug, normalized: result.normalized, input: result.input } : {}),
      });
    }

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
      serviceSpecs: result.serviceSpecs,
      
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
        serviceSpecs: result.serviceSpecs,
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
