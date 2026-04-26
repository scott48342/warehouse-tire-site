/**
 * Catalog Store (PostgreSQL, DB-Only)
 * 
 * Persistent storage for catalog data.
 * No external API calls - data must be imported via admin tools.
 * 
 * Database tables:
 * - catalog_makes: { slug, name }
 * - catalog_models: { make_slug, slug, name, years[] }
 * - catalog_sync_log: Track sync timestamps
 */

import { db } from "./fitment-db/db";
import { catalogMakes, catalogModels, catalogSyncLog } from "./fitment-db/schema";
import { eq, and, ilike, sql, asc, desc } from "drizzle-orm";

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

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API - READ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all makes from catalog (DB only)
 */
export async function getMakes(): Promise<CatalogMake[]> {
  try {
    const dbMakes = await db
      .select()
      .from(catalogMakes)
      .orderBy(asc(catalogMakes.name));
    
    if (dbMakes.length > 0) {
      console.log(`[catalog-store] DB: ${dbMakes.length} makes`);
      return dbMakes.map(m => ({ slug: m.slug, name: m.name }));
    }
    
    console.log(`[catalog-store] No makes in catalog`);
    return [];
  } catch (err) {
    console.error("[catalog-store] Error getting makes:", err);
    return [];
  }
}

/**
 * Get models for a make from catalog (DB only)
 */
export async function getModels(makeSlug: string): Promise<CatalogModel[]> {
  const normalizedMake = makeSlug.toLowerCase();
  
  try {
    const dbModels = await db
      .select()
      .from(catalogModels)
      .where(eq(catalogModels.makeSlug, normalizedMake))
      .orderBy(asc(catalogModels.name));
    
    if (dbModels.length > 0) {
      console.log(`[catalog-store] DB: ${dbModels.length} models for ${makeSlug}`);
      return dbModels.map(m => ({ 
        slug: m.slug, 
        name: m.name, 
        years: (m.years || []) as number[] 
      }));
    }
    
    console.log(`[catalog-store] No models for ${makeSlug}`);
    return [];
  } catch (err) {
    console.error(`[catalog-store] Error getting models for ${makeSlug}:`, err);
    return [];
  }
}

/**
 * Get valid years for a make/model combination
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
    const [exactMatch] = await db
      .select()
      .from(catalogModels)
      .where(
        and(
          eq(catalogModels.makeSlug, normalizedMake),
          eq(catalogModels.slug, normalizedModel)
        )
      )
      .limit(1);
    
    if (exactMatch) {
      return { 
        slug: exactMatch.slug, 
        name: exactMatch.name, 
        years: (exactMatch.years || []) as number[] 
      };
    }
    
    // Try case-insensitive name match
    const [nameMatch] = await db
      .select()
      .from(catalogModels)
      .where(
        and(
          eq(catalogModels.makeSlug, normalizedMake),
          ilike(catalogModels.name, modelName)
        )
      )
      .limit(1);
    
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
    
    const [lastSync] = await db
      .select()
      .from(catalogSyncLog)
      .orderBy(desc(catalogSyncLog.syncedAt))
      .limit(1);
    
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
 * Check if catalog has data for a make
 */
export async function hasMake(makeSlug: string): Promise<boolean> {
  const models = await getModels(makeSlug);
  return models.length > 0;
}

/**
 * Get all makes that have models available for a specific year.
 */
export async function getMakesByYear(year: number): Promise<CatalogMake[]> {
  try {
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
 * Get makes from vehicle_fitments table for a specific year.
 * STRICT: Only returns certified records.
 */
export async function getFitmentMakesByYear(year: number): Promise<string[]> {
  try {
    const results = await db.execute(sql`
      SELECT DISTINCT make
      FROM vehicle_fitments
      WHERE year = ${year}
        AND certification_status = 'certified'
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
 * STRICT: Only returns certified records.
 */
export async function getFitmentModelsByYear(year: number, makeSlug: string): Promise<string[]> {
  try {
    const results = await db.execute(sql`
      SELECT DISTINCT model
      FROM vehicle_fitments
      WHERE year = ${year} 
        AND make = ${makeSlug.toLowerCase()}
        AND certification_status = 'certified'
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
