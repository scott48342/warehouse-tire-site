/**
 * Jake Build Tracking API
 * 
 * POST /api/jake/build - Track a Jake Garage build/conversation
 * PATCH /api/jake/build - Update an existing build
 * 
 * @created 2026-07-18
 */

import { NextRequest, NextResponse } from "next/server";
import { trackJakeBuild, linkJakeBuildToLead, detectSourceSite } from "@/lib/leads";

/**
 * POST /api/jake/build
 * Track a new Jake Garage build/conversation
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate required fields
    if (!body.conversationId) {
      return NextResponse.json(
        { error: "conversationId is required" },
        { status: 400 }
      );
    }
    
    // Detect source site
    const hostname = req.headers.get("host");
    const sourceSite = body.sourceSite || detectSourceSite(hostname || undefined);
    
    const build = await trackJakeBuild({
      conversationId: body.conversationId,
      sessionId: body.sessionId,
      
      vehicle: body.vehicle ? {
        year: body.vehicle.year,
        make: body.vehicle.make,
        model: body.vehicle.model,
        trim: body.vehicle.trim,
      } : undefined,
      
      buildStyle: body.buildStyle,
      tireSize: body.tireSize,
      wheelDiameter: body.wheelDiameter,
      wheelWidth: body.wheelWidth,
      liftHeight: body.liftHeight,
      
      recommendedWheels: body.recommendedWheels,
      recommendedTires: body.recommendedTires,
      recommendedPackageValue: body.recommendedPackageValue,
      
      messageCount: body.messageCount,
      lastUserMessage: body.lastUserMessage,
      toolsUsed: body.toolsUsed,
      
      sourceSite,
      isTest: body.isTest,
    });
    
    if (!build) {
      return NextResponse.json(
        { error: "Failed to track build" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      buildId: build.id,
    });
    
  } catch (err: any) {
    console.error(`[api/jake/build] Error:`, err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/jake/build
 * Link a build to a lead (when email is captured)
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate required fields
    if (!body.conversationId || !body.email) {
      return NextResponse.json(
        { error: "conversationId and email are required" },
        { status: 400 }
      );
    }
    
    await linkJakeBuildToLead(body.conversationId, body.email);
    
    return NextResponse.json({ success: true });
    
  } catch (err: any) {
    console.error(`[api/jake/build] Error linking build:`, err);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
