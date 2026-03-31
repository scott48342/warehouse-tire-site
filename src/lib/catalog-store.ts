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

// ============================================================================
// WHEEL-SIZE API REMOVED (Phase A - DB-First Architecture)
// Populate functions are blocked. Use bulk-import scripts for data seeding.
// ============================================================================

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
 * DISABLED: Wheel-Size API is forbidden (Phase A - DB-first architecture)
 * Use bulk-import scripts for catalog population.
 */
export async function populateMakes(): Promise<number> {
  console.error("[catalog-store] populateMakes DISABLED - Wheel-Size API is forbidden (DB-first architecture)");
  throw new Error("Wheel-Size API is FORBIDDEN. Use bulk-import scripts for catalog population.");
}

/**
 * DISABLED: Wheel-Size API is forbidden (Phase A - DB-first architecture)
 * Use bulk-import scripts for catalog population.
 */
export async function populateModels(_makeSlug: string): Promise<number> {
  console.error("[catalog-store] populateModels DISABLED - Wheel-Size API is forbidden (DB-first architecture)");
  throw new Error("Wheel-Size API is FORBIDDEN. Use bulk-import scripts for catalog population.");
}

/**
 * DISABLED: Wheel-Size API is forbidden (Phase A - DB-first architecture)
 */
export async function populateCommonMakes(): Promise<{ makes: number; models: number }> {
  console.error("[catalog-store] populateCommonMakes DISABLED - Wheel-Size API is forbidden");
  throw new Error("Wheel-Size API is FORBIDDEN. Use bulk-import scripts for catalog population.");
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
 * Get all makes that have models available for a specific year.
 * Queries catalog_models where the year is in the years[] array.
 */
export async function getMakesByYear(year: number): Promise<CatalogMake[]> {
  try {
    // Query catalog_models where year is in the years array
    // Then get distinct make_slugs and join with catalog_makes for names
    const results = await db.execute(sql`
      SELECT DISTINCT cm.make_slug, 
             COALESCE(mk.name, INITCAP(REPLACE(cm.make_slug, '-', ' '))) as name
      FROM catalog_models cm
      LEFT JOIN catalog_makes mk ON mk.slug = cm.make_slug
      WHERE ${year} = ANY(cm.years)
      ORDER BY name
    `);
    
    const makes: CatalogMake[] = (results.rows as any[]).map(row => ({
      slug: row.make_slug,
      name: row.name,
    }));
    
    console.log(`[catalog-store] getMakesByYear(${year}): ${makes.length} makes from catalog`);
    return makes;
  } catch (err) {
    console.error(`[catalog-store] Error getting makes for year ${year}:`, err);
    return [];
  }
}

/**
 * Get all models for a make that are available for a specific year.
 * Filters catalog_models by make_slug and year in years[] array.
 */
export async function getModelsByYear(makeSlug: string, year: number): Promise<CatalogModel[]> {
  const normalizedMake = makeSlug.toLowerCase();
  
  try {
    const results = await db.execute(sql`
      SELECT slug, name, years
      FROM catalog_models
      WHERE make_slug = ${normalizedMake}
        AND ${year} = ANY(years)
      ORDER BY name
    `);
    
    const models: CatalogModel[] = (results.rows as any[]).map(row => ({
      slug: row.slug,
      name: row.name,
      years: row.years || [],
    }));
    
    console.log(`[catalog-store] getModelsByYear(${normalizedMake}, ${year}): ${models.length} models`);
    return models;
  } catch (err) {
    console.error(`[catalog-store] Error getting models for ${makeSlug}/${year}:`, err);
    return [];
  }
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

/**
 * Get makes from vehicle_fitments table (locally imported data) for a specific year.
 * This supplements catalog data with any manually imported fitment.
 */
export async function getFitmentMakesByYear(year: number): Promise<string[]> {
  try {
    const results = await db.execute(sql`
      SELECT DISTINCT make
      FROM vehicle_fitments
      WHERE year = ${year}
      ORDER BY make
    `);
    
    const makes = (results.rows as any[]).map(row => row.make);
    console.log(`[catalog-store] getFitmentMakesByYear(${year}): ${makes.length} makes from fitments`);
    return makes;
  } catch (err) {
    console.error(`[catalog-store] Error getting fitment makes for year ${year}:`, err);
    return [];
  }
}

/**
 * Get models from vehicle_fitments table for a specific year/make.
 */
export async function getFitmentModelsByYear(year: number, makeSlug: string): Promise<string[]> {
  try {
    const results = await db.execute(sql`
      SELECT DISTINCT model
      FROM vehicle_fitments
      WHERE year = ${year} AND make = ${makeSlug.toLowerCase()}
      ORDER BY model
    `);
    
    const models = (results.rows as any[]).map(row => row.model);
    console.log(`[catalog-store] getFitmentModelsByYear(${year}, ${makeSlug}): ${models.length} models from fitments`);
    return models;
  } catch (err) {
    console.error(`[catalog-store] Error getting fitment models for ${year}/${makeSlug}:`, err);
    return [];
  }
}
