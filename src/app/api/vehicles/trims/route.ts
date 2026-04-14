/**
 * Vehicle Trims API (Coverage-Validated)
 * 
 * GET /api/vehicles/trims?year=2022&make=Ford&model=F-150
 * 
 * Returns ONLY trims that have actual fitment data in the database.
 * No fallback to "Base" or supplements - if no coverage exists, returns empty.
 * 
 * Premium Trim UX (when NEXT_PUBLIC_ENABLE_PREMIUM_TRIM_UX=true):
 * - Never returns "Base" as a trim label
 * - Returns empty if only "Base" would have been shown
 */

import { NextResponse } from "next/server";
import { getTrimsWithCoverage, hasYearCoverage } from "@/lib/fitment-db/coverage";
import { isPremiumTrimUxEnabled, isBaseTrim } from "@/lib/features/premiumTrimUx";

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

  // Check if premium trim UX is enabled
  const premiumUxEnabled = isPremiumTrimUxEnabled();
  
  try {
    // Get trims with actual fitment coverage
    const coverage = await getTrimsWithCoverage(year, make, model);
    
    if (coverage.hasCoverage) {
      console.log(`[trims] COVERAGE: ${year} ${make} ${model} → ${coverage.trims.length} trim(s) with fitment data`);
      
      // Split grouped trim labels (e.g., "LS, LT, RST" or "SE/ZX3/ZX5") into individual options
      // All split trims share the same modificationId since they have identical specs
      const results: TrimOption[] = [];
      for (const t of coverage.trims) {
        // When premium UX is enabled, skip "Base" fallback - use empty displayTrim instead
        const rawLabel = t.displayTrim || (premiumUxEnabled ? "" : "Base");
        
        // Skip empty labels entirely when premium UX is on
        if (premiumUxEnabled && !rawLabel) {
          continue;
        }
        
        const label = rawLabel;
        
        // Check if this is a grouped trim (contains comma or slash)
        if (label.includes(",") || label.includes("/")) {
          // Split on comma or slash
          const individualTrims = label.split(/[,\/]/).map(s => s.trim()).filter(Boolean);
          for (const trimName of individualTrims) {
            // Skip "Base" variants when premium UX is enabled
            if (premiumUxEnabled && isBaseTrim(trimName)) {
              continue;
            }
            results.push({
              value: t.modificationId,
              label: trimName,
              modificationId: t.modificationId,
            });
          }
        } else {
          // Skip "Base" variants when premium UX is enabled
          if (premiumUxEnabled && isBaseTrim(label)) {
            continue;
          }
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
        premiumUx: premiumUxEnabled, // Include flag status for debugging
      } as TrimResponse, {
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
