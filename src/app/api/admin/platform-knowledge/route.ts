/**
 * Admin API: Platform Knowledge
 * 
 * Endpoints for viewing enthusiast platform knowledge.
 * 
 * GET /api/admin/platform-knowledge
 *     ?action=list         - List all platform profiles
 *     ?action=lookup       - Lookup platform for a vehicle
 *     ?year=1998&make=Pontiac&model=Firebird&trim=Formula
 *     ?action=guidance     - Get wheel size guidance
 *     ?year=1998&make=Pontiac&model=Firebird&diameter=20
 * 
 * @created 2026-05-20
 */

import { NextRequest, NextResponse } from "next/server";
import {
  lookupPlatform,
  getEnthusiastGuidance,
  formatPlatformGuidanceForJake,
  getAllPlatforms,
  getRelatedPlatforms,
} from "@/lib/fitment/platformKnowledgeService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "list";
    
    if (action === "list") {
      const platforms = getAllPlatforms();
      return NextResponse.json({
        success: true,
        count: platforms.length,
        platforms: platforms.map(p => ({
          platformId: p.platformId,
          name: p.name,
          years: p.years,
          makes: p.makes,
          models: p.models,
          boltPattern: p.oemBoltPatternMetric,
          centerBore: p.oemCenterBore,
          staggeredCommon: p.staggeredCommon,
          enthusiastDiameters: p.enthusiastDiameters,
          relatedPlatforms: p.relatedPlatforms,
        })),
      });
    }
    
    if (action === "lookup") {
      const year = parseInt(searchParams.get("year") || "", 10);
      const make = searchParams.get("make") || "";
      const model = searchParams.get("model") || "";
      const trim = searchParams.get("trim") || undefined;
      
      if (!year || !make || !model) {
        return NextResponse.json(
          { success: false, error: "Missing year, make, or model" },
          { status: 400 }
        );
      }
      
      const result = lookupPlatform(year, make, model, trim);
      
      return NextResponse.json({
        success: result.found,
        vehicle: { year, make, model, trim },
        ...result,
      });
    }
    
    if (action === "guidance") {
      const year = parseInt(searchParams.get("year") || "", 10);
      const make = searchParams.get("make") || "";
      const model = searchParams.get("model") || "";
      const trim = searchParams.get("trim") || undefined;
      const diameter = parseInt(searchParams.get("diameter") || "", 10);
      
      if (!year || !make || !model) {
        return NextResponse.json(
          { success: false, error: "Missing year, make, or model" },
          { status: 400 }
        );
      }
      
      const platformResult = lookupPlatform(year, make, model, trim);
      
      if (!platformResult.found || !platformResult.platform) {
        return NextResponse.json({
          success: false,
          error: "No platform knowledge found for this vehicle",
          vehicle: { year, make, model, trim },
        });
      }
      
      const guidance = diameter 
        ? getEnthusiastGuidance(platformResult.platform, diameter)
        : null;
      
      const formattedGuidance = formatPlatformGuidanceForJake(
        platformResult.platform, 
        diameter || undefined
      );
      
      const relatedPlatforms = getRelatedPlatforms(platformResult.platform.platformId);
      
      return NextResponse.json({
        success: true,
        vehicle: { year, make, model, trim },
        platform: {
          id: platformResult.platform.platformId,
          name: platformResult.platform.name,
        },
        requestedDiameter: diameter || null,
        guidance,
        formattedGuidance,
        searchHints: platformResult.searchHints,
        relatedPlatforms: relatedPlatforms.map(p => ({
          id: p.platformId,
          name: p.name,
          boltPattern: p.oemBoltPatternMetric,
        })),
        culturalNotes: platformResult.platform.culturalNotes,
        commonMistakes: platformResult.platform.commonMistakes,
        popularWheelStyles: platformResult.platform.popularWheelStyles,
      });
    }
    
    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (err) {
    console.error("[admin/platform-knowledge] GET error:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
