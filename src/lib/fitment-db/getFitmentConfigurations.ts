/**
 * Fitment Configuration Reader
 * 
 * Reads OEM wheel+tire configurations with automatic legacy fallback.
 * 
 * MIGRATION STRATEGY:
 * - If configuration rows exist → return them (new structured data)
 * - If no configurations → fall back to legacy oemWheelSizes/oemTireSizes
 * - This ensures NO REGRESSION during the migration period
 * 
 * The caller always gets a consistent response shape, regardless of
 * whether data comes from new configs or legacy arrays.
 */

import { db } from "./db";
import { vehicleFitmentConfigurations, vehicleFitments } from "./schema";
import type { VehicleFitmentConfiguration } from "./schema";
import { eq, and, asc } from "drizzle-orm";
import { normalizeMake, normalizeModel } from "./keys";
import { extractRimDiameter } from "@/lib/tires/wheelDiameterFilter";

// ============================================================================
// Types
// ============================================================================

export interface FitmentConfiguration {
  configurationKey: string;
  configurationLabel: string | null;
  wheelDiameter: number;
  wheelWidth: number | null;
  wheelOffsetMm: number | null;
  tireSize: string;
  axlePosition: "front" | "rear" | "square";
  isDefault: boolean;
  isOptional: boolean;
  source: "config" | "legacy";
  sourceConfidence: "high" | "medium" | "low";
}

export interface FitmentConfigurationsResult {
  configurations: FitmentConfiguration[];
  uniqueDiameters: number[];
  hasMultipleDiameters: boolean;
  source: "config" | "legacy" | "none";
  confidence: "high" | "medium" | "low";
  /** True if data came from new config table, false if legacy fallback */
  usedConfigTable: boolean;
}

// ============================================================================
// Main Reader Function
// ============================================================================

/**
 * Get OEM wheel+tire configurations for a vehicle.
 * 
 * Automatically falls back to legacy data if no config rows exist.
 * This is the primary read interface for fitment configurations.
 * 
 * @param year - Vehicle year
 * @param make - Vehicle make (will be normalized)
 * @param model - Vehicle model (will be normalized)
 * @param modificationId - Optional specific trim/modification ID
 * 
 * @returns Configurations with source info and fallback indication
 */
export async function getFitmentConfigurations(
  year: number,
  make: string,
  model: string,
  modificationId?: string
): Promise<FitmentConfigurationsResult> {
  const makeKey = normalizeMake(make);
  const modelKey = normalizeModel(model);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: Try to get configurations from new table
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    // First try exact modificationId match
    let configRows = await db
      .select()
      .from(vehicleFitmentConfigurations)
      .where(
        modificationId
          ? and(
              eq(vehicleFitmentConfigurations.year, year),
              eq(vehicleFitmentConfigurations.makeKey, makeKey),
              eq(vehicleFitmentConfigurations.modelKey, modelKey),
              eq(vehicleFitmentConfigurations.modificationId, modificationId)
            )
          : and(
              eq(vehicleFitmentConfigurations.year, year),
              eq(vehicleFitmentConfigurations.makeKey, makeKey),
              eq(vehicleFitmentConfigurations.modelKey, modelKey)
            )
      )
      .orderBy(
        asc(vehicleFitmentConfigurations.wheelDiameter),
        asc(vehicleFitmentConfigurations.axlePosition)
      );
    
    // If no results and modificationId provided, try matching by display_trim
    // This handles cases where config records have display_trim but no modificationId
    if (configRows.length === 0 && modificationId) {
      // Look up the display_trim for this modificationId from vehicle_fitments
      const fitmentRow = await db
        .select({ displayTrim: vehicleFitments.displayTrim })
        .from(vehicleFitments)
        .where(
          and(
            eq(vehicleFitments.year, year),
            eq(vehicleFitments.make, makeKey),
            eq(vehicleFitments.model, modelKey),
            eq(vehicleFitments.modificationId, modificationId)
          )
        )
        .limit(1);
      
      if (fitmentRow.length > 0 && fitmentRow[0].displayTrim) {
        const displayTrim = fitmentRow[0].displayTrim;
        // Try to match by display_trim in config table
        configRows = await db
          .select()
          .from(vehicleFitmentConfigurations)
          .where(
            and(
              eq(vehicleFitmentConfigurations.year, year),
              eq(vehicleFitmentConfigurations.makeKey, makeKey),
              eq(vehicleFitmentConfigurations.modelKey, modelKey),
              eq(vehicleFitmentConfigurations.displayTrim, displayTrim)
            )
          )
          .orderBy(
            asc(vehicleFitmentConfigurations.wheelDiameter),
            asc(vehicleFitmentConfigurations.axlePosition)
          );
      }
    }
    
    if (configRows.length > 0) {
      // Found config rows - use them
      const configurations = configRows.map(row => rowToConfiguration(row));
      const uniqueDiameters = [...new Set(configurations.map(c => c.wheelDiameter))].sort((a, b) => a - b);
      
      // Determine overall confidence (lowest of all rows)
      const confidenceLevels = configurations.map(c => c.sourceConfidence);
      const overallConfidence = confidenceLevels.includes("low") 
        ? "low" 
        : confidenceLevels.includes("medium") 
          ? "medium" 
          : "high";
      
      return {
        configurations,
        uniqueDiameters,
        hasMultipleDiameters: uniqueDiameters.length > 1,
        source: "config",
        confidence: overallConfidence,
        usedConfigTable: true,
      };
    }
  } catch (err) {
    console.warn("[getFitmentConfigurations] Config table read failed, using legacy fallback:", err);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Fall back to legacy oemWheelSizes/oemTireSizes
  // ═══════════════════════════════════════════════════════════════════════════
  return await getLegacyFallback(year, makeKey, modelKey, modificationId);
}

/**
 * Check if configuration data exists for a vehicle (without full read)
 */
export async function hasConfigurationData(
  year: number,
  make: string,
  model: string,
  modificationId?: string
): Promise<boolean> {
  const makeKey = normalizeMake(make);
  const modelKey = normalizeModel(model);
  
  try {
    const result = await db
      .select({ count: vehicleFitmentConfigurations.id })
      .from(vehicleFitmentConfigurations)
      .where(
        modificationId
          ? and(
              eq(vehicleFitmentConfigurations.year, year),
              eq(vehicleFitmentConfigurations.makeKey, makeKey),
              eq(vehicleFitmentConfigurations.modelKey, modelKey),
              eq(vehicleFitmentConfigurations.modificationId, modificationId)
            )
          : and(
              eq(vehicleFitmentConfigurations.year, year),
              eq(vehicleFitmentConfigurations.makeKey, makeKey),
              eq(vehicleFitmentConfigurations.modelKey, modelKey)
            )
      )
      .limit(1);
    
    return result.length > 0;
  } catch {
    return false;
  }
}

/**
 * Get unique wheel diameters from configurations (fast path for gate decision)
 */
export async function getConfiguredWheelDiameters(
  year: number,
  make: string,
  model: string,
  modificationId?: string
): Promise<{ diameters: number[]; fromConfig: boolean; confidence: string } | null> {
  const result = await getFitmentConfigurations(year, make, model, modificationId);
  
  if (result.source === "none") {
    return null;
  }
  
  return {
    diameters: result.uniqueDiameters,
    fromConfig: result.usedConfigTable,
    confidence: result.confidence,
  };
}

// ============================================================================
// Legacy Fallback
// ============================================================================

async function getLegacyFallback(
  year: number,
  makeKey: string,
  modelKey: string,
  modificationId?: string
): Promise<FitmentConfigurationsResult> {
  try {
    // Query legacy fitment record
    const fitmentRows = await db
      .select({
        oemWheelSizes: vehicleFitments.oemWheelSizes,
        oemTireSizes: vehicleFitments.oemTireSizes,
        modificationId: vehicleFitments.modificationId,
        displayTrim: vehicleFitments.displayTrim,
      })
      .from(vehicleFitments)
      .where(
        modificationId
          ? and(
              eq(vehicleFitments.year, year),
              eq(vehicleFitments.make, makeKey),
              eq(vehicleFitments.model, modelKey),
              eq(vehicleFitments.modificationId, modificationId)
            )
          : and(
              eq(vehicleFitments.year, year),
              eq(vehicleFitments.make, makeKey),
              eq(vehicleFitments.model, modelKey)
            )
      )
      .limit(1);
    
    if (fitmentRows.length === 0) {
      return {
        configurations: [],
        uniqueDiameters: [],
        hasMultipleDiameters: false,
        source: "none",
        confidence: "low",
        usedConfigTable: false,
      };
    }
    
    const fitment = fitmentRows[0];
    const oemTireSizes = (fitment.oemTireSizes as string[]) || [];
    const oemWheelSizes = (fitment.oemWheelSizes as Array<{ diameter?: number; width?: number; offset?: number }>) || [];
    
    // Extract unique diameters from tire sizes
    const tireDiameters = oemTireSizes
      .map(size => extractRimDiameter(size))
      .filter((d): d is number => d !== null);
    
    // Also check wheel sizes array
    const wheelDiameters = oemWheelSizes
      .map(ws => ws.diameter)
      .filter((d): d is number => typeof d === "number");
    
    const allDiameters = [...new Set([...tireDiameters, ...wheelDiameters])].sort((a, b) => a - b);
    
    // Build synthetic configurations from legacy data
    // NOTE: This is a BEST EFFORT conversion - pairings may not be accurate
    const configurations: FitmentConfiguration[] = [];
    
    for (const tireSize of oemTireSizes) {
      const diameter = extractRimDiameter(tireSize);
      if (diameter === null) continue;
      
      // Try to find matching wheel spec
      const matchingWheel = oemWheelSizes.find(ws => ws.diameter === diameter);
      
      configurations.push({
        configurationKey: `legacy-${diameter}`,
        configurationLabel: `${diameter}" (Legacy)`,
        wheelDiameter: diameter,
        wheelWidth: matchingWheel?.width ?? null,
        wheelOffsetMm: matchingWheel?.offset ?? null,
        tireSize,
        axlePosition: "square",
        isDefault: diameter === allDiameters[0], // Assume smallest is default
        isOptional: diameter !== allDiameters[0],
        source: "legacy",
        sourceConfidence: "low", // Legacy data is inherently low confidence
      });
    }
    
    return {
      configurations,
      uniqueDiameters: allDiameters,
      hasMultipleDiameters: allDiameters.length > 1,
      source: "legacy",
      confidence: "low",
      usedConfigTable: false,
    };
    
  } catch (err) {
    console.error("[getFitmentConfigurations] Legacy fallback failed:", err);
    return {
      configurations: [],
      uniqueDiameters: [],
      hasMultipleDiameters: false,
      source: "none",
      confidence: "low",
      usedConfigTable: false,
    };
  }
}

// ============================================================================
// Helpers
// ============================================================================

function rowToConfiguration(row: VehicleFitmentConfiguration): FitmentConfiguration {
  return {
    configurationKey: row.configurationKey,
    configurationLabel: row.configurationLabel,
    wheelDiameter: row.wheelDiameter,
    wheelWidth: row.wheelWidth ? Number(row.wheelWidth) : null,
    wheelOffsetMm: row.wheelOffsetMm ? Number(row.wheelOffsetMm) : null,
    tireSize: row.tireSize,
    axlePosition: row.axlePosition as "front" | "rear" | "square",
    isDefault: row.isDefault,
    isOptional: row.isOptional,
    source: "config",
    sourceConfidence: row.sourceConfidence as "high" | "medium" | "low",
  };
}
