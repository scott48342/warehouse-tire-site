/**
 * Classic Fitment Lookup Service
 * 
 * ISOLATED from modern fitment lookup.
 * Handles platform-based classic vehicle fitment.
 */

import { db } from "../fitment-db/db";
import { classicFitments } from "./schema";
import { eq, and, lte, gte, sql } from "drizzle-orm";
import type {
  ClassicFitmentResponse,
  ClassicFitmentNotFoundResponse,
  ClassicLookupResult,
} from "./types";

// ============================================================================
// Classic Makes (for detection)
// ============================================================================

const CLASSIC_MAKES = new Set([
  "chevrolet",
  "pontiac",
  "buick",
  "oldsmobile",
  "cadillac",
  "ford",
  "mercury",
  "lincoln",
  "dodge",
  "plymouth",
  "chrysler",
  "amc",
  "jeep",
]);

const CLASSIC_YEAR_CUTOFF = 1985;

// ============================================================================
// Detection
// ============================================================================

/**
 * Determine if a vehicle should use Classic Mode
 */
export function isClassicVehicle(year: number, make: string): boolean {
  const normalizedMake = make.toLowerCase().trim();
  
  // Must be pre-1985 and a classic make
  if (year < CLASSIC_YEAR_CUTOFF && CLASSIC_MAKES.has(normalizedMake)) {
    return true;
  }
  
  return false;
}

/**
 * Check if we have classic fitment data for a specific vehicle
 */
export async function hasClassicFitment(
  year: number,
  make: string,
  model: string
): Promise<boolean> {
  const normalizedMake = make.toLowerCase().trim();
  const normalizedModel = model.toLowerCase().trim().replace(/\s+/g, "-");

  try {
    const [record] = await db
      .select({ id: classicFitments.id })
      .from(classicFitments)
      .where(
        and(
          eq(classicFitments.make, normalizedMake),
          eq(classicFitments.model, normalizedModel),
          eq(classicFitments.isActive, true),
          lte(classicFitments.yearStart, year),
          gte(classicFitments.yearEnd, year)
        )
      )
      .limit(1);

    return !!record;
  } catch (err) {
    console.error("[classicLookup] hasClassicFitment error:", err);
    return false;
  }
}

// ============================================================================
// Lookup
// ============================================================================

/**
 * Get classic fitment for a vehicle
 * 
 * Returns null if not found (caller should fall back to modern or show error)
 */
export async function getClassicFitment(
  year: number,
  make: string,
  model: string
): Promise<ClassicLookupResult> {
  const normalizedMake = make.toLowerCase().trim();
  const normalizedModel = model.toLowerCase().trim().replace(/\s+/g, "-");

  try {
    const [record] = await db
      .select()
      .from(classicFitments)
      .where(
        and(
          eq(classicFitments.make, normalizedMake),
          eq(classicFitments.model, normalizedModel),
          eq(classicFitments.isActive, true),
          lte(classicFitments.yearStart, year),
          gte(classicFitments.yearEnd, year)
        )
      )
      .limit(1);

    if (!record) {
      return {
        isClassicVehicle: false,
        fitmentMode: "not_found",
        message: `No classic fitment data found for ${year} ${make} ${model}`,
      };
    }

    // Transform DB record to API response
    const response: ClassicFitmentResponse = {
      isClassicVehicle: true,
      fitmentMode: "classic",

      platform: {
        code: record.platformCode,
        name: record.platformName,
        generationName: record.generationName,
        yearRange: `${record.yearStart}-${record.yearEnd}`,
      },

      vehicle: {
        year,
        make: normalizedMake,
        model: normalizedModel,
      },

      fitmentStyle: record.fitmentStyle as any,
      confidence: record.confidence as any,

      verificationRequired: record.requiresClearanceCheck ?? true,
      verificationNote: record.verificationNote,
      commonModifications: (record.commonModifications as string[]) || [],
      modificationRisk: (record.modificationRisk as any) || "medium",

      specs: {
        boltPattern: record.commonBoltPattern,
        centerBore: record.commonCenterBore ? parseFloat(String(record.commonCenterBore)) : null,
        threadSize: record.commonThreadSize,
        seatType: record.commonSeatType,
      },

      recommendedRange: {
        diameter: {
          min: record.recWheelDiameterMin ?? 15,
          max: record.recWheelDiameterMax ?? 18,
        },
        width: {
          min: record.recWheelWidthMin ? parseFloat(String(record.recWheelWidthMin)) : 7,
          max: record.recWheelWidthMax ? parseFloat(String(record.recWheelWidthMax)) : 10,
        },
        offset: {
          min: record.recOffsetMinMm ?? -10,
          max: record.recOffsetMaxMm ?? 25,
        },
      },

      stockReference: {
        wheelDiameter: record.stockWheelDiameter,
        wheelWidth: record.stockWheelWidth ? parseFloat(String(record.stockWheelWidth)) : null,
        tireSize: record.stockTireSize,
      },

      source: record.fitmentSource,
      batchTag: record.batchTag,
      version: record.version,
    };

    console.log(
      `[classicLookup] FOUND: ${year} ${make} ${model} → platform=${record.platformCode}, confidence=${record.confidence}`
    );

    return response;
  } catch (err) {
    console.error("[classicLookup] getClassicFitment error:", err);
    return {
      isClassicVehicle: false,
      fitmentMode: "not_found",
      message: `Error looking up classic fitment: ${err}`,
    };
  }
}

// ============================================================================
// Platform Queries
// ============================================================================

/**
 * Get all vehicles for a platform
 */
export async function getVehiclesByPlatform(platformCode: string) {
  return db
    .select()
    .from(classicFitments)
    .where(
      and(
        eq(classicFitments.platformCode, platformCode),
        eq(classicFitments.isActive, true)
      )
    );
}

/**
 * Get all active platforms
 */
export async function getAllPlatforms() {
  const results = await db
    .select({
      platformCode: classicFitments.platformCode,
      platformName: classicFitments.platformName,
      generationName: classicFitments.generationName,
      yearStart: sql<number>`MIN(${classicFitments.yearStart})`,
      yearEnd: sql<number>`MAX(${classicFitments.yearEnd})`,
      vehicleCount: sql<number>`COUNT(*)`,
    })
    .from(classicFitments)
    .where(eq(classicFitments.isActive, true))
    .groupBy(
      classicFitments.platformCode,
      classicFitments.platformName,
      classicFitments.generationName
    );

  return results;
}

// ============================================================================
// Rollback Support
// ============================================================================

/**
 * Deactivate all records for a batch (surgical rollback)
 */
export async function deactivateBatch(batchTag: string): Promise<number> {
  const result = await db
    .update(classicFitments)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(classicFitments.batchTag, batchTag));

  console.log(`[classicLookup] Deactivated batch: ${batchTag}`);
  return result.rowCount ?? 0;
}

/**
 * Reactivate a batch
 */
export async function reactivateBatch(batchTag: string): Promise<number> {
  const result = await db
    .update(classicFitments)
    .set({
      isActive: true,
      updatedAt: new Date(),
    })
    .where(eq(classicFitments.batchTag, batchTag));

  console.log(`[classicLookup] Reactivated batch: ${batchTag}`);
  return result.rowCount ?? 0;
}

/**
 * Get batch statistics
 */
export async function getBatchStats(batchTag: string) {
  const [stats] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      active: sql<number>`SUM(CASE WHEN is_active THEN 1 ELSE 0 END)`,
      inactive: sql<number>`SUM(CASE WHEN NOT is_active THEN 1 ELSE 0 END)`,
    })
    .from(classicFitments)
    .where(eq(classicFitments.batchTag, batchTag));

  return stats;
}
