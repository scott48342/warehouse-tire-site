/**
 * Tire Pattern Specs Cache
 * 
 * Provides spec enrichment for tires by looking up cached specs by brand + pattern name.
 * This allows TireWeb results to be enriched with UTQG, warranty, tread depth, etc.
 * from WheelPros data (or other sources in the future).
 * 
 * Table: tire_pattern_specs
 * Key: LOWER(brand + ':' + pattern_name)
 */

import pg from "pg";

const { Pool } = pg;

let _pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (_pool) return _pool;
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Missing POSTGRES_URL");
  _pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
  return _pool;
}

export interface TirePatternSpecs {
  utqg: string | null;
  treadwear: number | null;
  traction: string | null;
  temperature: string | null;
  treadDepth: number | null;
  terrain: string | null;
  mileageWarranty: number | null;
  source: string;
}

// In-memory cache (refreshed hourly)
let _specsCache: Map<string, TirePatternSpecs> | null = null;
let _specsCacheExpiry = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Build pattern key for lookup
 * Normalizes brand and pattern name for consistent matching
 */
export function buildPatternKey(brand: string, patternName: string): string {
  // Normalize: lowercase, remove special chars, trim
  const normBrand = brand.toLowerCase().trim();
  const normPattern = patternName
    .toLowerCase()
    .trim()
    .split(/[\s\/\-]+/)[0]; // Take first word/segment
  
  return `${normBrand}:${normPattern}`;
}

/**
 * Load all pattern specs into memory cache
 */
async function loadSpecsCache(): Promise<Map<string, TirePatternSpecs>> {
  const pool = getPool();
  
  const { rows } = await pool.query(`
    SELECT 
      pattern_key,
      utqg,
      treadwear,
      traction,
      temperature,
      tread_depth,
      terrain,
      mileage_warranty,
      source
    FROM tire_pattern_specs
  `);
  
  const cache = new Map<string, TirePatternSpecs>();
  
  for (const row of rows) {
    cache.set(row.pattern_key, {
      utqg: row.utqg || null,
      treadwear: row.treadwear ? parseInt(row.treadwear) : null,
      traction: row.traction || null,
      temperature: row.temperature || null,
      treadDepth: row.tread_depth ? parseFloat(row.tread_depth) : null,
      terrain: row.terrain || null,
      mileageWarranty: row.mileage_warranty ? parseInt(row.mileage_warranty) : null,
      source: row.source || 'wheelpros',
    });
  }
  
  console.log(`[pattern-specs] Loaded ${cache.size} patterns into cache`);
  return cache;
}

/**
 * Get cached specs (loads cache if needed)
 */
async function getCache(): Promise<Map<string, TirePatternSpecs>> {
  const now = Date.now();
  
  if (_specsCache && now < _specsCacheExpiry) {
    return _specsCache;
  }
  
  _specsCache = await loadSpecsCache();
  _specsCacheExpiry = now + CACHE_TTL_MS;
  return _specsCache;
}

/**
 * Look up specs for a tire by brand + pattern name
 * 
 * @param brand - Tire brand (e.g., "MICHELIN")
 * @param patternName - Pattern name (e.g., "Primacy A/S" or "PRIMACY")
 * @returns Cached specs or null if not found
 */
export async function getPatternSpecs(
  brand: string | null | undefined,
  patternName: string | null | undefined
): Promise<TirePatternSpecs | null> {
  if (!brand || !patternName) return null;
  
  const cache = await getCache();
  const key = buildPatternKey(brand, patternName);
  
  return cache.get(key) || null;
}

/**
 * Batch lookup specs for multiple tires
 * More efficient than individual lookups
 * 
 * @param tires - Array of { brand, pattern } objects
 * @returns Map of index -> specs
 */
export async function getPatternSpecsBatch(
  tires: Array<{ brand: string | null; pattern: string | null }>
): Promise<Map<number, TirePatternSpecs>> {
  const cache = await getCache();
  const results = new Map<number, TirePatternSpecs>();
  
  for (let i = 0; i < tires.length; i++) {
    const tire = tires[i];
    if (!tire.brand || !tire.pattern) continue;
    
    const key = buildPatternKey(tire.brand, tire.pattern);
    const specs = cache.get(key);
    
    if (specs) {
      results.set(i, specs);
    }
  }
  
  return results;
}

/**
 * Enrich TireWeb results with cached specs
 * Modifies results in place
 */
export async function enrichTireWebResultsWithSpecs<T extends {
  brand: string | null;
  model?: string | null;
  pattern?: string;
  badges: {
    utqg?: string | null;
    treadDepth?: number | null;
    warrantyMiles?: number | null;
    terrain?: string | null;
  };
  enrichment?: {
    mileage?: number | null;
    treadCategory?: string | null;
  };
}>(results: T[]): Promise<{ enriched: number; total: number }> {
  const cache = await getCache();
  let enrichedCount = 0;
  
  for (const tire of results) {
    // Get pattern name from model or description
    const patternName = tire.model || tire.pattern;
    if (!tire.brand || !patternName) continue;
    
    const key = buildPatternKey(tire.brand, patternName);
    const specs = cache.get(key);
    
    if (!specs) continue;
    
    // Enrich badges (only if not already set)
    if (!tire.badges.utqg && specs.utqg) {
      tire.badges.utqg = specs.utqg;
    }
    if (tire.badges.treadDepth == null && specs.treadDepth != null) {
      tire.badges.treadDepth = specs.treadDepth;
    }
    if (tire.badges.warrantyMiles == null && specs.mileageWarranty != null) {
      tire.badges.warrantyMiles = specs.mileageWarranty;
    }
    if (!tire.badges.terrain && specs.terrain) {
      tire.badges.terrain = specs.terrain;
    }
    
    // Enrich enrichment object
    if (tire.enrichment) {
      if (tire.enrichment.mileage == null && specs.mileageWarranty != null) {
        tire.enrichment.mileage = specs.mileageWarranty;
      }
      if (!tire.enrichment.treadCategory && specs.terrain) {
        tire.enrichment.treadCategory = specs.terrain;
      }
    }
    
    enrichedCount++;
  }
  
  return { enriched: enrichedCount, total: results.length };
}

/**
 * Clear the in-memory cache (for testing/admin)
 */
export function clearSpecsCache(): void {
  _specsCache = null;
  _specsCacheExpiry = 0;
}
