/**
 * Vehicle Trims API (Coverage-Validated)
 * 
 * GET /api/vehicles/trims?year=2022&make=Ford&model=F-150
 * 
 * Returns ONLY trims that have actual fitment data in the database.
 * No fallback to "Base" or supplements - if no coverage exists, returns empty.
 */

import { NextResponse } from "next/server";
import { getTrimsWithCoverage, hasYearCoverage } from "@/lib/fitment-db/coverage";

export const runtime = "nodejs";

// ============================================================================
// Types
// ============================================================================

type TrimOption = {
  value: string;
  label: string;
  modificationId: string;
};

interface TrimResponse {
  results: TrimOption[];
  source: "fitment_db" | "no_coverage" | "error";
  count?: number;
  hasCoverage?: boolean;
  error?: string;
}

// ============================================================================
// Main Route Handler
// ============================================================================

/**
 * GET /api/vehicles/trims?year=2022&make=Ford&model=F-150
 * 
 * Returns trims with actual fitment coverage. No fallbacks.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const yearStr = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");

  if (!yearStr || !make || !model) {
    return NextResponse.json<TrimResponse>({ 
      results: [],
      source: "error",
      error: "year, make, and model parameters are required",
    });
  }

  const year = parseInt(yearStr, 10);
  if (isNaN(year)) {
    return NextResponse.json<TrimResponse>({ 
      results: [],
      source: "error",
      error: "Invalid year parameter",
    });
  }

  try {
    // Get trims with actual fitment coverage
    const coverage = await getTrimsWithCoverage(year, make, model);
    
    if (coverage.hasCoverage) {
      console.log(`[trims] COVERAGE: ${year} ${make} ${model} → ${coverage.trims.length} trim(s) with fitment data`);
      
      // Split grouped trim labels (e.g., "LS, LT, RST" or "SE/ZX3/ZX5") into individual options
      // All split trims share the same modificationId since they have identical specs
      const results: TrimOption[] = [];
      for (const t of coverage.trims) {
        const label = t.displayTrim || "Base";
        // Check if this is a grouped trim (contains comma or slash)
        if (label.includes(",") || label.includes("/")) {
          // Split on comma or slash
          const individualTrims = label.split(/[,\/]/).map(s => s.trim()).filter(Boolean);
          for (const trimName of individualTrims) {
            results.push({
              value: t.modificationId,
              label: trimName,
              modificationId: t.modificationId,
            });
          }
        } else {
          results.push({
            value: t.modificationId,
            label,
            modificationId: t.modificationId,
          });
        }
      }
      
      return NextResponse.json<TrimResponse>({
        results,
        source: "fitment_db",
        count: results.length,
        hasCoverage: true,
      }, {
        headers: { "Cache-Control": "public, max-age=300, s-maxage=600" },
      });
    }
    
    // No coverage - return empty (NOT a fallback Base trim)
    console.warn(`[trims] NO COVERAGE: ${year} ${make} ${model} has no fitment data`);
    return NextResponse.json<TrimResponse>({ 
      results: [],
      source: "no_coverage",
      hasCoverage: false,
    });
    
  } catch (err: any) {
    console.error(`[trims] DB error for ${year} ${make} ${model}:`, err?.message);
    return NextResponse.json<TrimResponse>({ 
      results: [],
      source: "error",
      error: "Failed to check fitment coverage",
    }, { status: 500 });
  }
}
