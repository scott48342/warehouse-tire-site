/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * FITMENT INHERITANCE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Copy fitment data between years/generations to avoid duplicate manual entry.
 * 
 * Assumptions:
 * - Bolt pattern rarely changes within a generation
 * - Center bore rarely changes within a generation
 * - Offset ranges may vary slightly year to year
 * - Thread size/seat type almost never change within a generation
 * 
 * @created 2026-03-27
 */

import { db, schema } from "./db";
import { eq, and, sql, desc } from "drizzle-orm";
import { normalizeMake, normalizeModel } from "./normalization";

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATION DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Vehicle generation year ranges
 * Fitment can be inherited within a generation
 */
export const VEHICLE_GENERATIONS: Record<string, Record<string, Array<{ start: number; end: number; name?: string }>>> = {
  "ford": {
    "f-150": [
      { start: 2021, end: 2025, name: "14th Gen" },
      { start: 2015, end: 2020, name: "13th Gen" },
      { start: 2009, end: 2014, name: "12th Gen" },
    ],
    "f-250": [
      { start: 2023, end: 2025, name: "5th Gen (Super Duty)" },
      { start: 2017, end: 2022, name: "4th Gen (Super Duty)" },
      { start: 2011, end: 2016, name: "3rd Gen (Super Duty)" },
    ],
    "ranger": [
      { start: 2019, end: 2025, name: "6th Gen" },
    ],
    "bronco": [
      { start: 2021, end: 2025, name: "6th Gen" },
    ],
    "explorer": [
      { start: 2020, end: 2025, name: "6th Gen" },
      { start: 2011, end: 2019, name: "5th Gen" },
    ],
  },
  "chevrolet": {
    "silverado-1500": [
      { start: 2019, end: 2025, name: "4th Gen (T1)" },
      { start: 2014, end: 2018, name: "3rd Gen (K2)" },
      { start: 2007, end: 2013, name: "2nd Gen (GMT900)" },
    ],
    "colorado": [
      { start: 2023, end: 2025, name: "3rd Gen" },
      { start: 2015, end: 2022, name: "2nd Gen" },
    ],
    "tahoe": [
      { start: 2021, end: 2025, name: "5th Gen" },
      { start: 2015, end: 2020, name: "4th Gen" },
    ],
  },
  "ram": {
    "1500": [
      { start: 2019, end: 2025, name: "5th Gen (DT)" },
      { start: 2013, end: 2018, name: "4th Gen (DS)" },
      { start: 2009, end: 2012, name: "4th Gen (DS early)" },
    ],
  },
  "toyota": {
    "tacoma": [
      { start: 2024, end: 2025, name: "4th Gen" },
      { start: 2016, end: 2023, name: "3rd Gen" },
      { start: 2005, end: 2015, name: "2nd Gen" },
    ],
    "tundra": [
      { start: 2022, end: 2025, name: "3rd Gen" },
      { start: 2014, end: 2021, name: "2nd Gen (facelift)" },
      { start: 2007, end: 2013, name: "2nd Gen" },
    ],
    "4runner": [
      { start: 2010, end: 2025, name: "5th Gen" },
    ],
    "rav4": [
      { start: 2019, end: 2025, name: "5th Gen (XA50)" },
      { start: 2013, end: 2018, name: "4th Gen (XA40)" },
    ],
  },
  "jeep": {
    "wrangler": [
      { start: 2018, end: 2025, name: "JL" },
      { start: 2007, end: 2017, name: "JK" },
    ],
    "grand-cherokee": [
      { start: 2022, end: 2025, name: "WL" },
      { start: 2011, end: 2021, name: "WK2" },
    ],
    "gladiator": [
      { start: 2020, end: 2025, name: "JT" },
    ],
  },
  "gmc": {
    "sierra-1500": [
      { start: 2019, end: 2025, name: "5th Gen" },
      { start: 2014, end: 2018, name: "4th Gen" },
    ],
    "yukon": [
      { start: 2021, end: 2025, name: "5th Gen" },
      { start: 2015, end: 2020, name: "4th Gen" },
    ],
  },
  "honda": {
    "cr-v": [
      { start: 2023, end: 2025, name: "6th Gen" },
      { start: 2017, end: 2022, name: "5th Gen" },
      { start: 2012, end: 2016, name: "4th Gen" },
    ],
    "pilot": [
      { start: 2023, end: 2025, name: "4th Gen" },
      { start: 2016, end: 2022, name: "3rd Gen" },
    ],
  },
  "subaru": {
    "outback": [
      { start: 2020, end: 2025, name: "6th Gen" },
      { start: 2015, end: 2019, name: "5th Gen" },
    ],
    "forester": [
      { start: 2019, end: 2025, name: "5th Gen (SK)" },
      { start: 2014, end: 2018, name: "4th Gen (SJ)" },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATION LOOKUP
// ═══════════════════════════════════════════════════════════════════════════════

export interface GenerationInfo {
  make: string;
  model: string;
  generation: string;
  startYear: number;
  endYear: number;
  years: number[];
}

/**
 * Get generation info for a vehicle
 */
export function getGeneration(make: string, model: string, year: number): GenerationInfo | null {
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(make, model);
  
  const makeGens = VEHICLE_GENERATIONS[normalizedMake];
  if (!makeGens) return null;
  
  const modelGens = makeGens[normalizedModel];
  if (!modelGens) return null;
  
  for (const gen of modelGens) {
    if (year >= gen.start && year <= gen.end) {
      const years: number[] = [];
      for (let y = gen.start; y <= gen.end; y++) {
        years.push(y);
      }
      return {
        make: normalizedMake,
        model: normalizedModel,
        generation: gen.name || `${gen.start}-${gen.end}`,
        startYear: gen.start,
        endYear: gen.end,
        years,
      };
    }
  }
  
  return null;
}

/**
 * Get all years in the same generation
 */
export function getSameGenerationYears(make: string, model: string, year: number): number[] {
  const gen = getGeneration(make, model, year);
  return gen?.years || [year];
}

// ═══════════════════════════════════════════════════════════════════════════════
// INHERITANCE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface InheritanceResult {
  success: boolean;
  source: { year: number; make: string; model: string };
  targets: Array<{
    year: number;
    action: "inherited" | "skipped" | "failed";
    reason?: string;
  }>;
  totalInherited: number;
  totalSkipped: number;
  totalFailed: number;
}

/**
 * Find existing fitment data for a make/model (any year)
 */
export async function findExistingFitment(
  make: string,
  model: string,
  preferredYear?: number
): Promise<typeof schema.vehicleFitments.$inferSelect | null> {
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(make, model);
  
  // If preferred year specified, try that first
  if (preferredYear) {
    const [exact] = await db
      .select()
      .from(schema.vehicleFitments)
      .where(
        and(
          eq(schema.vehicleFitments.make, normalizedMake),
          eq(schema.vehicleFitments.model, normalizedModel),
          eq(schema.vehicleFitments.year, preferredYear)
        )
      )
      .limit(1);
    
    if (exact) return exact;
  }
  
  // Otherwise get most recent year
  const [recent] = await db
    .select()
    .from(schema.vehicleFitments)
    .where(
      and(
        eq(schema.vehicleFitments.make, normalizedMake),
        eq(schema.vehicleFitments.model, normalizedModel)
      )
    )
    .orderBy(desc(schema.vehicleFitments.year))
    .limit(1);
  
  return recent || null;
}

/**
 * Inherit fitment from one year to another
 */
export async function inheritFitment(
  fromYear: number,
  toYear: number,
  make: string,
  model: string,
  options: {
    overwrite?: boolean;
    sourceNotes?: string;
  } = {}
): Promise<{ success: boolean; action: string; error?: string }> {
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(make, model);
  
  // Get source fitment
  const sourceFitments = await db
    .select()
    .from(schema.vehicleFitments)
    .where(
      and(
        eq(schema.vehicleFitments.year, fromYear),
        eq(schema.vehicleFitments.make, normalizedMake),
        eq(schema.vehicleFitments.model, normalizedModel)
      )
    );
  
  if (sourceFitments.length === 0) {
    return { success: false, action: "failed", error: "No source fitment found" };
  }
  
  // Check if target already exists
  if (!options.overwrite) {
    const existing = await db
      .select({ id: schema.vehicleFitments.id })
      .from(schema.vehicleFitments)
      .where(
        and(
          eq(schema.vehicleFitments.year, toYear),
          eq(schema.vehicleFitments.make, normalizedMake),
          eq(schema.vehicleFitments.model, normalizedModel)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      return { success: true, action: "skipped", error: "Target year already has fitment" };
    }
  }
  
  // Copy all fitment records
  let inherited = 0;
  for (const src of sourceFitments) {
    // Create new modification ID for the target year
    const newModId = src.modificationId.replace(
      /^(manual_)?/,
      `inherited_${fromYear}_`
    );
    
    try {
      await db.insert(schema.vehicleFitments).values({
        year: toYear,
        make: src.make,
        model: src.model,
        modificationId: newModId,
        rawTrim: src.rawTrim,
        displayTrim: src.displayTrim,
        submodel: src.submodel,
        boltPattern: src.boltPattern,
        centerBoreMm: src.centerBoreMm,
        threadSize: src.threadSize,
        seatType: src.seatType,
        offsetMinMm: src.offsetMinMm,
        offsetMaxMm: src.offsetMaxMm,
        oemWheelSizes: src.oemWheelSizes,
        oemTireSizes: src.oemTireSizes,
        source: `inherited_from_${fromYear}`,
      }).onConflictDoNothing();
      
      inherited++;
    } catch (err) {
      // Ignore duplicates
    }
  }
  
  return { 
    success: true, 
    action: inherited > 0 ? "inherited" : "skipped",
  };
}

/**
 * Inherit fitment to all years in the same generation
 */
export async function inheritToGeneration(
  sourceYear: number,
  make: string,
  model: string,
  options: {
    overwrite?: boolean;
    direction?: "both" | "forward" | "backward";
  } = {}
): Promise<InheritanceResult> {
  const gen = getGeneration(make, model, sourceYear);
  
  const result: InheritanceResult = {
    success: true,
    source: { year: sourceYear, make, model },
    targets: [],
    totalInherited: 0,
    totalSkipped: 0,
    totalFailed: 0,
  };
  
  if (!gen) {
    result.success = false;
    return result;
  }
  
  const targetYears = gen.years.filter(y => {
    if (y === sourceYear) return false;
    if (options.direction === "forward") return y > sourceYear;
    if (options.direction === "backward") return y < sourceYear;
    return true;
  });
  
  for (const year of targetYears) {
    const inheritResult = await inheritFitment(sourceYear, year, make, model, options);
    
    result.targets.push({
      year,
      action: inheritResult.action as "inherited" | "skipped" | "failed",
      reason: inheritResult.error,
    });
    
    if (inheritResult.action === "inherited") result.totalInherited++;
    else if (inheritResult.action === "skipped") result.totalSkipped++;
    else result.totalFailed++;
  }
  
  return result;
}

/**
 * Get missing years for a model within its generations
 */
export async function getMissingYears(
  make: string,
  model: string,
  yearRange?: { min: number; max: number }
): Promise<number[]> {
  const normalizedMake = normalizeMake(make);
  const normalizedModel = normalizeModel(make, model);
  
  // Get existing years
  const existing = await db
    .select({ year: schema.vehicleFitments.year })
    .from(schema.vehicleFitments)
    .where(
      and(
        eq(schema.vehicleFitments.make, normalizedMake),
        eq(schema.vehicleFitments.model, normalizedModel)
      )
    )
    .groupBy(schema.vehicleFitments.year);
  
  const existingYears = new Set(existing.map(e => e.year));
  
  // Determine range
  const minYear = yearRange?.min || 2010;
  const maxYear = yearRange?.max || new Date().getFullYear() + 1;
  
  // Find missing years
  const missing: number[] = [];
  for (let year = minYear; year <= maxYear; year++) {
    if (!existingYears.has(year)) {
      missing.push(year);
    }
  }
  
  return missing;
}

/**
 * Auto-fill missing years using inheritance
 */
export async function autoFillMissingYears(
  make: string,
  model: string,
  options: {
    yearRange?: { min: number; max: number };
    dryRun?: boolean;
  } = {}
): Promise<{
  success: boolean;
  filled: number[];
  skipped: number[];
  sourceYear: number | null;
}> {
  const existing = await findExistingFitment(make, model);
  
  if (!existing) {
    return { success: false, filled: [], skipped: [], sourceYear: null };
  }
  
  const sourceYear = existing.year;
  const gen = getGeneration(make, model, sourceYear);
  
  if (!gen) {
    return { success: false, filled: [], skipped: [], sourceYear };
  }
  
  const filled: number[] = [];
  const skipped: number[] = [];
  
  for (const year of gen.years) {
    if (year === sourceYear) continue;
    
    if (options.dryRun) {
      filled.push(year);
      continue;
    }
    
    const result = await inheritFitment(sourceYear, year, make, model);
    if (result.action === "inherited") {
      filled.push(year);
    } else {
      skipped.push(year);
    }
  }
  
  return { success: true, filled, skipped, sourceYear };
}
