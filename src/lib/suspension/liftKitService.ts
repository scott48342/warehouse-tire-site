/**
 * Lift Kit Recommendation Service
 * 
 * Matches lift kits from suspension_fitments to vehicles and build intents.
 * Integrates with the homepage intent system (LIFT_LEVELS).
 */

import pg from "pg";
import { LIFT_LEVELS, type LiftLevel } from "@/lib/homepage-intent/config";

const { Pool } = pg;

// ============================================================================
// Types
// ============================================================================

export interface LiftKit {
  sku: string;
  name: string;
  brand: string;
  productType: string;
  liftHeight: number | null;
  yearRange: string;
  msrp: number | null;
  mapPrice: number | null;
  imageUrl: string | null;
  inventory: number;
  inStock: boolean;
}

export interface LiftKitMatch {
  liftLevel: LiftLevel;
  liftLevelLabel: string;
  liftInches: number;
  kits: LiftKit[];
  // Fitment guidance from LIFT_LEVELS
  offsetMin: number;
  offsetMax: number;
  targetTireSizes: string[];
}

export interface VehicleLiftKitResult {
  vehicle: {
    year: number;
    make: string;
    model: string;
  };
  // Grouped by lift level
  byLevel: LiftKitMatch[];
  // All kits flat (for simpler access)
  allKits: LiftKit[];
  // Total count
  total: number;
}

// ============================================================================
// Helpers
// ============================================================================

function getPool() {
  return new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
}

/**
 * Map lift height (inches) to our standard lift levels
 */
export function liftHeightToLevel(inches: number | null): LiftLevel | null {
  if (inches === null) return null;
  
  if (inches <= 2.5) return "leveled";
  if (inches <= 4.5) return "4in";
  if (inches <= 7) return "6in";
  if (inches > 7) return "8in";
  
  return null;
}

/**
 * Get display label for a lift level
 */
export function getLiftLevelLabel(level: LiftLevel): string {
  const config = LIFT_LEVELS[level];
  return config?.label || level;
}

// ============================================================================
// Main Service
// ============================================================================

/**
 * Find lift kits for a specific vehicle
 */
export async function getLiftKitsForVehicle(
  year: number,
  make: string,
  model: string,
  options?: {
    liftLevel?: LiftLevel;
    minLift?: number;
    maxLift?: number;
    brand?: string;
    inStockOnly?: boolean;
  }
): Promise<VehicleLiftKitResult> {
  const pool = getPool();
  
  try {
    // Build query
    const conditions = [
      "sf.make ILIKE $1",
      "sf.model ILIKE $2",
      "sf.year_start <= $3",
      "sf.year_end >= $3",
    ];
    const params: (string | number)[] = [make, `%${model}%`, year];
    let paramIdx = 4;
    
    // Filter by lift level if specified
    if (options?.liftLevel) {
      const config = LIFT_LEVELS[options.liftLevel];
      if (config) {
        // Map lift level to height range
        if (options.liftLevel === "leveled") {
          conditions.push(`(sf.lift_height IS NULL OR sf.lift_height <= 2.5)`);
        } else if (options.liftLevel === "4in") {
          conditions.push(`sf.lift_height > 2.5 AND sf.lift_height <= 4.5`);
        } else if (options.liftLevel === "6in") {
          conditions.push(`sf.lift_height > 4.5 AND sf.lift_height <= 7`);
        } else if (options.liftLevel === "8in") {
          conditions.push(`sf.lift_height > 7`);
        }
      }
    }
    
    if (options?.minLift !== undefined) {
      conditions.push(`sf.lift_height >= $${paramIdx}`);
      params.push(options.minLift);
      paramIdx++;
    }
    
    if (options?.maxLift !== undefined) {
      conditions.push(`sf.lift_height <= $${paramIdx}`);
      params.push(options.maxLift);
      paramIdx++;
    }
    
    if (options?.brand) {
      conditions.push(`sf.brand ILIKE $${paramIdx}`);
      params.push(`%${options.brand}%`);
      paramIdx++;
    }
    
    const whereClause = "WHERE " + conditions.join(" AND ");
    
    // Query with inventory join
    const query = `
      SELECT 
        sf.sku,
        sf.product_desc,
        sf.brand,
        sf.product_type,
        sf.lift_height,
        sf.year_start,
        sf.year_end,
        sf.msrp,
        sf.map_price,
        sf.image_url,
        COALESCE(inv.qoh, 0) as inventory
      FROM suspension_fitments sf
      LEFT JOIN wp_inventory inv ON inv.sku = sf.sku AND inv.product_type = 'accessory'
      ${whereClause}
      ${options?.inStockOnly ? "AND COALESCE(inv.qoh, 0) > 0" : ""}
      ORDER BY sf.lift_height ASC NULLS LAST, sf.msrp ASC NULLS LAST
    `;
    
    const result = await pool.query(query, params);
    
    // Map to LiftKit objects
    const allKits: LiftKit[] = result.rows.map((r: any) => ({
      sku: r.sku,
      name: r.product_desc,
      brand: r.brand,
      productType: r.product_type,
      liftHeight: r.lift_height ? parseFloat(r.lift_height) : null,
      yearRange: `${r.year_start}-${r.year_end}`,
      msrp: r.msrp ? parseFloat(r.msrp) : null,
      mapPrice: r.map_price ? parseFloat(r.map_price) : null,
      imageUrl: r.image_url,
      inventory: parseInt(r.inventory),
      inStock: parseInt(r.inventory) > 0,
    }));
    
    // Group by lift level
    const byLevelMap = new Map<LiftLevel, LiftKit[]>();
    
    for (const kit of allKits) {
      const level = liftHeightToLevel(kit.liftHeight);
      if (level) {
        if (!byLevelMap.has(level)) {
          byLevelMap.set(level, []);
        }
        byLevelMap.get(level)!.push(kit);
      }
    }
    
    // Convert to array with level info
    const byLevel: LiftKitMatch[] = [];
    const levelOrder: LiftLevel[] = ["leveled", "4in", "6in", "8in"];
    
    for (const level of levelOrder) {
      const kits = byLevelMap.get(level) || [];
      if (kits.length > 0) {
        const config = LIFT_LEVELS[level];
        byLevel.push({
          liftLevel: level,
          liftLevelLabel: config.label,
          liftInches: config.inches,
          kits,
          offsetMin: config.offsetMin,
          offsetMax: config.offsetMax,
          targetTireSizes: config.targetTireSizes,
        });
      }
    }
    
    await pool.end();
    
    return {
      vehicle: { year, make, model },
      byLevel,
      allKits,
      total: allKits.length,
    };
    
  } catch (error) {
    await pool.end();
    throw error;
  }
}

/**
 * Get recommended lift kit for a specific intent/level
 */
export async function getRecommendedLiftKit(
  year: number,
  make: string,
  model: string,
  liftLevel: LiftLevel
): Promise<LiftKit | null> {
  const result = await getLiftKitsForVehicle(year, make, model, { 
    liftLevel,
    inStockOnly: true,
  });
  
  // Find first in-stock kit at this level
  const match = result.byLevel.find(l => l.liftLevel === liftLevel);
  if (match && match.kits.length > 0) {
    // Prefer ReadyLift, then by price
    const sorted = [...match.kits].sort((a, b) => {
      // Prefer ReadyLift
      if (a.brand?.includes("ReadyLift") && !b.brand?.includes("ReadyLift")) return -1;
      if (!a.brand?.includes("ReadyLift") && b.brand?.includes("ReadyLift")) return 1;
      // Then by price
      return (a.msrp || Infinity) - (b.msrp || Infinity);
    });
    return sorted[0];
  }
  
  return null;
}

/**
 * Check if lift kits are available for a vehicle
 */
export async function hasLiftKitsForVehicle(
  year: number,
  make: string,
  model: string
): Promise<boolean> {
  const pool = getPool();
  
  try {
    const result = await pool.query(`
      SELECT COUNT(*) as cnt
      FROM suspension_fitments
      WHERE make ILIKE $1 AND model ILIKE $2
        AND year_start <= $3 AND year_end >= $3
      LIMIT 1
    `, [make, `%${model}%`, year]);
    
    await pool.end();
    return parseInt(result.rows[0]?.cnt || "0") > 0;
    
  } catch {
    await pool.end();
    return false;
  }
}
