/**
 * MAP (Minimum Advertised Price) Floor Enforcement
 * 
 * Ensures displayed tire prices never fall below manufacturer MAP.
 * Critical for compliance with Falken/Dunlop/Sumitomo MAP policies.
 * 
 * Violation consequences:
 * - 1st violation: 5 business day warning
 * - 2nd violation: 6-month DO NOT SELL list (as Non-Direct Reseller)
 * 
 * @see Falken Tire MAP Policy (August 2026)
 */

import pg from "pg";

const { Pool } = pg;

export interface MapPriceData {
  partNumber: string;
  mapPrice: number;
  brand: string;
  model: string;
  source: 'database' | 'hardcoded' | 'size_match' | 'none';
}

/**
 * Hardcoded MAP prices by part number.
 * Includes both violation notice SKUs AND actual site part numbers.
 */
const HARDCODED_MAP_PRICES: Record<string, { map: number; brand: string; model: string }> = {
  // === Dunlop Winter Maxx SJ8 (SUV) ===
  // From Sept 2026 violation notice (Falken/Dunlop internal SKUs)
  '10037544': { map: 158, brand: 'Dunlop', model: 'Winter Maxx SJ8' }, // 225/55R17
  '10037555': { map: 164, brand: 'Dunlop', model: 'Winter Maxx SJ8' }, // 225/65R17
  '10037556': { map: 184, brand: 'Dunlop', model: 'Winter Maxx SJ8' }, // 235/55R18
  '10037558': { map: 192, brand: 'Dunlop', model: 'Winter Maxx SJ8' }, // 235/65R18
  '10037559': { map: 213, brand: 'Dunlop', model: 'Winter Maxx SJ8' }, // 245/55R19
  '10037560': { map: 198, brand: 'Dunlop', model: 'Winter Maxx SJ8' }, // 245/60R18
  '10037561': { map: 219, brand: 'Dunlop', model: 'Winter Maxx SJ8' }, // 255/50R19
  
  // Actual site part numbers (from TireWeb/supplier feed)
  '10037782': { map: 213, brand: 'Dunlop', model: 'Winter Maxx SJ8' }, // 245/55R19
  '10037890': { map: 219, brand: 'Dunlop', model: 'Winter Maxx SJ8' }, // 255/50R19
  
  // === Dunlop Winter Maxx WM02 (Passenger) ===
  // From Sept 2026 violation notice
  '10037510': { map: 123, brand: 'Dunlop', model: 'Winter Maxx WM02' }, // 205/55R16
  '10037517': { map: 148, brand: 'Dunlop', model: 'Winter Maxx WM02' }, // 215/55R17
  '10037520': { map: 203, brand: 'Dunlop', model: 'Winter Maxx WM02' }, // 225/45R18
};

/**
 * Size-based MAP lookup for Winter Maxx tires.
 * Fallback when part number doesn't match but we know the size.
 * Key format: "SIZE|MODEL" (e.g., "245/55R19|SJ8")
 */
const SIZE_BASED_MAP: Record<string, number> = {
  // Winter Maxx SJ8
  '225/55R17|SJ8': 158,
  '225/65R17|SJ8': 164,
  '235/55R18|SJ8': 184,
  '235/65R18|SJ8': 192,
  '245/55R19|SJ8': 213,
  '245/60R18|SJ8': 198,
  '255/50R19|SJ8': 219,
  
  // Winter Maxx WM02
  '205/55R16|WM02': 123,
  '215/55R17|WM02': 148,
  '225/45R18|WM02': 203,
};

// Database pool (lazy initialized)
let pool: pg.Pool | null = null;

function getPool(): pg.Pool | null {
  if (pool) return pool;
  
  const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!DATABASE_URL) {
    console.warn('[mapPriceFloor] No database URL configured');
    return null;
  }
  
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
  
  return pool;
}

/**
 * Extract size from tire data (handles various formats)
 */
function extractSize(tire: { size?: string; tireSize?: string }): string | null {
  const size = tire.size || tire.tireSize;
  if (!size) return null;
  
  // Normalize to standard format: 245/55R19
  const match = size.match(/(\d{3})\/(\d{2,3})R(\d{2})/i);
  if (match) {
    return `${match[1]}/${match[2]}R${match[3]}`.toUpperCase();
  }
  return size.toUpperCase();
}

/**
 * Extract model variant from tire model name
 */
function extractModelVariant(model: string): string | null {
  if (!model) return null;
  const upper = model.toUpperCase();
  if (upper.includes('SJ8')) return 'SJ8';
  if (upper.includes('WM02')) return 'WM02';
  if (upper.includes('WINTER MAXX 2') || upper.includes('WINTERMAXX 2')) return 'WM02';
  return null;
}

/**
 * Get MAP price for a tire by part number, with size-based fallback.
 */
export async function getMapPrice(
  partNumber: string,
  tire?: { size?: string; tireSize?: string; model?: string; brand?: string }
): Promise<MapPriceData | null> {
  const normalized = partNumber.trim();
  
  // 1. Check hardcoded by part number (fastest, most critical)
  const hardcoded = HARDCODED_MAP_PRICES[normalized];
  if (hardcoded) {
    return {
      partNumber: normalized,
      mapPrice: hardcoded.map,
      brand: hardcoded.brand,
      model: hardcoded.model,
      source: 'hardcoded',
    };
  }
  
  // 2. Check by size + model for Dunlop Winter Maxx
  if (tire) {
    const brand = tire.brand?.toUpperCase() || '';
    const model = tire.model?.toUpperCase() || '';
    
    if (brand.includes('DUNLOP') && model.includes('WINTER')) {
      const size = extractSize(tire);
      const variant = extractModelVariant(model);
      
      if (size && variant) {
        const key = `${size}|${variant}`;
        const mapPrice = SIZE_BASED_MAP[key];
        
        if (mapPrice) {
          console.log(`[mapPriceFloor] Size-based MAP match: ${key} -> $${mapPrice}`);
          return {
            partNumber: normalized,
            mapPrice,
            brand: 'Dunlop',
            model: `Winter Maxx ${variant}`,
            source: 'size_match',
          };
        }
      }
    }
  }
  
  // 3. Check database cache
  const db = getPool();
  if (db) {
    try {
      const { rows } = await db.query(`
        SELECT part_number, map_usd, brand, model 
        FROM tire_map_cache 
        WHERE part_number = $1 AND map_usd > 0
        LIMIT 1
      `, [normalized]);
      
      if (rows.length > 0 && rows[0].map_usd) {
        return {
          partNumber: normalized,
          mapPrice: Number(rows[0].map_usd),
          brand: rows[0].brand || 'Unknown',
          model: rows[0].model || 'Unknown',
          source: 'database',
        };
      }
    } catch (error) {
      // Table might not exist yet - that's OK
      console.warn('[mapPriceFloor] Database lookup failed:', error);
    }
  }
  
  return null;
}

/**
 * Enforce MAP floor on a calculated price.
 */
export function enforceMapFloor(
  calculatedPrice: number,
  mapPrice: number | null | undefined
): { price: number; wasAdjusted: boolean; mapPrice: number | null } {
  if (mapPrice == null || mapPrice <= 0) {
    return { price: calculatedPrice, wasAdjusted: false, mapPrice: null };
  }
  
  if (calculatedPrice < mapPrice) {
    console.log(`[mapPriceFloor] Enforcing MAP: $${calculatedPrice.toFixed(2)} → $${mapPrice.toFixed(2)}`);
    return { price: mapPrice, wasAdjusted: true, mapPrice };
  }
  
  return { price: calculatedPrice, wasAdjusted: false, mapPrice };
}

/**
 * Batch MAP lookup for multiple tires.
 * Accepts full tire objects for size-based matching.
 */
export async function getMapPricesBatch(
  tires: Array<{ partNumber: string; size?: string; tireSize?: string; model?: string; brand?: string }>
): Promise<Map<string, MapPriceData>> {
  const results = new Map<string, MapPriceData>();
  const toQuery: string[] = [];
  
  // Check hardcoded and size-based first
  for (const tire of tires) {
    const pn = tire.partNumber?.trim();
    if (!pn) continue;
    
    // Check hardcoded by part number
    const hardcoded = HARDCODED_MAP_PRICES[pn];
    if (hardcoded) {
      results.set(pn, {
        partNumber: pn,
        mapPrice: hardcoded.map,
        brand: hardcoded.brand,
        model: hardcoded.model,
        source: 'hardcoded',
      });
      continue;
    }
    
    // Check size-based for Dunlop Winter Maxx
    const brand = tire.brand?.toUpperCase() || '';
    const model = tire.model?.toUpperCase() || '';
    
    if (brand.includes('DUNLOP') && model.includes('WINTER')) {
      const size = extractSize(tire);
      const variant = extractModelVariant(model);
      
      if (size && variant) {
        const key = `${size}|${variant}`;
        const mapPrice = SIZE_BASED_MAP[key];
        
        if (mapPrice) {
          results.set(pn, {
            partNumber: pn,
            mapPrice,
            brand: 'Dunlop',
            model: `Winter Maxx ${variant}`,
            source: 'size_match',
          });
          continue;
        }
      }
    }
    
    toQuery.push(pn);
  }
  
  // Batch query database for remaining
  if (toQuery.length > 0) {
    const db = getPool();
    if (db) {
      try {
        // Build lookup arrays: original part numbers AND normalized (strip F prefix for Falken)
        const lookupPns: string[] = [];
        const normalizedToOriginal = new Map<string, string>();
        
        for (const pn of toQuery) {
          lookupPns.push(pn);
          // If starts with F followed by digits, also try without F (Falken format)
          if (/^F\d+/.test(pn)) {
            const stripped = pn.substring(1);
            lookupPns.push(stripped);
            normalizedToOriginal.set(stripped, pn);
          }
        }
        
        const { rows } = await db.query(`
          SELECT part_number, map_usd, brand, model 
          FROM tire_map_cache 
          WHERE part_number = ANY($1) AND map_usd > 0
        `, [lookupPns]);
        
        for (const row of rows) {
          if (row.map_usd && Number(row.map_usd) > 0) {
            // Map back to original part number if this was a normalized lookup
            const originalPn = normalizedToOriginal.get(row.part_number) || row.part_number;
            results.set(originalPn, {
              partNumber: originalPn,
              mapPrice: Number(row.map_usd),
              brand: row.brand || 'Unknown',
              model: row.model || 'Unknown',
              source: 'database',
            });
          }
        }
      } catch (error) {
        console.warn('[mapPriceFloor] Batch database lookup failed:', error);
      }
    }
  }
  
  return results;
}

/**
 * Apply MAP floor enforcement to a batch of tire results.
 * This wrapper calls getMapPricesBatch and enforces MAP floor on each tire.
 * Critical for compliance with Falken/Dunlop/Sumitomo MAP policies.
 */
export async function applyMapFloorBatch<T extends { partNumber?: string; price?: number | null; cost?: number | null; size?: string; model?: string | null; brand?: string | null }>(results: T[]): Promise<T[]> {
  if (results.length === 0) return results;
  
  // Build lookup data for MAP prices
  const tiresForMapLookup = results
    .filter(r => r.partNumber)
    .map(r => ({
      partNumber: r.partNumber!,
      size: r.size || undefined,
      model: r.model || undefined,
      brand: r.brand || undefined,
    }));
  
  if (tiresForMapLookup.length === 0) return results;
  
  try {
    const mapPrices = await getMapPricesBatch(tiresForMapLookup);
    
    let adjustedCount = 0;
    const adjusted = results.map(tire => {
      if (!tire.partNumber) return tire;
      
      // Calculate the displayed price: always use at least cost + $50 margin
      const costPlusMargin = tire.cost ? tire.cost + 50 : null;
      let finalPrice = costPlusMargin != null 
        ? Math.max(tire.price ?? 0, costPlusMargin)
        : tire.price;
      
      // Check for MAP enforcement
      const mapData = mapPrices.get(tire.partNumber);
      let mapEnforced = false;
      let mapPrice: number | null = mapData?.mapPrice ?? null;
      
      if (mapData && finalPrice != null && finalPrice < mapData.mapPrice) {
        adjustedCount++;
        console.log(`[MAP] Enforcing floor for ${tire.partNumber}: $${finalPrice.toFixed(2)} → $${mapData.mapPrice.toFixed(2)} (${mapData.brand} ${mapData.model})`);
        finalPrice = mapData.mapPrice;
        mapEnforced = true;
      }
      
      // Return tire with updated price
      return {
        ...tire,
        price: finalPrice,
        mapEnforced,
        mapPrice,
      };
    });
    
    if (adjustedCount > 0) {
      console.log(`[MAP] Adjusted ${adjustedCount} tire prices to meet MAP requirements`);
    }
    
    return adjusted;
  } catch (error) {
    console.error('[MAP] Error applying MAP floor:', error);
    return results; // Return original on error
  }
}
