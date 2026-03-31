/**
 * Tire Enrichment Service
 * 
 * Enriches tire data with:
 * - Clean model names (parsed from cryptic descriptions)
 * - Images from TireLibrary
 * - Cached results for fast lookups
 * 
 * Usage:
 *   const enriched = await enrichTire(tire);
 *   if (!enriched.imageUrl) { /* hide from results */ }
 */

import pg from "pg";
import { parseTireDescription, type ParsedTire } from "./parser";

const { Pool } = pg;

export interface TireToEnrich {
  partNumber: string;
  brand: string | null;
  description: string | null;
  source: string;
  imageUrl?: string | null;
}

export interface EnrichedTire {
  partNumber: string;
  brand: string | null;
  model: string | null;
  displayName: string | null;
  imageUrl: string | null;
  fromCache: boolean;
}

// Pool singleton
let _pool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (_pool) return _pool;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("Missing DATABASE_URL");
  _pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  return _pool;
}

/**
 * Enrich a single tire with model name and image
 */
export async function enrichTire(tire: TireToEnrich): Promise<EnrichedTire> {
  const db = getPool();
  
  // 1. Check cache first
  const cached = await getCachedEnrichment(db, tire.partNumber);
  if (cached) {
    return {
      partNumber: tire.partNumber,
      brand: tire.brand,
      model: cached.displayName,
      displayName: cached.displayName,
      imageUrl: cached.imageUrl,
      fromCache: true,
    };
  }
  
  // 2. Parse description to get clean model name
  const parsed = parseTireDescription(
    tire.description || '',
    tire.brand || undefined,
    tire.source as 'km' | 'wheelpros' | 'tirewire'
  );
  
  // 3. If we already have an image, just cache and return
  if (tire.imageUrl) {
    await cacheEnrichment(db, {
      partNumber: tire.partNumber,
      kmDescription: tire.description,
      displayName: parsed.model,
      imageUrl: tire.imageUrl,
      source: tire.source,
    });
    
    return {
      partNumber: tire.partNumber,
      brand: tire.brand,
      model: parsed.model,
      displayName: parsed.model,
      imageUrl: tire.imageUrl,
      fromCache: false,
    };
  }
  
  // 4. Try to find image from TireLibrary by brand+model
  const imageUrl = await findTireLibraryImage(db, tire.brand, parsed.model, parsed.modelNormalized);
  
  // 5. Cache result (even if no image found, to avoid repeated lookups)
  await cacheEnrichment(db, {
    partNumber: tire.partNumber,
    kmDescription: tire.description,
    displayName: parsed.model,
    imageUrl: imageUrl,
    source: tire.source,
  });
  
  return {
    partNumber: tire.partNumber,
    brand: tire.brand,
    model: parsed.model,
    displayName: parsed.model,
    imageUrl: imageUrl,
    fromCache: false,
  };
}

/**
 * Batch enrich multiple tires
 */
export async function enrichTires(tires: TireToEnrich[]): Promise<Map<string, EnrichedTire>> {
  const results = new Map<string, EnrichedTire>();
  
  // Process in parallel with concurrency limit
  const BATCH_SIZE = 10;
  for (let i = 0; i < tires.length; i += BATCH_SIZE) {
    const batch = tires.slice(i, i + BATCH_SIZE);
    const enriched = await Promise.all(batch.map(t => enrichTire(t)));
    for (const e of enriched) {
      results.set(e.partNumber, e);
    }
  }
  
  return results;
}

/**
 * Check if enrichment is cached
 */
async function getCachedEnrichment(
  db: pg.Pool,
  partNumber: string
): Promise<{ displayName: string | null; imageUrl: string | null } | null> {
  try {
    const { rows } = await db.query(`
      SELECT display_name, image_url 
      FROM tire_asset_cache 
      WHERE id = $1
    `, [partNumber]);
    
    if (rows.length > 0) {
      return {
        displayName: rows[0].display_name,
        imageUrl: rows[0].image_url,
      };
    }
  } catch (err) {
    // Table might not exist yet, ignore
  }
  return null;
}

/**
 * Cache enrichment result
 */
async function cacheEnrichment(
  db: pg.Pool,
  data: {
    partNumber: string;
    kmDescription: string | null;
    displayName: string | null;
    imageUrl: string | null;
    source: string;
  }
): Promise<void> {
  try {
    await db.query(`
      INSERT INTO tire_asset_cache (id, km_description, display_name, image_url, source, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (id) DO UPDATE SET
        km_description = EXCLUDED.km_description,
        display_name = EXCLUDED.display_name,
        image_url = COALESCE(EXCLUDED.image_url, tire_asset_cache.image_url),
        source = EXCLUDED.source,
        updated_at = NOW()
    `, [data.partNumber, data.kmDescription, data.displayName, data.imageUrl, data.source]);
  } catch (err) {
    console.error('[tire-enrichment] Cache write failed:', err);
  }
}

/**
 * Try to find image from TireLibrary patterns table
 * This queries any cached pattern data we have
 */
async function findTireLibraryImage(
  db: pg.Pool,
  brand: string | null,
  model: string | null,
  modelNormalized: string
): Promise<string | null> {
  if (!brand || !model) return null;
  
  try {
    // Check if we have a tire_library_patterns table with cached pattern images
    const { rows } = await db.query(`
      SELECT image_url FROM tire_library_patterns
      WHERE LOWER(brand) = LOWER($1)
        AND (
          LOWER(pattern) = LOWER($2)
          OR LOWER(REPLACE(REPLACE(pattern, ' ', ''), '-', '')) = $3
        )
      LIMIT 1
    `, [brand, model, modelNormalized]);
    
    if (rows.length > 0 && rows[0].image_url) {
      return rows[0].image_url;
    }
  } catch (err) {
    // Table might not exist, that's OK
  }
  
  // Try the admin_product_flags table for manual overrides
  try {
    const { rows } = await db.query(`
      SELECT image_url FROM admin_product_flags
      WHERE LOWER(brand) = LOWER($1)
        AND LOWER(model) = LOWER($2)
        AND product_type = 'tire'
        AND image_url IS NOT NULL
      LIMIT 1
    `, [brand, model]);
    
    if (rows.length > 0) {
      return rows[0].image_url;
    }
  } catch (err) {
    // Ignore
  }
  
  return null;
}

/**
 * Filter results to only include tires with images
 */
export function filterTiresWithImages<T extends { imageUrl?: string | null }>(
  tires: T[]
): T[] {
  return tires.filter(t => t.imageUrl && t.imageUrl.length > 0);
}
