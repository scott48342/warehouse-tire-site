/**
 * Fitment Coverage Queries
 * 
 * Functions to check what vehicles actually have fitment data in the database.
 * Used by selector APIs to prevent showing unsupported Y/M/M combinations.
 */

import { db } from "./db";
import { vehicleFitments } from "./schema";
import { sql, eq, and, or, inArray, ilike } from "drizzle-orm";
import { normalizeMake, normalizeModel } from "./keys";
import { getModelVariants } from "./modelAliases";

/**
 * Case-insensitive make comparison.
 * DB has mixed case (Buick, Toyota, RAM) but we normalize to lowercase.
 */
function makeCaseInsensitive(make: string) {
  return sql`lower(${vehicleFitments.make}) = ${make.toLowerCase()}`;
}

/**
 * Normalize-and-compare for model names.
 * Handles: "Encore GX" (DB) vs "encore-gx" (URL slug)
 * Strips non-alphanumeric, lowercases, then compares.
 */
function modelNormalizedMatch(modelVariants: string[]) {
  // Convert variants to normalized form for comparison
  const normalizedVariants = modelVariants.map(m => 
    m.toLowerCase().replace(/[^a-z0-9]+/g, '')
  );
  
  // Build OR conditions for each variant
  // regexp_replace removes non-alphanumeric, lower() lowercases
  if (normalizedVariants.length === 1) {
    return sql`lower(regexp_replace(${vehicleFitments.model}, '[^a-zA-Z0-9]', '', 'g')) = ${normalizedVariants[0]}`;
  }
  
  // Multiple variants - use OR
  const conditions = normalizedVariants.map(v => 
    sql`lower(regexp_replace(${vehicleFitments.model}, '[^a-zA-Z0-9]', '', 'g')) = ${v}`
  );
  return or(...conditions);
}

// ============================================================================
// Coverage Types
// ============================================================================

export interface YearCoverage {
  years: number[];
  source: "fitment_db";
}

export interface TrimCoverage {
  trims: Array<{
    modificationId: string;
    displayTrim: string;
  }>;
  hasCoverage: boolean;
  source: "fitment_db";
}

// ============================================================================
// Get Years With Fitment Coverage
// ============================================================================

/**
 * Get years that have actual fitment data for a make/model.
 * Only returns years where at least one fitment record exists.
 * Supports model aliases (e.g., f-350 -> f-350-super-duty)
 */
export async function getYearsWithCoverage(
  make: string,
  model: string
): Promise<YearCoverage> {
  const normalizedMake = normalizeMake(make);
  const modelVariants = getModelVariants(model);
  
  const result = await db
    .selectDistinct({ year: vehicleFitments.year })
    .from(vehicleFitments)
    .where(
      and(
        makeCaseInsensitive(normalizedMake),
        modelNormalizedMatch(modelVariants)
      )
    )
    .orderBy(sql`${vehicleFitments.year} DESC`);
  
  return {
    years: result.map(r => r.year),
    source: "fitment_db",
  };
}

// ============================================================================
// Get Trims With Fitment Coverage
// ============================================================================

/**
 * Get trims that have actual fitment data for a year/make/model.
 * Returns empty array if no fitment data exists.
 * Supports model aliases (e.g., f-350 -> f-350-super-duty)
 */
export async function getTrimsWithCoverage(
  year: number,
  make: string,
  model: string
): Promise<TrimCoverage> {
  const normalizedMake = normalizeMake(make);
  const modelVariants = getModelVariants(model);
  
  const result = await db
    .selectDistinct({
      modificationId: vehicleFitments.modificationId,
      displayTrim: vehicleFitments.displayTrim,
    })
    .from(vehicleFitments)
    .where(
      and(
        eq(vehicleFitments.year, year),
        makeCaseInsensitive(normalizedMake),
        modelNormalizedMatch(modelVariants)
      )
    )
    .orderBy(vehicleFitments.displayTrim);
  
  return {
    trims: result,
    hasCoverage: result.length > 0,
    source: "fitment_db",
  };
}

// ============================================================================
// Check If Model Has Any Coverage
// ============================================================================

/**
 * Quick check: does this make/model have ANY fitment data at all?
 * Supports model aliases (e.g., f-350 -> f-350-super-duty)
 */
export async function hasAnyCoverage(
  make: string,
  model: string
): Promise<boolean> {
  const normalizedMake = normalizeMake(make);
  const modelVariants = getModelVariants(model);
  
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vehicleFitments)
    .where(
      and(
        makeCaseInsensitive(normalizedMake),
        modelNormalizedMatch(modelVariants)
      )
    )
    .limit(1);
  
  return result[0]?.count > 0;
}

// ============================================================================
// Get Models With Fitment Coverage
// ============================================================================

/**
 * Get all models that have any fitment data for a given make.
 * Optionally filtered by year.
 */
export async function getModelsWithCoverage(
  make: string,
  year?: number
): Promise<string[]> {
  const normalizedMake = normalizeMake(make);
  
  // Use case-insensitive comparison for make (DB has mixed case)
  const whereConditions: any[] = [makeCaseInsensitive(normalizedMake)];
  if (year) {
    whereConditions.push(eq(vehicleFitments.year, year));
  }
  
  const result = await db
    .selectDistinct({ model: vehicleFitments.model })
    .from(vehicleFitments)
    .where(and(...whereConditions))
    .orderBy(vehicleFitments.model);
  
  return result.map(r => r.model);
}

// ============================================================================
// Check If Specific Year Has Coverage
// ============================================================================

/**
 * Quick check: does this specific Y/M/M have fitment data?
 * Supports model aliases (e.g., f-350 -> f-350-super-duty)
 */
export async function hasYearCoverage(
  year: number,
  make: string,
  model: string
): Promise<boolean> {
  const normalizedMake = normalizeMake(make);
  const modelVariants = getModelVariants(model);
  
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vehicleFitments)
    .where(
      and(
        eq(vehicleFitments.year, year),
        makeCaseInsensitive(normalizedMake),
        modelNormalizedMatch(modelVariants)
      )
    )
    .limit(1);
  
  return result[0]?.count > 0;
}
