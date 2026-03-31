/**
 * Fitment Lookup Service (DB-ONLY)
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * WHEEL-SIZE API REMOVED - This is now 100% DB-first.
 * No external API calls. All fitment data must be imported via admin tools.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { db } from "./db";
import { vehicleFitments } from "./schema";
import type { VehicleFitment } from "./schema";
import { eq, and } from "drizzle-orm";
import { normalizeMake, normalizeModel, slugify } from "./keys";
import { applyOverrides } from "./applyOverrides";

// ============================================================================
// Types
// ============================================================================

export interface FitmentLookupResult {
  fitment: VehicleFitment | null;
  source: "db" | "not_found";
  overridesApplied: boolean;
}

export interface FitmentListResult {
  fitments: VehicleFitment[];
  source: "db";
}

// ============================================================================
// Single Fitment Lookup (DB-Only)
// ============================================================================

/**
 * Get fitment for a specific vehicle modification.
 * DB-ONLY: No external API fallback.
 */
export async function getFitment(
  year: number,
  make: string,
  model: string,
  modificationId: string
): Promise<FitmentLookupResult> {
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(model);
  const normalizedModId = slugify(modificationId);
  
  const dbFitment = await db.query.vehicleFitments.findFirst({
    where: and(
      eq(vehicleFitments.year, year),
      eq(vehicleFitments.make, normalizedMake),
      eq(vehicleFitments.model, normalizedModel),
      eq(vehicleFitments.modificationId, normalizedModId)
    ),
  });
  
  if (!dbFitment) {
    return { fitment: null, source: "not_found", overridesApplied: false };
  }
  
  // Apply overrides and return
  const withOverrides = await applyOverrides(dbFitment);
  return {
    fitment: withOverrides,
    source: "db",
    overridesApplied: withOverrides !== dbFitment,
  };
}

// ============================================================================
// List Fitments (DB-Only)
// ============================================================================

/**
 * Get all fitments for a year/make/model.
 * DB-ONLY: No external API fallback.
 */
export async function listFitments(
  year: number,
  make: string,
  model: string
): Promise<FitmentListResult> {
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(model);
  
  const dbFitments = await db.query.vehicleFitments.findMany({
    where: and(
      eq(vehicleFitments.year, year),
      eq(vehicleFitments.make, normalizedMake),
      eq(vehicleFitments.model, normalizedModel)
    ),
    orderBy: [vehicleFitments.displayTrim],
  });
  
  // Apply overrides to all
  const withOverrides = await Promise.all(dbFitments.map(f => applyOverrides(f)));
  return {
    fitments: withOverrides,
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
 */
export async function listLocalFitments(
  year: number,
  make: string,
  model: string
): Promise<VehicleFitment[]> {
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(model);
  
  const dbFitments = await db.query.vehicleFitments.findMany({
    where: and(
      eq(vehicleFitments.year, year),
      eq(vehicleFitments.make, normalizedMake),
      eq(vehicleFitments.model, normalizedModel)
    ),
    orderBy: [vehicleFitments.displayTrim],
  });
  
  // Apply overrides to all
  const withOverrides = await Promise.all(dbFitments.map(f => applyOverrides(f)));
  return withOverrides;
}
