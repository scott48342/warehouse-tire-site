import { NextResponse } from "next/server";
import * as catalogStore from "@/lib/catalog-store";
import * as wheelSizeApi from "@/lib/wheelSizeApi";
import { normalizeMake } from "@/lib/fitment-db/keys";

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
  
  // Try catalog first
  const catalogModel = catalogStore.findModel(makeSlug, model);
  if (catalogModel && catalogModel.years.length > 0) {
    console.log(`[years] CATALOG HIT: ${make} ${model} → ${catalogModel.years.length} years`);
    return NextResponse.json({ 
      results: catalogModel.years.map(String),
      source: "catalog",
    }, {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });
  }

  // Catalog miss - try API directly
  try {
    // Resolve make/model to slugs
    const resolved = await wheelSizeApi.resolveMakeModel(make, model);
    if (resolved) {
      const years = await wheelSizeApi.getYears(resolved.makeSlug, resolved.modelSlug);
      if (years.length > 0) {
        console.log(`[years] API: ${make} ${model} → ${years.length} years`);
        
        // Store in catalog for future use
        try {
          await catalogStore.populateModels(resolved.makeSlug);
        } catch (e) {
          // Non-fatal - just log
          console.warn(`[years] Failed to populate catalog:`, e);
        }
        
        return NextResponse.json({ 
          results: years.sort((a, b) => b - a).map(String),
          source: "api",
        }, {
          headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
        });
      }
    }
  } catch (err: any) {
    console.error(`[years] API error for ${make} ${model}:`, err?.message);
  }

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
