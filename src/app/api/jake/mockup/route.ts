/**
 * Jake Visual Mockup API
 * 
 * POST /api/jake/mockup
 * 
 * Generates visual inspiration mockups showing wheel/tire setups on vehicles.
 * For VISUAL INSPIRATION ONLY - not fitment verification.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateMockup, MockupRequest, MOCKUP_DISCLAIMER, MOCKUP_ERROR_CODES } from "@/lib/jake/mockup";

export const runtime = "nodejs";
export const maxDuration = 90; // Image generation can take up to 60s

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate required fields
    const { vehicle, build } = body;
    
    if (!vehicle?.year || !vehicle?.make || !vehicle?.model || !vehicle?.color) {
      return NextResponse.json(
        { error: "Missing required vehicle fields (year, make, model, color)" },
        { status: 400 }
      );
    }
    
    if (!build?.wheelStyle || !build?.wheelSize || !build?.tireStyle) {
      return NextResponse.json(
        { error: "Missing required build fields (wheelStyle, wheelSize, tireStyle)" },
        { status: 400 }
      );
    }
    
    // Validate build style
    const validBuildStyles = ["stock", "leveled", "lifted-2", "lifted-4", "lifted-6", "lowered"];
    if (build.style && !validBuildStyles.includes(build.style)) {
      build.style = "stock";
    }
    
    // Validate tire style
    const validTireStyles = ["all-terrain", "mud-terrain", "highway", "performance", "all-season"];
    if (!validTireStyles.includes(build.tireStyle)) {
      build.tireStyle = "all-terrain";
    }
    
    console.log(`[Jake Mockup] Generating: ${vehicle.year} ${vehicle.make} ${vehicle.model} with ${build.wheelStyle}`);
    
    const request: MockupRequest = {
      vehicle: {
        year: parseInt(vehicle.year),
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim,
        color: vehicle.color,
      },
      build: {
        style: build.style || "stock",
        wheelStyle: build.wheelStyle,
        wheelSize: parseInt(build.wheelSize),
        tireStyle: build.tireStyle,
        tireSize: build.tireSize,
      },
      sessionId: body.sessionId,
    };
    
    const result = await generateMockup(request);
    
    if (!result.success) {
      console.error(`[Jake Mockup] Failed: ${result.errorCode} - ${result.error}`);
      return NextResponse.json(
        { 
          success: false,
          error: result.error || "Generation failed",
          errorCode: result.errorCode || MOCKUP_ERROR_CODES.UNKNOWN,
          disclaimer: MOCKUP_DISCLAIMER,
          generationTime: result.generationTime,
        },
        { status: 500 }
      );
    }
    
    console.log(`[Jake Mockup] Success: ${result.generationMethod}, ${result.generationTime}ms, cached: ${result.cached}`);
    
    return NextResponse.json({
      success: true,
      imageUrl: result.imageUrl,
      disclaimer: result.disclaimer,
      generationMethod: result.generationMethod,
      cached: result.cached,
      generationTime: result.generationTime,
    });
    
  } catch (error) {
    console.error("[Jake Mockup] Error:", error);
    return NextResponse.json(
      { 
        error: "Internal server error",
        disclaimer: MOCKUP_DISCLAIMER,
      },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "jake-mockup",
    disclaimer: MOCKUP_DISCLAIMER,
  });
}
