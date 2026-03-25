/**
 * Wheel-Size Catalog Store (PostgreSQL)
 * 
 * Persistent storage for catalog data from Wheel-Size API.
 * ONLY stores data from catalog endpoints (makes, models, years).
 * Does NOT store search results.
 * 
 * Database tables:
 * - catalog_makes: { slug, name }
 * - catalog_models: { make_slug, slug, name, years[] }
 * - catalog_sync_log: Track sync timestamps
 */

import { db } from "./fitment-db/db";
import { catalogMakes, catalogModels, catalogSyncLog } from "./fitment-db/schema";
import { eq, and, ilike, sql } from "drizzle-orm";
import * as wheelSizeApi from "./wheelSizeApi";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface CatalogMake {
  slug: string;
  name: string;
}

export interface CatalogModel {
  slug: string;
  name: string;
  years: number[];
}

// Sync interval: only re-fetch from API if data is older than this
const SYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API - READ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all makes from catalog (DB first, API fallback)
 */
export async function getMakes(): Promise<CatalogMake[]> {
  try {
    // Check if we have makes in DB
    const dbMakes = await db.query.catalogMakes.findMany({
      orderBy: (makes, { asc }) => [asc(makes.name)],
    });
    
    if (dbMakes.length > 0) {
      console.log(`[catalog-store] DB HIT: ${dbMakes.length} makes`);
      return dbMakes.map(m => ({ slug: m.slug, name: m.name }));
    }
    
    // DB miss - populate from API
    console.log(`[catalog-store] DB MISS for makes, fetching from API...`);
    await populateMakes();
    
    const freshMakes = await db.query.catalogMakes.findMany({
      orderBy: (makes, { asc }) => [asc(makes.name)],
    });
    return freshMakes.map(m => ({ slug: m.slug, name: m.name }));
  } catch (err) {
    console.error("[catalog-store] Error getting makes:", err);
    return [];
  }
}

/**
 * Get models for a make from catalog (DB first, API fallback)
 */
export async function getModels(makeSlug: string): Promise<CatalogModel[]> {
  const normalizedMake = makeSlug.toLowerCase();
  
  try {
    // Check if we have models in DB
    const dbModels = await db.query.catalogModels.findMany({
      where: eq(catalogModels.makeSlug, normalizedMake),
      orderBy: (models, { asc }) => [asc(models.name)],
    });
    
    if (dbModels.length > 0) {
      console.log(`[catalog-store] DB HIT: ${dbModels.length} models for ${makeSlug}`);
      return dbModels.map(m => ({ 
        slug: m.slug, 
        name: m.name, 
        years: (m.years || []) as number[] 
      }));
    }
    
    // DB miss - populate from API
    console.log(`[catalog-store] DB MISS for ${makeSlug} models, fetching from API...`);
    await populateModels(normalizedMake);
    
    const freshModels = await db.query.catalogModels.findMany({
      where: eq(catalogModels.makeSlug, normalizedMake),
      orderBy: (models, { asc }) => [asc(models.name)],
    });
    return freshModels.map(m => ({ 
      slug: m.slug, 
      name: m.name, 
      years: (m.years || []) as number[] 
    }));
  } catch (err) {
    console.error(`[catalog-store] Error getting models for ${makeSlug}:`, err);
    return [];
  }
}

/**
 * Get valid years for a make/model combination
 * Returns empty array if model not found
 */
export async function getYears(makeSlug: string, modelSlug: string): Promise<number[]> {
  const model = await findModel(makeSlug, modelSlug);
  return model?.years || [];
}

/**
 * Check if a year is valid for a make/model
 */
export async function isValidYear(makeSlug: string, modelSlug: string, year: number): Promise<boolean> {
  const years = await getYears(makeSlug, modelSlug);
  return years.includes(year);
}

/**
 * Find a model by name (fuzzy match)
 */
export async function findModel(makeSlug: string, modelName: string): Promise<CatalogModel | null> {
  const normalizedMake = makeSlug.toLowerCase();
  const normalizedModel = modelName.toLowerCase().replace(/[^a-z0-9]/g, "");
  
  try {
    // First try exact slug match
    const exactMatch = await db.query.catalogModels.findFirst({
      where: and(
        eq(catalogModels.makeSlug, normalizedMake),
        eq(catalogModels.slug, normalizedModel)
      ),
    });
    
    if (exactMatch) {
      return { 
        slug: exactMatch.slug, 
        name: exactMatch.name, 
        years: (exactMatch.years || []) as number[] 
      };
    }
    
    // Try case-insensitive name match
    const nameMatch = await db.query.catalogModels.findFirst({
      where: and(
        eq(catalogModels.makeSlug, normalizedMake),
        ilike(catalogModels.name, modelName)
      ),
    });
    
    if (nameMatch) {
      return { 
        slug: nameMatch.slug, 
        name: nameMatch.name, 
        years: (nameMatch.years || []) as number[] 
      };
    }
    
    // Try partial slug match
    const models = await getModels(normalizedMake);
    const fuzzyMatch = models.find(m => {
      const slug = m.slug.toLowerCase().replace(/[^a-z0-9]/g, "");
      const name = m.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      return slug === normalizedModel || 
             name === normalizedModel || 
             slug.includes(normalizedModel) || 
             name.includes(normalizedModel);
    });
    
    return fuzzyMatch || null;
  } catch (err) {
    console.error(`[catalog-store] Error finding model ${makeSlug}/${modelName}:`, err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API - POPULATE (from Wheel-Size API)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch and store all makes from Wheel-Size API
 */
export async function populateMakes(): Promise<number> {
  console.log("[catalog-store] Populating makes from API...");
  
  try {
    const apiMakes = await wheelSizeApi.getMakes();
    
    // Upsert all makes
    for (const make of apiMakes) {
      await db
        .insert(catalogMakes)
        .values({
          slug: make.slug.toLowerCase(),
          name: make.name,
        })
        .onConflictDoUpdate({
          target: catalogMakes.slug,
          set: {
            name: make.name,
            updatedAt: new Date(),
          },
        });
    }
    
    // Update sync log
    await db
      .insert(catalogSyncLog)
      .values({
        entityType: "makes",
        entityKey: "all",
        recordCount: apiMakes.length,
      })
      .onConflictDoUpdate({
        target: [catalogSyncLog.entityType, catalogSyncLog.entityKey],
        set: {
          syncedAt: new Date(),
          recordCount: apiMakes.length,
        },
      });
    
    console.log(`[catalog-store] Stored ${apiMakes.length} makes`);
    return apiMakes.length;
  } catch (err) {
    console.error("[catalog-store] Error populating makes:", err);
    throw err;
  }
}

/**
 * Fetch and store models for a make, including valid years
 */
export async function populateModels(makeSlug: string): Promise<number> {
  const normalizedMake = makeSlug.toLowerCase();
  console.log(`[catalog-store] Populating models for ${normalizedMake}...`);
  
  try {
    const apiModels = await wheelSizeApi.getModels(normalizedMake);
    let count = 0;
    
    for (const model of apiModels) {
      // Fetch valid years for each model
      let years: number[] = [];
      try {
        years = await wheelSizeApi.getYears(normalizedMake, model.slug);
        years = years.sort((a, b) => b - a); // descending
      } catch (err) {
        console.warn(`[catalog-store] Failed to get years for ${normalizedMake}/${model.slug}`);
      }
      
      // Upsert model
      await db
        .insert(catalogModels)
        .values({
          makeSlug: normalizedMake,
          slug: model.slug.toLowerCase(),
          name: model.name,
          years: years,
        })
        .onConflictDoUpdate({
          target: [catalogModels.makeSlug, catalogModels.slug],
          set: {
            name: model.name,
            years: years,
            updatedAt: new Date(),
          },
        });
      
      count++;
    }
    
    // Update sync log
    await db
      .insert(catalogSyncLog)
      .values({
        entityType: "models",
        entityKey: normalizedMake,
        recordCount: count,
      })
      .onConflictDoUpdate({
        target: [catalogSyncLog.entityType, catalogSyncLog.entityKey],
        set: {
          syncedAt: new Date(),
          recordCount: count,
        },
      });
    
    console.log(`[catalog-store] Stored ${count} models for ${normalizedMake}`);
    return count;
  } catch (err) {
    console.error(`[catalog-store] Error populating models for ${normalizedMake}:`, err);
    throw err;
  }
}

/**
 * Populate common US makes and their models with years
 */
export async function populateCommonMakes(): Promise<{ makes: number; models: number }> {
  const commonMakes = [
    "acura", "audi", "bmw", "buick", "cadillac", "chevrolet", "chrysler",
    "dodge", "ford", "genesis", "gmc", "honda", "hyundai", "infiniti",
    "jaguar", "jeep", "kia", "land-rover", "lexus", "lincoln", "mazda",
    "mercedes", "mini", "mitsubishi", "nissan", "porsche", "ram", "subaru",
    "tesla", "toyota", "volkswagen", "volvo"
  ];
  
  // First populate all makes
  await populateMakes();
  
  let totalModels = 0;
  
  // Then populate models with years for common makes
  for (const makeSlug of commonMakes) {
    try {
      const count = await populateModels(makeSlug);
      totalModels += count;
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 50));
    } catch (err) {
      console.error(`[catalog-store] Failed to populate ${makeSlug}:`, err);
    }
  }
  
  const makesCount = await db.select({ count: sql<number>`count(*)` }).from(catalogMakes);
  return { 
    makes: Number(makesCount[0]?.count || 0), 
    models: totalModels 
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get catalog stats
 */
export async function getStats(): Promise<{
  makes: number;
  models: number;
  lastSync: string | null;
}> {
  try {
    const makesCount = await db.select({ count: sql<number>`count(*)` }).from(catalogMakes);
    const modelsCount = await db.select({ count: sql<number>`count(*)` }).from(catalogModels);
    
    const lastSync = await db.query.catalogSyncLog.findFirst({
      orderBy: (log, { desc }) => [desc(log.syncedAt)],
    });
    
    return {
      makes: Number(makesCount[0]?.count || 0),
      models: Number(modelsCount[0]?.count || 0),
      lastSync: lastSync?.syncedAt?.toISOString() || null,
    };
  } catch (err) {
    console.error("[catalog-store] Error getting stats:", err);
    return { makes: 0, models: 0, lastSync: null };
  }
}

/**
 * Check if sync is needed for an entity
 */
export async function needsSync(entityType: string, entityKey: string = "all"): Promise<boolean> {
  try {
    const syncLog = await db.query.catalogSyncLog.findFirst({
      where: and(
        eq(catalogSyncLog.entityType, entityType),
        eq(catalogSyncLog.entityKey, entityKey)
      ),
    });
    
    if (!syncLog) return true;
    
    const age = Date.now() - syncLog.syncedAt.getTime();
    return age > SYNC_INTERVAL_MS;
  } catch {
    return true;
  }
}

/**
 * Check if catalog has data for a make
 */
export async function hasMake(makeSlug: string): Promise<boolean> {
  const models = await getModels(makeSlug);
  return models.length > 0;
}

/**
 * Clear all catalog data (for testing/reset)
 */
export async function clearCatalog(): Promise<void> {
  await db.delete(catalogModels);
  await db.delete(catalogMakes);
  await db.delete(catalogSyncLog);
  console.log("[catalog-store] Catalog cleared");
}
