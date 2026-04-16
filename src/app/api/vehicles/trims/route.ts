/**
 * Vehicle Trims API (Coverage-Validated + Cached)
 * 
 * GET /api/vehicles/trims?year=2022&make=Ford&model=F-150
 * 
 * Returns ONLY trims that have actual fitment data in the database.
 * Uses Redis cache to reduce DB load.
 */

import { NextResponse } from "next/server";
import { getTrimsWithCoverage } from "@/lib/fitment-db/coverage";
import { isPremiumTrimUxEnabled, isBaseTrim } from "@/lib/features/premiumTrimUx";
import {
  getCachedTrims,
  setCachedTrims,
  type TrimEntry,
} from "@/lib/fitment-db/ymmCache";

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
  source: "fitment_db" | "cache" | "no_coverage" | "error" | "fallback";
  count?: number;
  hasCoverage?: boolean;
  error?: string;
  premiumUx?: boolean;
  warning?: string;
}

// ============================================================================
// Main Route Handler
// ============================================================================

/**
 * GET /api/vehicles/trims?year=2022&make=Ford&model=F-150
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

  const premiumUxEnabled = isPremiumTrimUxEnabled();

  // 1. Check cache first
  try {
    const cached = await getCachedTrims(year, make, model);
    if (cached && cached.length > 0) {
      console.log(`[trims] CACHE HIT: ${cached.length} trims for ${year} ${make} ${model}`);
      
      const results = processTrims(cached, premiumUxEnabled);
      
      return NextResponse.json<TrimResponse>({
        results,
        source: "cache",
        count: results.length,
        hasCoverage: true,
        premiumUx: premiumUxEnabled,
      }, {
        headers: { "Cache-Control": "public, max-age=300, s-maxage=600" },
      });
    }
  } catch (e) {
    // Cache error - continue to DB
  }

  // 2. Try DB
  try {
    const coverage = await getTrimsWithCoverage(year, make, model);
    
    if (coverage.hasCoverage) {
      console.log(`[trims] DB: ${coverage.trims.length} trims for ${year} ${make} ${model}`);
      
      // Cache the raw trims (fire and forget)
      setCachedTrims(coverage.trims, year, make, model).catch(() => {});
      
      const results = processTrims(coverage.trims, premiumUxEnabled);
      
      return NextResponse.json<TrimResponse>({
        results,
        source: "fitment_db",
        count: results.length,
        hasCoverage: true,
        premiumUx: premiumUxEnabled,
      }, {
        headers: { "Cache-Control": "public, max-age=300, s-maxage=600" },
      });
    }
    
    // No coverage
    console.warn(`[trims] NO COVERAGE: ${year} ${make} ${model}`);
    return NextResponse.json<TrimResponse>({ 
      results: [],
      source: "no_coverage",
      hasCoverage: false,
    });
    
  } catch (err: any) {
    console.error(`[trims] DB error for ${year} ${make} ${model}:`, err?.message);
    
    // 3. Return empty with error (no fallback for trims - they're vehicle-specific)
    return NextResponse.json<TrimResponse>({ 
      results: [],
      source: "fallback",
      hasCoverage: false,
      warning: "Unable to load trim data - please try again",
    }, {
      headers: { "Cache-Control": "public, max-age=30, s-maxage=30" },
    });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Process raw trim entries into display format
 */
function processTrims(trims: TrimEntry[], premiumUxEnabled: boolean): TrimOption[] {
  const results: TrimOption[] = [];
  
  for (const t of trims) {
    const rawLabel = t.displayTrim || (premiumUxEnabled ? "" : "Base");
    
    // Skip empty labels when premium UX is on
    if (premiumUxEnabled && !rawLabel) {
      continue;
    }
    
    const label = rawLabel;
    
    // Split grouped trims (comma or slash separated)
    if (label.includes(",") || label.includes("/")) {
      const individualTrims = label.split(/[,\/]/).map(s => s.trim()).filter(Boolean);
      for (const trimName of individualTrims) {
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
  
  return results;
}
