/**
 * Wheel-Size Catalog Store
 * 
 * Persistent storage for catalog data from Wheel-Size API.
 * ONLY stores data from catalog endpoints (makes, models, years, modifications).
 * Does NOT store search results.
 * 
 * Data structure:
 * - makes: { slug, name }[]
 * - models: Map<makeSlug, { slug, name, years: number[] }[]>
 * - modifications: Map<"year:make:model", { slug, name, ... }[]>
 */

import fs from "fs";
import path from "path";
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
  years: number[]; // Valid years for this model
}

export interface CatalogModification {
  slug: string;
  name: string;
  trim?: string;
  trimLevels?: string[];
  engine?: string;
  regions?: string[];
}

interface CatalogData {
  version: number;
  updatedAt: string;
  makes: CatalogMake[];
  models: Record<string, CatalogModel[]>; // keyed by makeSlug
  modifications: Record<string, CatalogModification[]>; // keyed by "year:makeSlug:modelSlug"
}

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE
// ─────────────────────────────────────────────────────────────────────────────

const CATALOG_VERSION = 1;
const CATALOG_DIR = path.join(process.cwd(), "data", "catalog");
const CATALOG_FILE = path.join(CATALOG_DIR, "wheel-size-catalog.json");

// In-memory cache (populated from disk on first access)
let catalogCache: CatalogData | null = null;

function ensureDir() {
  if (!fs.existsSync(CATALOG_DIR)) {
    fs.mkdirSync(CATALOG_DIR, { recursive: true });
  }
}

function loadCatalog(): CatalogData {
  if (catalogCache) return catalogCache;
  
  try {
    if (fs.existsSync(CATALOG_FILE)) {
      const raw = fs.readFileSync(CATALOG_FILE, "utf-8");
      catalogCache = JSON.parse(raw);
      console.log(`[catalog-store] Loaded catalog from disk (${catalogCache?.makes?.length || 0} makes)`);
      return catalogCache!;
    }
  } catch (err) {
    console.error("[catalog-store] Error loading catalog:", err);
  }
  
  // Return empty catalog
  catalogCache = {
    version: CATALOG_VERSION,
    updatedAt: new Date().toISOString(),
    makes: [],
    models: {},
    modifications: {},
  };
  return catalogCache;
}

function saveCatalog(data: CatalogData) {
  ensureDir();
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(CATALOG_FILE, JSON.stringify(data, null, 2));
  catalogCache = data;
  console.log(`[catalog-store] Saved catalog to disk`);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API - READ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all makes from catalog
 */
export function getMakes(): CatalogMake[] {
  const catalog = loadCatalog();
  return catalog.makes;
}

/**
 * Get models for a make from catalog
 */
export function getModels(makeSlug: string): CatalogModel[] {
  const catalog = loadCatalog();
  return catalog.models[makeSlug.toLowerCase()] || [];
}

/**
 * Get valid years for a make/model combination
 * Returns empty array if model not found
 */
export function getYears(makeSlug: string, modelSlug: string): number[] {
  const models = getModels(makeSlug);
  const model = models.find(m => m.slug.toLowerCase() === modelSlug.toLowerCase());
  return model?.years || [];
}

/**
 * Check if a year is valid for a make/model
 */
export function isValidYear(makeSlug: string, modelSlug: string, year: number): boolean {
  const years = getYears(makeSlug, modelSlug);
  return years.includes(year);
}

/**
 * Get modifications for a year/make/model
 */
export function getModifications(year: number, makeSlug: string, modelSlug: string): CatalogModification[] {
  const catalog = loadCatalog();
  const key = `${year}:${makeSlug.toLowerCase()}:${modelSlug.toLowerCase()}`;
  return catalog.modifications[key] || [];
}

/**
 * Find a model by name (fuzzy match)
 */
export function findModel(makeSlug: string, modelName: string): CatalogModel | null {
  const models = getModels(makeSlug);
  const needle = modelName.toLowerCase().replace(/[^a-z0-9]/g, "");
  
  return models.find(m => {
    const slug = m.slug.toLowerCase().replace(/[^a-z0-9]/g, "");
    const name = m.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    return slug === needle || name === needle || slug.includes(needle) || name.includes(needle);
  }) || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API - POPULATE (from Wheel-Size API)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch and store all makes from Wheel-Size API
 */
export async function populateMakes(): Promise<number> {
  console.log("[catalog-store] Populating makes from API...");
  const apiMakes = await wheelSizeApi.getMakes();
  
  const catalog = loadCatalog();
  catalog.makes = apiMakes.map(m => ({
    slug: m.slug,
    name: m.name,
  }));
  
  saveCatalog(catalog);
  console.log(`[catalog-store] Stored ${catalog.makes.length} makes`);
  return catalog.makes.length;
}

/**
 * Fetch and store models for a make, including valid years
 */
export async function populateModels(makeSlug: string): Promise<number> {
  console.log(`[catalog-store] Populating models for ${makeSlug}...`);
  const apiModels = await wheelSizeApi.getModels(makeSlug);
  
  const catalog = loadCatalog();
  const modelsWithYears: CatalogModel[] = [];
  
  for (const m of apiModels) {
    // Fetch valid years for each model
    try {
      const years = await wheelSizeApi.getYears(makeSlug, m.slug);
      modelsWithYears.push({
        slug: m.slug,
        name: m.name,
        years: years.sort((a, b) => b - a), // descending
      });
    } catch (err) {
      console.warn(`[catalog-store] Failed to get years for ${makeSlug}/${m.slug}:`, err);
      modelsWithYears.push({
        slug: m.slug,
        name: m.name,
        years: [],
      });
    }
  }
  
  catalog.models[makeSlug.toLowerCase()] = modelsWithYears;
  saveCatalog(catalog);
  console.log(`[catalog-store] Stored ${modelsWithYears.length} models for ${makeSlug}`);
  return modelsWithYears.length;
}

/**
 * Fetch and store modifications for a specific year/make/model
 */
export async function populateModifications(
  year: number,
  makeSlug: string,
  modelSlug: string
): Promise<number> {
  console.log(`[catalog-store] Populating modifications for ${year} ${makeSlug} ${modelSlug}...`);
  
  const apiMods = await wheelSizeApi.getModifications(makeSlug, modelSlug, year);
  
  const catalog = loadCatalog();
  const key = `${year}:${makeSlug.toLowerCase()}:${modelSlug.toLowerCase()}`;
  
  catalog.modifications[key] = apiMods.map(m => ({
    slug: m.slug,
    name: m.name,
    trim: m.trim,
    trimLevels: m.trim_levels,
    engine: m.engine?.capacity,
    regions: m.regions,
  }));
  
  saveCatalog(catalog);
  console.log(`[catalog-store] Stored ${apiMods.length} modifications for ${key}`);
  return apiMods.length;
}

/**
 * Populate common US makes and their models with years
 * This is the main initialization function
 */
export async function populateCommonMakes(): Promise<{ makes: number; models: number }> {
  // Focus on US market makes
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
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      console.error(`[catalog-store] Failed to populate ${makeSlug}:`, err);
    }
  }
  
  const catalog = loadCatalog();
  return { makes: catalog.makes.length, models: totalModels };
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get catalog stats
 */
export function getStats(): {
  makes: number;
  models: number;
  modifications: number;
  updatedAt: string;
} {
  const catalog = loadCatalog();
  return {
    makes: catalog.makes.length,
    models: Object.values(catalog.models).reduce((sum, arr) => sum + arr.length, 0),
    modifications: Object.keys(catalog.modifications).length,
    updatedAt: catalog.updatedAt,
  };
}

/**
 * Clear the catalog (for testing/reset)
 */
export function clearCatalog() {
  catalogCache = null;
  if (fs.existsSync(CATALOG_FILE)) {
    fs.unlinkSync(CATALOG_FILE);
  }
  console.log("[catalog-store] Catalog cleared");
}

/**
 * Check if catalog has data for a make
 */
export function hasMake(makeSlug: string): boolean {
  const models = getModels(makeSlug);
  return models.length > 0;
}

/**
 * Invalidate in-memory cache (force reload from disk)
 */
export function invalidateCache() {
  catalogCache = null;
}
