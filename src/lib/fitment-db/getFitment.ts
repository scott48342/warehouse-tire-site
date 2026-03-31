/**
 * Fitment Lookup Service (DB-First)
 * 
 * Priority order:
 * 1. Check database for cached fitment
 * 2. If not found or stale, call Wheel-Size API
 * 3. Import API response to database
 * 4. Apply any overrides
 * 5. Return normalized fitment
 */

import { db } from "./db";
import { vehicleFitments, fitmentOverrides } from "./schema";
import type { VehicleFitment, FitmentOverride } from "./schema";
import { eq, and, or, isNull, desc } from "drizzle-orm";
import { normalizeMake, normalizeModel, slugify } from "./keys";
import { importWheelSizeFitment } from "./importFitment";
import { applyOverrides } from "./applyOverrides";

// ============================================================================
// WHEEL-SIZE API REMOVED (Phase A - DB-First Architecture)
// Runtime paths are 100% DB-only. No external API calls allowed.
// ============================================================================

// ============================================================================
// Types
// ============================================================================

export interface FitmentLookupResult {
  fitment: VehicleFitment | null;
  source: "db" | "api" | "not_found";
  apiCalled: boolean;
  overridesApplied: boolean;
}

export interface FitmentListResult {
  fitments: VehicleFitment[];
  source: "db" | "api" | "mixed";
  apiCalled: boolean;
}

interface WheelSizeApiConfig {
  apiKey: string;
  baseUrl?: string;
}

// ============================================================================
// WHEEL-SIZE API PERMANENTLY DISABLED (DB-First Architecture)
// ============================================================================

function getWheelSizeConfig(): WheelSizeApiConfig | null {
  // HARD BLOCK: Wheel-Size API is forbidden in DB-first runtime
  // All fitment data must come from local database
  console.warn("[getFitment] Wheel-Size API FORBIDDEN - DB-first architecture");
  return null;
}

// ============================================================================
// Single Fitment Lookup
// ============================================================================

/**
 * Get fitment for a specific vehicle modification
 * DB-first: checks database before calling API
 */
export async function getFitment(
  year: number,
  make: string,
  model: string,
  modificationId: string,
  options?: {
    forceRefresh?: boolean; // Skip DB, call API
    maxAgeDays?: number; // Re-fetch if older than this
  }
): Promise<FitmentLookupResult> {
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(model);
  const normalizedModId = slugify(modificationId);
  
  // Step 1: Check database (unless forcing refresh)
  if (!options?.forceRefresh) {
    const dbFitment = await db.query.vehicleFitments.findFirst({
      where: and(
        eq(vehicleFitments.year, year),
        eq(vehicleFitments.make, normalizedMake),
        eq(vehicleFitments.model, normalizedModel),
        eq(vehicleFitments.modificationId, normalizedModId)
      ),
    });
    
    if (dbFitment) {
      // Check if data is stale
      const maxAgeDays = options?.maxAgeDays ?? 30;
      const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
      const isStale = Date.now() - dbFitment.updatedAt.getTime() > maxAge;
      
      if (!isStale) {
        // Apply overrides and return
        const withOverrides = await applyOverrides(dbFitment);
        return {
          fitment: withOverrides,
          source: "db",
          apiCalled: false,
          overridesApplied: withOverrides !== dbFitment,
        };
      }
      // Data is stale, fall through to API call
    }
  }
  
  // Step 2: Call Wheel-Size API
  const config = getWheelSizeConfig();
  if (!config) {
    return { fitment: null, source: "not_found", apiCalled: false, overridesApplied: false };
  }
  
  try {
    const apiData = await fetchWheelSizeModificationData(
      config,
      year,
      make,
      model,
      modificationId
    );
    
    if (!apiData) {
      return { fitment: null, source: "not_found", apiCalled: true, overridesApplied: false };
    }
    
    // Step 3: Import to database
    const importResult = await importWheelSizeFitment(
      year,
      make,
      model,
      apiData.modification,
      apiData.wheels,
      apiData.tires,
      apiData.fullPayload
    );
    
    if (!importResult.success || !importResult.fitmentId) {
      return { fitment: null, source: "not_found", apiCalled: true, overridesApplied: false };
    }
    
    // Step 4: Fetch the newly imported record
    const newFitment = await db.query.vehicleFitments.findFirst({
      where: eq(vehicleFitments.id, importResult.fitmentId),
    });
    
    if (!newFitment) {
      return { fitment: null, source: "not_found", apiCalled: true, overridesApplied: false };
    }
    
    // Step 5: Apply overrides and return
    const withOverrides = await applyOverrides(newFitment);
    return {
      fitment: withOverrides,
      source: "api",
      apiCalled: true,
      overridesApplied: withOverrides !== newFitment,
    };
  } catch (error: any) {
    console.error("[getFitment] API error:", error?.message);
    return { fitment: null, source: "not_found", apiCalled: true, overridesApplied: false };
  }
}

// ============================================================================
// List Fitments (Trims/Submodels)
// ============================================================================

/**
 * Get all fitments for a year/make/model
 * Used for trim selector dropdowns
 */
export async function listFitments(
  year: number,
  make: string,
  model: string,
  options?: {
    forceRefresh?: boolean;
  }
): Promise<FitmentListResult> {
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(model);
  
  // Step 1: Check database
  if (!options?.forceRefresh) {
    const dbFitments = await db.query.vehicleFitments.findMany({
      where: and(
        eq(vehicleFitments.year, year),
        eq(vehicleFitments.make, normalizedMake),
        eq(vehicleFitments.model, normalizedModel)
      ),
      orderBy: [vehicleFitments.displayTrim],
    });
    
    // FILTER: Exclude records with empty/null bolt patterns
    const validFitments = dbFitments.filter(f => 
      f.boltPattern && f.boltPattern.trim().length > 0
    );
    
    if (validFitments.length > 0) {
      // Apply overrides to all valid fitments
      const withOverrides = await Promise.all(validFitments.map(f => applyOverrides(f)));
      return {
        fitments: withOverrides,
        source: "db",
        apiCalled: false,
      };
    }
  }
  
  // Step 2: Call Wheel-Size API to get all modifications
  const config = getWheelSizeConfig();
  if (!config) {
    return { fitments: [], source: "not_found" as any, apiCalled: false };
  }
  
  try {
    const modifications = await fetchWheelSizeModifications(config, year, make, model);
    
    if (!modifications || modifications.length === 0) {
      return { fitments: [], source: "api", apiCalled: true };
    }
    
    // Import all modifications
    const importedFitments: VehicleFitment[] = [];
    
    for (const mod of modifications) {
      const result = await importWheelSizeFitment(
        year,
        make,
        model,
        mod,
        undefined,
        undefined,
        mod
      );
      
      if (result.success && result.fitmentId) {
        const fitment = await db.query.vehicleFitments.findFirst({
          where: eq(vehicleFitments.id, result.fitmentId),
        });
        if (fitment) {
          importedFitments.push(fitment);
        }
      }
    }
    
    // Apply overrides
    const withOverrides = await Promise.all(importedFitments.map(f => applyOverrides(f)));
    
    return {
      fitments: withOverrides,
      source: "api",
      apiCalled: true,
    };
  } catch (error: any) {
    console.error("[listFitments] API error:", error?.message);
    return { fitments: [], source: "api", apiCalled: true };
  }
}

// ============================================================================
// Quick Lookup (for selectors)
// ============================================================================

/**
 * Get trim options for selector (just value/label pairs)
 * This is the main entry point for the trim selector UI
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
// Local-Only Fitment Lookup (no API fallback)
// ============================================================================

/**
 * Get all fitments for a year/make/model from LOCAL DB ONLY.
 * Does NOT call Wheel-Size API. Used by trims endpoint to serve locally imported data.
 * 
 * This is different from listFitments() which falls back to API.
 * 
 * IMPORTANT: Filters out records with empty/null bolt patterns to ensure
 * only valid fitment data is used in customer-facing flows.
 */
export async function listLocalFitments(
  year: number,
  make: string,
  model: string
): Promise<VehicleFitment[]> {
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(model);
  
  console.log(`[listLocalFitments] Query: year=${year}, make="${normalizedMake}" (from "${make}"), model="${normalizedModel}" (from "${model}")`);
  
  const dbFitments = await db.query.vehicleFitments.findMany({
    where: and(
      eq(vehicleFitments.year, year),
      eq(vehicleFitments.make, normalizedMake),
      eq(vehicleFitments.model, normalizedModel)
    ),
    orderBy: [vehicleFitments.displayTrim],
  });
  
  console.log(`[listLocalFitments] Raw DB results: ${dbFitments.length} records`);
  
  // FILTER: Exclude records with empty/null bolt patterns
  // These are invalid legacy imports that should not be used
  const validFitments = dbFitments.filter(f => 
    f.boltPattern && f.boltPattern.trim().length > 0
  );
  
  console.log(`[listLocalFitments] After bolt filter: ${validFitments.length} valid (${dbFitments.length - validFitments.length} filtered)`);
  
  // Apply overrides to all valid fitments
  const withOverrides = await Promise.all(validFitments.map(f => applyOverrides(f)));
  return withOverrides;
}

// ============================================================================
// Wheel-Size API Helpers
// ============================================================================

// ============================================================================
// WHEEL-SIZE API FUNCTIONS - HARD BLOCKED
// These functions are preserved for type compatibility but will throw if called
// ============================================================================

async function fetchWheelSizeModifications(
  _config: WheelSizeApiConfig,
  _year: number,
  _make: string,
  _model: string
): Promise<any[]> {
  throw new Error("Wheel-Size API is FORBIDDEN in DB-first runtime. All fitment must come from local database.");
}

async function fetchWheelSizeModificationData(
  _config: WheelSizeApiConfig,
  _year: number,
  _make: string,
  _model: string,
  _modificationId: string
): Promise<{
  modification: any;
  wheels?: any;
  tires?: any;
  fullPayload: any;
} | null> {
  throw new Error("Wheel-Size API is FORBIDDEN in DB-first runtime. All fitment must come from local database.");
}
