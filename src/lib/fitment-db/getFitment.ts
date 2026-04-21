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
import { eq, and, asc, or, ilike } from "drizzle-orm";
import { normalizeMake, normalizeModel, slugify } from "./keys";
import { applyOverrides } from "./applyOverrides";
import { getModelVariants } from "./modelAliases";
import { safeResolveFitment } from "./safeResolver";

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
