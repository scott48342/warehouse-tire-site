import { NextResponse } from "next/server";
import * as catalogStore from "@/lib/catalog-store";
import { normalizeMake } from "@/lib/fitment-db/keys";

// ============================================================================
// WHEEL-SIZE API REMOVED (Phase A - DB-First Architecture)
// All vehicle data comes from local catalog. No external API calls.
// ============================================================================

export const runtime = "nodejs";

/**
 * GET /api/vehicles/years?make=Buick&model=Encore
 * 
 * Returns VALID years for a make/model from the Wheel-Size catalog.
 * This prevents invalid combinations like "2006 Buick Encore" (Encore started 2013).
 * 
 * Falls back to static range if catalog data unavailable.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");

  // If no make/model provided, return reasonable default range
  if (!make || !model) {
    const currentYear = new Date().getFullYear();
    const results: string[] = [];
    for (let y = currentYear + 1; y >= 2000; y--) {
      results.push(String(y));
    }
    return NextResponse.json({ results, source: "static" });
  }

  const makeSlug = normalizeMake(make);
  
  // Try catalog first (DB)
  const catalogModel = await catalogStore.findModel(makeSlug, model);
  if (catalogModel && catalogModel.years.length > 0) {
    console.log(`[years] CATALOG HIT: ${make} ${model} → ${catalogModel.years.length} years`);
    return NextResponse.json({ 
      results: catalogModel.years.map(String),
      source: "catalog",
    }, {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });
  }

  // REMOVED: Wheel-Size API fallback (Phase A - DB-first architecture)
  // All vehicle data must come from local catalog
  console.log(`[years] CATALOG MISS: ${make} ${model} - no API fallback (DB-first mode)`);

  // Final fallback: static range (but log warning)
  console.warn(`[years] FALLBACK to static range for ${make} ${model} - data not in catalog or API`);
  const currentYear = new Date().getFullYear();
  const results: string[] = [];
  for (let y = currentYear + 1; y >= 2000; y--) {
    results.push(String(y));
  }
  
  return NextResponse.json({ 
    results,
    source: "fallback",
    warning: "No catalog data for this make/model - showing all years",
  });
}
