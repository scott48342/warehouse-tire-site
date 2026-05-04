/**
 * Vehicle Trims API (Coverage-Validated + Cached)
 * 
 * GET /api/vehicles/trims?year=2022&make=Ford&model=F-150
 * 
 * Returns ONLY trims that have actual fitment data in the database.
 * Uses Redis cache to reduce DB load.
 * 
 * 2026-05-04: CANONICAL FITMENT FIX
 * - Explodes grouped trims into atomic options
 * - Each atomic trim gets a unique canonical ID
 * - Resolves the "LX, Sport, EX" → shared modificationId problem
 */

import { NextResponse } from "next/server";
import { getTrimsWithCoverage } from "@/lib/fitment-db/coverage";
import { isPremiumTrimUxEnabled, isBaseTrim } from "@/lib/features/premiumTrimUx";
import {
  getCachedTrims,
  setCachedTrims,
  type TrimEntry,
} from "@/lib/fitment-db/ymmCache";
import { getAtomicTrimOptions } from "@/lib/fitment/canonicalResolver";

export const runtime = "nodejs";

// ============================================================================
// Types
// ============================================================================

type TrimOption = {
  value: string;              // Canonical fitment ID (unique per atomic trim)
  label: string;              // Display name (atomic, not grouped)
  modificationId: string;     // DB modificationId (may be shared by grouped record)
  canonicalFitmentId?: string; // Unique ID for this specific trim
  isFromGroupedRecord?: boolean; // True if exploded from grouped record
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
  const noCache = url.searchParams.get("nocache") === "1";

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

  // 1. Check cache first (skip if nocache=1)
  if (!noCache) {
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
  }

  // 2. Try DB with canonical resolver (2026-05-04 fix)
  try {
    // Use canonical resolver to get atomic trim options
    // This explodes grouped trims and assigns unique canonical IDs
    const atomicOptions = await getAtomicTrimOptions(year, make, model);
    
    if (atomicOptions.length > 0) {
      console.log(`[trims] CANONICAL: ${atomicOptions.length} atomic trims for ${year} ${make} ${model}`);
      
      // Convert to TrimOption format
      let results: TrimOption[] = atomicOptions.map(opt => ({
        value: opt.canonicalFitmentId, // Use canonical ID as value (unique per trim)
        label: opt.label,
        modificationId: opt.modificationId,
        canonicalFitmentId: opt.canonicalFitmentId,
        isFromGroupedRecord: opt.isFromGroupedRecord,
      }));
      
      // Apply premium UX filtering if enabled
      if (premiumUxEnabled) {
        const filtered = results.filter(t => !isBaseTrim(t.label));
        if (filtered.length > 0) {
          results = filtered;
        } else if (results.length > 0) {
          // All are base trims - return single "Standard" option
          results = [{
            value: results[0].value,
            label: "Standard",
            modificationId: results[0].modificationId,
            canonicalFitmentId: results[0].canonicalFitmentId,
          }];
        }
      }
      
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
    
    // Fallback to legacy coverage check
    const coverage = await getTrimsWithCoverage(year, make, model);
    
    if (coverage.hasCoverage) {
      console.log(`[trims] LEGACY DB: ${coverage.trims.length} trims for ${year} ${make} ${model}`);
      
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
 * 
 * Priority:
 * 1. Individual trim records (display_trim without commas) - preferred
 * 2. Grouped trim records (comma-separated) - used as fallback
 * 
 * Dedupes by label to avoid showing "Sport" twice when we have both
 * an individual "Sport" record and a grouped "LX, Sport, EX" record.
 */
function processTrims(trims: TrimEntry[], premiumUxEnabled: boolean): TrimOption[] {
  const seenLabels = new Map<string, TrimOption>(); // label -> best option
  let hasOnlyBaseTrims = true;
  let firstBaseTrim: TrimEntry | null = null;
  
  // First pass: collect individual records (no commas) - these are preferred
  for (const t of trims) {
    const rawLabel = t.displayTrim || "";
    
    // Skip grouped trims in first pass
    if (rawLabel.includes(",")) continue;
    
    if (premiumUxEnabled && (!rawLabel || isBaseTrim(rawLabel))) {
      if (!firstBaseTrim) firstBaseTrim = t;
      continue;
    }
    
    if (rawLabel) {
      hasOnlyBaseTrims = false;
      const normalizedLabel = rawLabel.trim();
      if (!seenLabels.has(normalizedLabel)) {
        seenLabels.set(normalizedLabel, {
          value: t.modificationId,
          label: normalizedLabel,
          modificationId: t.modificationId,
        });
      }
    }
  }
  
  // Second pass: add trims from grouped records if not already seen
  for (const t of trims) {
    const rawLabel = t.displayTrim || "";
    
    // Only process grouped trims in second pass
    if (!rawLabel.includes(",")) continue;
    
    const individualTrims = rawLabel.split(/[,\/]/).map(s => s.trim()).filter(Boolean);
    for (const trimName of individualTrims) {
      if (premiumUxEnabled && isBaseTrim(trimName)) {
        if (!firstBaseTrim) firstBaseTrim = t;
        continue;
      }
      
      // Only add if we don't already have this label from an individual record
      if (!seenLabels.has(trimName)) {
        hasOnlyBaseTrims = false;
        seenLabels.set(trimName, {
          value: t.modificationId,
          label: trimName,
          modificationId: t.modificationId,
        });
      }
    }
  }
  
  const results = Array.from(seenLabels.values());
  
  // If all trims were base trims, return a single "Standard" option
  if (results.length === 0 && trims.length > 0 && firstBaseTrim) {
    results.push({
      value: firstBaseTrim.modificationId,
      label: "Standard",
      modificationId: firstBaseTrim.modificationId,
    });
  }
  
  // Sort alphabetically for consistent display
  results.sort((a, b) => a.label.localeCompare(b.label));
  
  return results;
}
