/**
 * MAP Price Floor Service
 * 
 * Ensures we never advertise below Minimum Advertised Price (MAP)
 * for brands that enforce it.
 * 
 * Data source: US AutoForce API (has MAP data for most brands)
 * Fallback: If no MAP data, allow any price
 * 
 * Usage:
 *   const price = await applyMapFloor(cost, partNumber, calculatedPrice);
 */

import pg from "pg";

// ============================================================================
// MAP CACHE TABLE
// ============================================================================

export async function ensureMapCacheTable(db: pg.Pool): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS tire_map_cache (
      part_number TEXT PRIMARY KEY,
      brand_code TEXT,
      map_price NUMERIC(10, 2),
      msrp NUMERIC(10, 2),
      cost NUMERIC(10, 2),
      source TEXT DEFAULT 'usautoforce',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS tire_map_cache_brand_idx ON tire_map_cache (brand_code);
    CREATE INDEX IF NOT EXISTS tire_map_cache_updated_idx ON tire_map_cache (updated_at);
  `);
}

// ============================================================================
// MAP LOOKUP
// ============================================================================

export interface MapData {
  partNumber: string;
  brandCode: string | null;
  mapPrice: number | null;
  msrp: number | null;
  cost: number | null;
}

/**
 * Get MAP data for a tire part number
 */
export async function getMapData(db: pg.Pool, partNumber: string): Promise<MapData | null> {
  await ensureMapCacheTable(db);
  
  const { rows } = await db.query(`
    SELECT part_number, brand_code, map_price, msrp, cost
    FROM tire_map_cache
    WHERE part_number = $1
    LIMIT 1
  `, [partNumber]);
  
  if (rows.length === 0) return null;
  
  const row = rows[0];
  return {
    partNumber: row.part_number,
    brandCode: row.brand_code,
    mapPrice: row.map_price ? parseFloat(row.map_price) : null,
    msrp: row.msrp ? parseFloat(row.msrp) : null,
    cost: row.cost ? parseFloat(row.cost) : null,
  };
}

/**
 * Batch get MAP data for multiple part numbers
 */
export async function getMapDataBatch(db: pg.Pool, partNumbers: string[]): Promise<Map<string, MapData>> {
  if (partNumbers.length === 0) return new Map();
  
  await ensureMapCacheTable(db);
  
  const { rows } = await db.query(`
    SELECT part_number, brand_code, map_price, msrp, cost
    FROM tire_map_cache
    WHERE part_number = ANY($1)
  `, [partNumbers]);
  
  const result = new Map<string, MapData>();
  for (const row of rows) {
    result.set(row.part_number, {
      partNumber: row.part_number,
      brandCode: row.brand_code,
      mapPrice: row.map_price ? parseFloat(row.map_price) : null,
      msrp: row.msrp ? parseFloat(row.msrp) : null,
      cost: row.cost ? parseFloat(row.cost) : null,
    });
  }
  
  return result;
}

/**
 * Store MAP data (from US AutoForce sync)
 */
export async function upsertMapData(
  db: pg.Pool,
  items: Array<{
    partNumber: string;
    brandCode?: string;
    mapPrice?: number;
    msrp?: number;
    cost?: number;
  }>
): Promise<number> {
  if (items.length === 0) return 0;
  
  await ensureMapCacheTable(db);
  
  const values: string[] = [];
  const params: any[] = [];
  let idx = 1;
  
  for (const item of items) {
    values.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4})`);
    params.push(
      item.partNumber,
      item.brandCode || null,
      item.mapPrice ?? null,
      item.msrp ?? null,
      item.cost ?? null
    );
    idx += 5;
  }
  
  const { rowCount } = await db.query(`
    INSERT INTO tire_map_cache (part_number, brand_code, map_price, msrp, cost)
    VALUES ${values.join(", ")}
    ON CONFLICT (part_number) DO UPDATE SET
      brand_code = EXCLUDED.brand_code,
      map_price = COALESCE(EXCLUDED.map_price, tire_map_cache.map_price),
      msrp = COALESCE(EXCLUDED.msrp, tire_map_cache.msrp),
      cost = COALESCE(EXCLUDED.cost, tire_map_cache.cost),
      updated_at = NOW()
  `, params);
  
  return rowCount ?? 0;
}

// ============================================================================
// PRICE FLOOR APPLICATION
// ============================================================================

/**
 * Apply MAP floor to a calculated price.
 * 
 * Rules:
 * - If MAP exists and calculated < MAP: return MAP (floor)
 * - If MAP exists and calculated >= MAP: return calculated (we can go higher)
 * - If no MAP: return calculated (no enforcement)
 * 
 * @param partNumber - Tire part number
 * @param calculatedPrice - Our calculated sell price (cost + margin)
 * @param db - Database pool
 * @returns Final price (may be raised to MAP)
 */
export async function applyMapFloor(
  db: pg.Pool,
  partNumber: string,
  calculatedPrice: number
): Promise<{ price: number; mapApplied: boolean; mapPrice: number | null }> {
  const mapData = await getMapData(db, partNumber);
  
  if (!mapData || !mapData.mapPrice || mapData.mapPrice <= 0) {
    // No MAP data - use calculated price
    return { price: calculatedPrice, mapApplied: false, mapPrice: null };
  }
  
  if (calculatedPrice < mapData.mapPrice) {
    // Calculated price is below MAP - raise to MAP
    console.log(`[MAP] ${partNumber}: Raising $${calculatedPrice.toFixed(2)} to MAP $${mapData.mapPrice.toFixed(2)}`);
    return { price: mapData.mapPrice, mapApplied: true, mapPrice: mapData.mapPrice };
  }
  
  // Calculated price is at or above MAP - use calculated
  return { price: calculatedPrice, mapApplied: false, mapPrice: mapData.mapPrice };
}

/**
 * Batch apply MAP floor to multiple tires
 */
export async function applyMapFloorBatch(
  db: pg.Pool,
  items: Array<{ partNumber: string; calculatedPrice: number }>
): Promise<Map<string, { price: number; mapApplied: boolean; mapPrice: number | null }>> {
  const partNumbers = items.map(i => i.partNumber);
  const mapDataMap = await getMapDataBatch(db, partNumbers);
  
  const result = new Map<string, { price: number; mapApplied: boolean; mapPrice: number | null }>();
  
  for (const item of items) {
    const mapData = mapDataMap.get(item.partNumber);
    
    if (!mapData || !mapData.mapPrice || mapData.mapPrice <= 0) {
      result.set(item.partNumber, {
        price: item.calculatedPrice,
        mapApplied: false,
        mapPrice: null,
      });
      continue;
    }
    
    if (item.calculatedPrice < mapData.mapPrice) {
      result.set(item.partNumber, {
        price: mapData.mapPrice,
        mapApplied: true,
        mapPrice: mapData.mapPrice,
      });
    } else {
      result.set(item.partNumber, {
        price: item.calculatedPrice,
        mapApplied: false,
        mapPrice: mapData.mapPrice,
      });
    }
  }
  
  return result;
}

// ============================================================================
// MARGIN ANALYSIS
// ============================================================================

/**
 * Calculate what our margin would be at MAP price
 */
export function calculateMapMargin(cost: number, mapPrice: number): {
  marginDollars: number;
  marginPercent: number;
  isPositive: boolean;
} {
  const marginDollars = mapPrice - cost;
  const marginPercent = cost > 0 ? (marginDollars / cost) * 100 : 0;
  
  return {
    marginDollars,
    marginPercent,
    isPositive: marginDollars > 0,
  };
}
