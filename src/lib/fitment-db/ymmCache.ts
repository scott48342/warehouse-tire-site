/**
 * YMM Selector Cache
 * 
 * Caches year/make/model/trim selector data to reduce DB load.
 * Uses Upstash Redis with local fallback.
 * 
 * Cache keys:
 * - wt:ymm:makes:{year} - Makes for a year
 * - wt:ymm:models:{year}:{make} - Models for year+make
 * - wt:ymm:years:{make}:{model} - Years for make+model
 * - wt:ymm:trims:{year}:{make}:{model} - Trims for YMM
 * 
 * TTL: 1 hour (YMM data is very stable)
 */

import { Redis } from "@upstash/redis";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type CachedYMMData<T> = {
  data: T;
  cachedAt: string;
  source: "redis" | "local" | "fallback";
};

export type TrimEntry = {
  modificationId: string;
  displayTrim: string;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  KEY_PREFIX: "wt:ymm:",
  TTL_SECONDS: 60 * 60,  // 1 hour
  LOCAL_MAX_SIZE: 500,
  TIMEOUT_MS: 300,
};

// ═══════════════════════════════════════════════════════════════════════════════
// REDIS CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

let redis: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redis) return redis;
  
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) return null;
  
  try {
    redis = new Redis({ url, token });
    return redis;
  } catch (e) {
    console.error("[ymmCache] Failed to initialize Redis:", e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL FALLBACK CACHE
// ═══════════════════════════════════════════════════════════════════════════════

const localCache = new Map<string, { data: any; expiresAt: number }>();

function getLocal<T>(key: string): T | null {
  const entry = localCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    localCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setLocal<T>(key: string, data: T, ttlSeconds: number): void {
  // LRU eviction
  if (localCache.size >= CONFIG.LOCAL_MAX_SIZE) {
    const firstKey = localCache.keys().next().value;
    if (firstKey) localCache.delete(firstKey);
  }
  localCache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════════════════════

const stats = {
  hits: 0,
  misses: 0,
  redisHits: 0,
  localHits: 0,
  writes: 0,
  errors: 0,
};

export function getYMMCacheStats() {
  const total = stats.hits + stats.misses;
  return {
    ...stats,
    hitRate: total > 0 ? (stats.hits / total * 100).toFixed(1) + "%" : "0%",
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE KEYS
// ═══════════════════════════════════════════════════════════════════════════════

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, "-");
}

export function makesKey(year?: number): string {
  return year ? `${CONFIG.KEY_PREFIX}makes:${year}` : `${CONFIG.KEY_PREFIX}makes:all`;
}

export function modelsKey(make: string, year?: number): string {
  const m = normalize(make);
  return year ? `${CONFIG.KEY_PREFIX}models:${year}:${m}` : `${CONFIG.KEY_PREFIX}models:all:${m}`;
}

export function yearsKey(make: string, model: string): string {
  return `${CONFIG.KEY_PREFIX}years:${normalize(make)}:${normalize(model)}`;
}

export function trimsKey(year: number, make: string, model: string): string {
  return `${CONFIG.KEY_PREFIX}trims:${year}:${normalize(make)}:${normalize(model)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERIC GET/SET
// ═══════════════════════════════════════════════════════════════════════════════

async function cacheGet<T>(key: string): Promise<CachedYMMData<T> | null> {
  // Try local first (fastest)
  const local = getLocal<T>(key);
  if (local !== null) {
    stats.hits++;
    stats.localHits++;
    return { data: local, cachedAt: new Date().toISOString(), source: "local" };
  }
  
  // Try Redis
  const client = getRedisClient();
  if (client) {
    try {
      const data = await Promise.race([
        client.get<T>(key),
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error("timeout")), CONFIG.TIMEOUT_MS)
        ),
      ]);
      
      if (data !== null) {
        stats.hits++;
        stats.redisHits++;
        // Also store locally for faster repeated access
        setLocal(key, data, CONFIG.TTL_SECONDS);
        return { data, cachedAt: new Date().toISOString(), source: "redis" };
      }
    } catch (e) {
      stats.errors++;
      // Fall through to miss
    }
  }
  
  stats.misses++;
  return null;
}

async function cacheSet<T>(key: string, data: T): Promise<void> {
  // Always set locally
  setLocal(key, data, CONFIG.TTL_SECONDS);
  
  // Try Redis (fire and forget)
  const client = getRedisClient();
  if (client) {
    try {
      await Promise.race([
        client.set(key, data, { ex: CONFIG.TTL_SECONDS }),
        new Promise<void>((_, reject) => 
          setTimeout(() => reject(new Error("timeout")), CONFIG.TIMEOUT_MS)
        ),
      ]);
      stats.writes++;
    } catch (e) {
      stats.errors++;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get cached makes list
 */
export async function getCachedMakes(year?: number): Promise<string[] | null> {
  const result = await cacheGet<string[]>(makesKey(year));
  return result?.data ?? null;
}

export async function setCachedMakes(makes: string[], year?: number): Promise<void> {
  await cacheSet(makesKey(year), makes);
}

/**
 * Get cached models list
 */
export async function getCachedModels(make: string, year?: number): Promise<string[] | null> {
  const result = await cacheGet<string[]>(modelsKey(make, year));
  return result?.data ?? null;
}

export async function setCachedModels(models: string[], make: string, year?: number): Promise<void> {
  await cacheSet(modelsKey(make, year), models);
}

/**
 * Get cached years list
 */
export async function getCachedYears(make: string, model: string): Promise<number[] | null> {
  const result = await cacheGet<number[]>(yearsKey(make, model));
  return result?.data ?? null;
}

export async function setCachedYears(years: number[], make: string, model: string): Promise<void> {
  await cacheSet(yearsKey(make, model), years);
}

/**
 * Get cached trims list
 */
export async function getCachedTrims(year: number, make: string, model: string): Promise<TrimEntry[] | null> {
  const result = await cacheGet<TrimEntry[]>(trimsKey(year, make, model));
  return result?.data ?? null;
}

export async function setCachedTrims(trims: TrimEntry[], year: number, make: string, model: string): Promise<void> {
  await cacheSet(trimsKey(year, make, model), trims);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FALLBACK STATIC DATA (for DB failures)
// ═══════════════════════════════════════════════════════════════════════════════

// Top 20 most popular makes (static fallback when DB is down)
export const FALLBACK_MAKES = [
  "Ford", "Chevrolet", "Toyota", "Honda", "Jeep", "Ram", "GMC", "Nissan",
  "Dodge", "BMW", "Mercedes-Benz", "Audi", "Lexus", "Subaru", "Hyundai",
  "Kia", "Volkswagen", "Mazda", "Cadillac", "Tesla"
].sort();

// Popular models by make (static fallback)
export const FALLBACK_MODELS: Record<string, string[]> = {
  ford: ["F-150", "F-250", "F-350", "Mustang", "Explorer", "Escape", "Bronco", "Ranger", "Edge", "Expedition"],
  chevrolet: ["Silverado 1500", "Silverado 2500HD", "Silverado 3500HD", "Camaro", "Corvette", "Tahoe", "Suburban", "Colorado", "Equinox", "Traverse"],
  toyota: ["Tacoma", "Tundra", "4Runner", "Camry", "Corolla", "RAV4", "Highlander", "Land Cruiser", "Supra", "86"],
  ram: ["1500", "2500", "3500", "TRX"],
  jeep: ["Wrangler", "Grand Cherokee", "Cherokee", "Gladiator", "Compass", "Renegade"],
  gmc: ["Sierra 1500", "Sierra 2500HD", "Sierra 3500HD", "Yukon", "Canyon", "Acadia"],
  dodge: ["Challenger", "Charger", "Durango"],
  honda: ["Civic", "Accord", "CR-V", "Pilot", "Ridgeline", "HR-V"],
  nissan: ["Frontier", "Titan", "Altima", "Maxima", "370Z", "Pathfinder"],
  bmw: ["3 Series", "5 Series", "M3", "M4", "X3", "X5", "X7"],
};

// Year range fallback (most common range)
export const FALLBACK_YEARS = Array.from({ length: 30 }, (_, i) => 2025 - i);

/**
 * Get fallback makes (when DB fails)
 */
export function getFallbackMakes(): string[] {
  return FALLBACK_MAKES;
}

/**
 * Get fallback models (when DB fails)
 */
export function getFallbackModels(make: string): string[] {
  return FALLBACK_MODELS[make.toLowerCase()] || [];
}

/**
 * Get fallback years (when DB fails)
 */
export function getFallbackYears(): number[] {
  return FALLBACK_YEARS;
}
