/**
 * Static Params for SEO Pages
 * 
 * Generates the list of vehicles to prerender at build time.
 * Prioritizes vehicles with:
 * - Most fitment data in the database
 * - Multiple trims (indicates comprehensive coverage)
 * - Recent model years (higher search volume)
 */

import { db } from "@/lib/fitment-db/db";
import { sql } from "drizzle-orm";

interface TopVehicle {
  year: number;
  make: string;
  model: string;
  trimCount: number;
  priority: number;
}

// High-priority vehicles that should always be included
const MUST_INCLUDE_VEHICLES = [
  // Trucks (highest US search volume)
  { year: 2024, make: "ford", model: "f-150" },
  { year: 2024, make: "chevrolet", model: "silverado-1500" },
  { year: 2024, make: "ram", model: "1500" },
  { year: 2024, make: "gmc", model: "sierra-1500" },
  { year: 2024, make: "toyota", model: "tacoma" },
  { year: 2024, make: "toyota", model: "tundra" },
  { year: 2024, make: "ford", model: "f-250" },
  { year: 2024, make: "nissan", model: "frontier" },
  { year: 2024, make: "ford", model: "ranger" },
  { year: 2024, make: "chevrolet", model: "colorado" },
  
  // SUVs
  { year: 2024, make: "toyota", model: "rav4" },
  { year: 2024, make: "honda", model: "cr-v" },
  { year: 2024, make: "jeep", model: "wrangler" },
  { year: 2024, make: "jeep", model: "grand-cherokee" },
  { year: 2024, make: "ford", model: "explorer" },
  { year: 2024, make: "toyota", model: "highlander" },
  { year: 2024, make: "chevrolet", model: "equinox" },
  { year: 2024, make: "honda", model: "pilot" },
  { year: 2024, make: "ford", model: "escape" },
  { year: 2024, make: "ford", model: "bronco" },
  { year: 2024, make: "mazda", model: "cx-5" },
  { year: 2024, make: "hyundai", model: "tucson" },
  { year: 2024, make: "kia", model: "telluride" },
  { year: 2024, make: "subaru", model: "outback" },
  { year: 2024, make: "toyota", model: "4runner" },
  { year: 2024, make: "chevrolet", model: "tahoe" },
  
  // Sedans
  { year: 2024, make: "toyota", model: "camry" },
  { year: 2024, make: "honda", model: "civic" },
  { year: 2024, make: "honda", model: "accord" },
  { year: 2024, make: "toyota", model: "corolla" },
  { year: 2024, make: "nissan", model: "altima" },
  { year: 2024, make: "hyundai", model: "elantra" },
  { year: 2024, make: "hyundai", model: "sonata" },
  
  // EVs
  { year: 2024, make: "tesla", model: "model-y" },
  { year: 2024, make: "tesla", model: "model-3" },
  { year: 2024, make: "ford", model: "mustang-mach-e" },
  { year: 2024, make: "hyundai", model: "ioniq-5" },
  { year: 2024, make: "kia", model: "ev6" },
  
  // Sports/Performance
  { year: 2024, make: "ford", model: "mustang" },
  { year: 2024, make: "chevrolet", model: "camaro" },
  { year: 2024, make: "dodge", model: "challenger" },
  { year: 2024, make: "dodge", model: "charger" },
];

// Additional years for must-include vehicles
const MUST_INCLUDE_YEARS = [2024, 2023, 2022, 2021, 2020];

/**
 * Get top vehicles from the database for SEO static generation
 * 
 * Strategy:
 * 1. Query vehicles with most trim coverage (indicates complete data)
 * 2. Prioritize recent years (2020+)
 * 3. Include must-have popular vehicles
 * 4. Return up to the requested limit
 */
export async function getTopVehiclesForSEO(limit: number = 400): Promise<TopVehicle[]> {
  try {
    // Query vehicles with best coverage from database
    const dbVehicles = await db.execute(sql`
      SELECT 
        year, 
        make, 
        model, 
        COUNT(*) as trim_count,
        COUNT(DISTINCT display_trim) as unique_trims,
        CASE 
          WHEN bolt_pattern IS NOT NULL AND array_length(oem_tire_sizes::text[], 1) > 0 THEN 1
          ELSE 0
        END as has_complete_data
      FROM vehicle_fitments
      WHERE year >= 2015
        AND bolt_pattern IS NOT NULL
      GROUP BY year, make, model, bolt_pattern, oem_tire_sizes
      HAVING COUNT(*) >= 1
      ORDER BY 
        has_complete_data DESC,
        year DESC, 
        trim_count DESC
      LIMIT ${Math.floor(limit * 1.5)}
    `);
    
    const vehicleSet = new Set<string>();
    const vehicles: TopVehicle[] = [];
    
    // Add must-include vehicles first
    for (const year of MUST_INCLUDE_YEARS) {
      for (const v of MUST_INCLUDE_VEHICLES) {
        const key = `${year}:${v.make}:${v.model}`;
        if (!vehicleSet.has(key)) {
          vehicleSet.add(key);
          vehicles.push({
            year,
            make: v.make,
            model: v.model,
            trimCount: 5, // Assumed good coverage
            priority: 1.0,
          });
        }
      }
    }
    
    // Add database vehicles (ones with most coverage)
    for (const row of dbVehicles.rows as any[]) {
      const key = `${row.year}:${row.make}:${row.model}`;
      if (!vehicleSet.has(key)) {
        vehicleSet.add(key);
        vehicles.push({
          year: row.year,
          make: row.make,
          model: row.model,
          trimCount: Number(row.trim_count) || 1,
          priority: Math.min(1, Number(row.trim_count) / 10),
        });
      }
    }
    
    // Sort by priority and limit
    vehicles.sort((a, b) => {
      // Recent years first
      if (a.year !== b.year) return b.year - a.year;
      // Then by priority
      if (a.priority !== b.priority) return b.priority - a.priority;
      // Then by trim count
      return b.trimCount - a.trimCount;
    });
    
    return vehicles.slice(0, limit);
  } catch (err) {
    console.error("[seo/staticParams] Error getting top vehicles:", err);
    
    // Fallback: return must-include vehicles only
    const fallback: TopVehicle[] = [];
    for (const year of MUST_INCLUDE_YEARS) {
      for (const v of MUST_INCLUDE_VEHICLES) {
        fallback.push({
          year,
          make: v.make,
          model: v.model,
          trimCount: 1,
          priority: 0.8,
        });
      }
    }
    return fallback.slice(0, limit);
  }
}

/**
 * Get vehicle stats for debugging/reporting
 */
export async function getVehicleCoverageStats(): Promise<{
  totalVehicles: number;
  vehiclesWithFitment: number;
  vehiclesWithTireSizes: number;
  topMakes: { make: string; count: number }[];
  yearDistribution: { year: number; count: number }[];
}> {
  try {
    const stats = await db.execute(sql`
      SELECT 
        COUNT(DISTINCT CONCAT(year, ':', make, ':', model)) as total_vehicles,
        COUNT(DISTINCT CASE WHEN bolt_pattern IS NOT NULL 
          THEN CONCAT(year, ':', make, ':', model) END) as vehicles_with_fitment,
        COUNT(DISTINCT CASE WHEN array_length(oem_tire_sizes::text[], 1) > 0 
          THEN CONCAT(year, ':', make, ':', model) END) as vehicles_with_tire_sizes
      FROM vehicle_fitments
    `);
    
    const makeStats = await db.execute(sql`
      SELECT make, COUNT(DISTINCT CONCAT(year, ':', model)) as count
      FROM vehicle_fitments
      WHERE bolt_pattern IS NOT NULL
      GROUP BY make
      ORDER BY count DESC
      LIMIT 10
    `);
    
    const yearStats = await db.execute(sql`
      SELECT year, COUNT(DISTINCT CONCAT(make, ':', model)) as count
      FROM vehicle_fitments
      WHERE bolt_pattern IS NOT NULL
      GROUP BY year
      ORDER BY year DESC
      LIMIT 10
    `);
    
    const row = stats.rows[0] as any;
    
    return {
      totalVehicles: Number(row?.total_vehicles) || 0,
      vehiclesWithFitment: Number(row?.vehicles_with_fitment) || 0,
      vehiclesWithTireSizes: Number(row?.vehicles_with_tire_sizes) || 0,
      topMakes: (makeStats.rows as any[]).map(r => ({
        make: r.make,
        count: Number(r.count),
      })),
      yearDistribution: (yearStats.rows as any[]).map(r => ({
        year: Number(r.year),
        count: Number(r.count),
      })),
    };
  } catch (err) {
    console.error("[seo/staticParams] Error getting coverage stats:", err);
    return {
      totalVehicles: 0,
      vehiclesWithFitment: 0,
      vehiclesWithTireSizes: 0,
      topMakes: [],
      yearDistribution: [],
    };
  }
}
