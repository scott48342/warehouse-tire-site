/**
 * Fitment Lookup Service (DB-ONLY)
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * WHEEL-SIZE API REMOVED - This is now 100% DB-first.
 * No external API calls. All fitment data must be imported via admin tools.
 * 
 * Uses safe resolver with controlled fallback:
 * 1. Exact modificationId match (HIGHEST PRIORITY)
 * 2. Exact displayTrim match
 * 3. Case-insensitive/normalized trim match
 * 4. Single-trim fallback (only if unambiguous)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { db } from "./db";
import { vehicleFitments } from "./schema";
import type { VehicleFitment } from "./schema";
import { eq, and, asc, or, ilike, inArray, desc } from "drizzle-orm";
import { normalizeMake, normalizeModel, slugify } from "./keys";
import { applyOverrides } from "./applyOverrides";
import { getModelVariants } from "./modelAliases";
import { safeResolveFitment } from "./safeResolver";
import { 
  type QualityTier, 
  getAllowedTiers, 
  isTierAllowed,
  type QualityTierStats 
} from "./qualityTier";

// ============================================================================
// Types
// ============================================================================

export interface FitmentLookupResult {
  fitment: VehicleFitment | null;
  source: "db" | "not_found";
  overridesApplied: boolean;
  /** Resolution method used (for debugging) */
  resolutionMethod?: string;
  /** Whether model alias was used (e.g., f-350 → f-350-super-duty) */
  modelAliasUsed?: boolean;
}

export interface FitmentListResult {
  fitments: VehicleFitment[];
  source: "db";
}

// ============================================================================
// Single Fitment Lookup (DB-Only with Safe Resolver)
// ============================================================================

/**
 * Get fitment for a specific vehicle modification.
 * DB-ONLY: No external API fallback.
 * 
 * Uses safe resolver with controlled fallback chain:
 * 1. Exact modificationId match (HIGHEST PRIORITY - always wins)
 * 2. Exact displayTrim match
 * 3. Case-insensitive/normalized trim match
 * 4. Single-trim fallback (only if vehicle has exactly one trim)
 * 
 * Rules:
 * - Exact modification match ALWAYS wins
 * - No random guessing across multiple trims
 * - Only use fallback if match is unambiguous
 * - All fallback usage is logged
 */
export async function getFitment(
  year: number,
  make: string,
  model: string,
  modificationId: string
): Promise<FitmentLookupResult> {
  const result = await safeResolveFitment(year, make, model, modificationId);
  
  if (result.fitment) {
    return {
      fitment: result.fitment,
      source: "db",
      overridesApplied: result.overridesApplied,
      resolutionMethod: result.method,
      modelAliasUsed: result.modelAliasUsed,
    };
  }
  
  return {
    fitment: null,
    source: "not_found",
    overridesApplied: false,
    resolutionMethod: result.method,
    modelAliasUsed: result.modelAliasUsed,
  };
}

// ============================================================================
// List Fitments (DB-Only)
// ============================================================================

/**
 * Get all fitments for a year/make/model.
 * DB-ONLY: No external API fallback.
 * Supports model aliases (e.g., f-350 -> f-350-super-duty)
 */
export async function listFitments(
  year: number,
  make: string,
  model: string
): Promise<FitmentListResult> {
  const normalizedMake = normalizeMake(make);
  const modelVariants = getModelVariants(model);
  
  // Try each model variant until we find results
  for (const modelName of modelVariants) {
    const dbFitments = await db
      .select()
      .from(vehicleFitments)
      .where(
        and(
          eq(vehicleFitments.year, year),
          ilike(vehicleFitments.make, normalizedMake),
          ilike(vehicleFitments.model, modelName)
        )
      )
      .orderBy(asc(vehicleFitments.displayTrim));
    
    if (dbFitments.length > 0) {
      const withOverrides = await Promise.all(dbFitments.map(f => applyOverrides(f)));
      return {
        fitments: withOverrides,
        source: "db",
      };
    }
  }
  
  return {
    fitments: [],
    source: "db",
  };
}

// ============================================================================
// Quick Lookup (for selectors)
// ============================================================================

/**
 * Get trim options for selector (just value/label pairs).
 * DB-ONLY.
 */
export async function getTrimOptions(
  year: number,
  make: string,
  model: string
): Promise<Array<{ value: string; label: string }>> {
  const result = await listFitments(year, make, model);
  
  // Dedupe by displayTrim
  const seen = new Set<string>();
  const options: Array<{ value: string; label: string }> = [];
  
  for (const fitment of result.fitments) {
    const labelKey = fitment.displayTrim.toLowerCase();
    if (!seen.has(labelKey)) {
      seen.add(labelKey);
      options.push({
        value: fitment.modificationId,
        label: fitment.displayTrim,
      });
    }
  }
  
  return options;
}

// ============================================================================
// Local-Only Fitment Lookup (explicit DB-only, kept for compatibility)
// ============================================================================

/**
 * Get all fitments for a year/make/model from LOCAL DB ONLY.
 * This is now identical to listFitments() since we removed API fallback.
 * Supports model aliases (e.g., f-350 -> f-350-super-duty)
 */
export async function listLocalFitments(
  year: number,
  make: string,
  model: string
): Promise<VehicleFitment[]> {
  const result = await listFitments(year, make, model);
  return result.fitments;
}

// ============================================================================
// QUALITY TIER FILTERING (Phase 2)
// ============================================================================

export interface TierFilteredResult {
  fitments: VehicleFitment[];
  tierStats: QualityTierStats;
  usedFallback: boolean;
  fallbackInfo?: {
    originalYear: number;
    fallbackYear: number;
    reason: string;
  };
}

/**
 * Get fitments filtered by quality tier based on search type.
 * 
 * - WHEEL SEARCH: only "complete" records
 * - TIRE SEARCH: "complete" + "partial" records  
 * - PACKAGE: only "complete" records
 * 
 * If no records match the tier requirements, falls back to closest year
 * with complete data (Phase 4).
 */
export async function listFitmentsWithTierFilter(
  year: number,
  make: string,
  model: string,
  searchType: "wheel" | "tire" | "package"
): Promise<TierFilteredResult> {
  const normalizedMake = normalizeMake(make);
  const modelVariants = getModelVariants(model);
  const allowedTiers = getAllowedTiers(searchType);
  
  // Initialize stats
  const tierStats: QualityTierStats = {
    complete: 0,
    partial: 0,
    low_confidence: 0,
    total: 0,
    usedFallback: false,
  };
  
  // Try to find fitments for the requested year
  for (const modelName of modelVariants) {
    // First, get ALL fitments to count tiers
    const allFitments = await db
      .select()
      .from(vehicleFitments)
      .where(
        and(
          eq(vehicleFitments.year, year),
          ilike(vehicleFitments.make, normalizedMake),
          ilike(vehicleFitments.model, modelName)
        )
      )
      .orderBy(asc(vehicleFitments.displayTrim));
    
    if (allFitments.length > 0) {
      // Count tiers
      for (const f of allFitments) {
        tierStats.total++;
        const tier = (f.qualityTier as QualityTier) || "unknown";
        if (tier === "complete") tierStats.complete++;
        else if (tier === "partial") tierStats.partial++;
        else tierStats.low_confidence++;
      }
      
      // Filter by allowed tiers
      const filtered = allFitments.filter(f => 
        isTierAllowed(f.qualityTier, searchType)
      );
      
      if (filtered.length > 0) {
        const withOverrides = await Promise.all(filtered.map(f => applyOverrides(f)));
        return {
          fitments: withOverrides,
          tierStats,
          usedFallback: false,
        };
      }
      
      // No records match tier requirements - need fallback
      console.log(`[getFitment] No ${allowedTiers.join("/")} tier records for ${year} ${make} ${model} (${searchType} search)`);
    }
  }
  
  // PHASE 4: FALLBACK - Find closest year with complete data
  if (searchType === "wheel" || searchType === "package") {
    const fallbackResult = await findClosestCompleteYear(year, make, model);
    if (fallbackResult) {
      tierStats.usedFallback = true;
      tierStats.fallbackVehicle = {
        year: fallbackResult.year,
        make,
        model,
      };
      
      console.log(`[getFitment] FALLBACK: Using ${fallbackResult.year} ${make} ${model} for ${year} (${searchType} search)`);
      
      return {
        fitments: fallbackResult.fitments,
        tierStats,
        usedFallback: true,
        fallbackInfo: {
          originalYear: year,
          fallbackYear: fallbackResult.year,
          reason: `No complete data for ${year}, using ${fallbackResult.year}`,
        },
      };
    }
  }
  
  // No fallback available
  return {
    fitments: [],
    tierStats,
    usedFallback: false,
  };
}

/**
 * Find the closest year with "complete" quality tier data.
 * Searches +/- 3 years, preferring newer years.
 */
async function findClosestCompleteYear(
  year: number,
  make: string,
  model: string
): Promise<{ year: number; fitments: VehicleFitment[] } | null> {
  const normalizedMake = normalizeMake(make);
  const modelVariants = getModelVariants(model);
  
  // Search order: prefer newer years, then older
  const yearsToTry = [
    year + 1, year - 1,
    year + 2, year - 2,
    year + 3, year - 3,
  ];
  
  for (const tryYear of yearsToTry) {
    if (tryYear < 2000 || tryYear > 2030) continue;
    
    for (const modelName of modelVariants) {
      const fitments = await db
        .select()
        .from(vehicleFitments)
        .where(
          and(
            eq(vehicleFitments.year, tryYear),
            ilike(vehicleFitments.make, normalizedMake),
            ilike(vehicleFitments.model, modelName),
            eq(vehicleFitments.qualityTier, "complete")
          )
        )
        .orderBy(asc(vehicleFitments.displayTrim));
      
      if (fitments.length > 0) {
        const withOverrides = await Promise.all(fitments.map(f => applyOverrides(f)));
        return { year: tryYear, fitments: withOverrides };
      }
    }
  }
  
  return null;
}

/**
 * Get quality tier statistics for reporting (Phase 5)
 */
export async function getQualityTierReport(): Promise<{
  overall: { complete: number; partial: number; low_confidence: number; total: number };
  byMake: Array<{ make: string; complete: number; partial: number; low_confidence: number }>;
  topMissingComplete: Array<{ year: number; make: string; model: string; tier: string }>;
}> {
  // Overall stats
  const { rows: overallRows } = await db.execute<{ tier: string; count: string }>`
    SELECT quality_tier as tier, COUNT(*) as count
    FROM vehicle_fitments
    WHERE year >= 2000
    GROUP BY quality_tier
  `;
  
  const overall = {
    complete: 0,
    partial: 0,
    low_confidence: 0,
    total: 0,
  };
  
  for (const row of overallRows) {
    const count = parseInt(row.count, 10);
    overall.total += count;
    if (row.tier === "complete") overall.complete = count;
    else if (row.tier === "partial") overall.partial = count;
    else overall.low_confidence += count;
  }
  
  // By make
  const { rows: makeRows } = await db.execute<{ make: string; tier: string; count: string }>`
    SELECT make, quality_tier as tier, COUNT(*) as count
    FROM vehicle_fitments
    WHERE year >= 2015
    GROUP BY make, quality_tier
    ORDER BY make
  `;
  
  const makeMap = new Map<string, { complete: number; partial: number; low_confidence: number }>();
  for (const row of makeRows) {
    if (!makeMap.has(row.make)) {
      makeMap.set(row.make, { complete: 0, partial: 0, low_confidence: 0 });
    }
    const entry = makeMap.get(row.make)!;
    const count = parseInt(row.count, 10);
    if (row.tier === "complete") entry.complete = count;
    else if (row.tier === "partial") entry.partial = count;
    else entry.low_confidence += count;
  }
  
  const byMake = Array.from(makeMap.entries())
    .map(([make, stats]) => ({ make, ...stats }))
    .sort((a, b) => b.low_confidence - a.low_confidence);
  
  // Top vehicles missing complete data (recent years only)
  const { rows: missingRows } = await db.execute<{ year: number; make: string; model: string; tier: string }>`
    SELECT DISTINCT year, make, model, quality_tier as tier
    FROM vehicle_fitments
    WHERE year >= 2020 AND quality_tier != 'complete'
    ORDER BY year DESC, make, model
    LIMIT 50
  `;
  
  return {
    overall,
    byMake,
    topMissingComplete: missingRows,
  };
}
