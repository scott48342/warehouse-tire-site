/**
 * OEM Tire Size Lookup by Vehicle Family
 * 
 * When a customer selects aftermarket wheels on an older vehicle that didn't
 * have that wheel size as an OEM option, we look up what OEM tire sizes exist
 * for that wheel diameter on SIMILAR vehicles (same make/model, any year).
 * 
 * This is much more accurate than trying to calculate sizes from scratch.
 * 
 * Example:
 * - Customer has a 2004 Silverado (factory max 17")
 * - They select 22" aftermarket wheels  
 * - We look up: "What OEM 22" tire sizes exist for ANY Silverado?"
 * - Find: 275/50R22, 285/45R22 (from 2019+ Silverados)
 * - Suggest those proven sizes instead of calculating
 */

import { db } from "./db";
import { sql } from "drizzle-orm";

export interface OemFamilySizesResult {
  sizes: string[];
  source: "oem-family-lookup";
  yearsWithThisSize: number[];
  confidence: "high" | "medium" | "low";
}

/**
 * Look up OEM tire sizes for a vehicle family at a specific wheel diameter.
 * 
 * @param make - Vehicle make (e.g., "Chevrolet")
 * @param model - Vehicle model (e.g., "Silverado 1500")
 * @param wheelDiameter - Target wheel diameter (e.g., 22)
 * @returns OEM tire sizes used by any year of this make/model with this wheel diameter
 */
export async function getOemTireSizesByFamily(
  make: string,
  model: string,
  wheelDiameter: number
): Promise<OemFamilySizesResult | null> {
  try {
    // Query for all OEM tire sizes at this wheel diameter for this make/model (any year)
    // Uses the oem_tire_sizes JSONB array and oem_wheel_sizes to filter
    const result = await db.execute(sql`
      WITH tire_sizes AS (
        SELECT 
          year,
          jsonb_array_elements_text(oem_tire_sizes) as tire_size
        FROM vehicle_fitments
        WHERE make = ${make}
          AND model ILIKE ${`%${model}%`}
          AND EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(oem_wheel_sizes) as wheel
            WHERE (wheel->>'diameter')::int = ${wheelDiameter}
          )
      )
      SELECT DISTINCT 
        tire_size,
        array_agg(DISTINCT year ORDER BY year DESC) as years
      FROM tire_sizes
      WHERE tire_size LIKE ${`%R${wheelDiameter}`}
      GROUP BY tire_size
      ORDER BY tire_size
    `);

    const rows = result.rows as Array<{ tire_size: string; years: number[] }>;
    
    if (!rows || rows.length === 0) {
      return null;
    }

    // Extract unique tire sizes and all years
    const sizes = rows.map(r => r.tire_size);
    const allYears = [...new Set(rows.flatMap(r => r.years))].sort((a, b) => b - a);

    // Confidence is high if we have multiple years of data
    const confidence = allYears.length >= 3 ? "high" : allYears.length >= 2 ? "medium" : "low";

    return {
      sizes,
      source: "oem-family-lookup",
      yearsWithThisSize: allYears,
      confidence,
    };
  } catch (error) {
    console.error("[getOemTireSizesByFamily] Query error:", error);
    return null;
  }
}

/**
 * Quick check if we have OEM data for this wheel diameter in the vehicle family.
 * Cheaper than the full lookup for early bailout decisions.
 */
export async function hasOemFamilyData(
  make: string,
  model: string,
  wheelDiameter: number
): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT 1
      FROM vehicle_fitments
      WHERE make = ${make}
        AND model ILIKE ${`%${model}%`}
        AND EXISTS (
          SELECT 1 
          FROM jsonb_array_elements(oem_wheel_sizes) as wheel
          WHERE (wheel->>'diameter')::int = ${wheelDiameter}
        )
      LIMIT 1
    `);
    
    return (result.rows?.length ?? 0) > 0;
  } catch (error) {
    console.error("[hasOemFamilyData] Query error:", error);
    return false;
  }
}
