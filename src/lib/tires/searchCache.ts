/**
 * Tire Search Result Cache
 * 
 * Caches complete search results (after merge/enrichment) at the size level.
 * This dramatically reduces TireWeb calls during normal traffic.
 * 
 * Features:
 * - 12-hour TTL (configurable)
 * - Stale-while-revalidate (serve stale, refresh in background)
 * - Single-flight deduping (one supplier call per size, even under burst)
 * - Works alongside TireWeb protection layer (defense in depth)
 * 
 * Cache Keys:
 * - Size search: "tiresearch:size:{simpleSize}"
 * - Vehicle search: "tiresearch:vehicle:{sizesHash}"
 */

import { Redis } from "@upstash/redis";

// ============================================================================
// TYPES
// ============================================================================

export interface TireSearchCacheEntry<T> {
  data: T;
  cachedAt: number;      // Unix timestamp (ms)
  expiresAt: number;     // Hard expiry
  staleAt: number;       // Soft expiry (serve stale, refresh in background)
  sources: {             // For debugging/monitoring
    wheelpros: number;
    tireweb: number;
    km: number;
  };
}

export interface CachedTireSearchResult {
  results: any[];
  sources: { wheelpros: number; tireweb: number; km: number };
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Cache TTLs - tire inventory is relatively stable
  CACHE_TTL_MS: 12 * 60 * 60 * 1000,      // 12 hours hard expiry
  STALE_TTL_MS: 6 * 60 * 60 * 1000,       // 6 hours before considered stale
  
  // Single-flight
  IN_FLIGHT_TTL_MS: 60 * 1000,            // Max wait for in-flight request (60s)
  
  // Keys
  CACHE_PREFIX: "tiresearch:",
};

// ============================================================================
// REDIS CLIENT
// ============================================================================

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  
  // Support both Vercel KV naming and Upstash direct naming
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    console.warn("[tire-search-cache] Redis not configured, cache disabled");
    return null;
  }
  
  _redis = new Redis({ url, token });
  return _redis;
}

// ============================================================================
// CACHE OPERATIONS
// ============================================================================

/**
 * Build cache key for size-based search
 */
export function buildSizeCacheKey(size: string): string {
  // Normalize to simple format (2256517)
  const simple = toSimpleSize(size) || size;
  return `${CONFIG.CACHE_PREFIX}size:${simple}`;
}

/**
 * Build cache key for vehicle-based search (multiple sizes)
 */
export function buildVehicleCacheKey(sizes: string[], wheelDiameter?: number): string {
  const sorted = sizes.map(s => toSimpleSize(s) || s).sort();
  const sizesHash = sorted.join("-");
  const diameter = wheelDiameter ? `-d${wheelDiameter}` : "";
  return `${CONFIG.CACHE_PREFIX}vehicle:${sizesHash}${diameter}`;
}

function toSimpleSize(s: string): string {
  const v = String(s || "").trim().toUpperCase();
  const m = v.match(/(\d{3})\s*\/\s*(\d{2})\s*[A-Z]*\s*R?\s*(\d{2})/i);
  if (m) return `${m[1]}${m[2]}${m[3]}`;
  const m2 = v.match(/^(\d{7})$/);
  if (m2) return m2[1];
  return "";
}

/**
 * Get cached search results
 * Returns { data, isStale } or null if no cache
 */
export async function getCachedSearch<T>(key: string): Promise<{ data: T; isStale: boolean; sources: any } | null> {
  const redis = getRedis();
  if (!redis) return null;
  
  try {
    const entry = await redis.get<TireSearchCacheEntry<T>>(key);
    
    if (!entry) return null;
    
    const now = Date.now();
    
    // Hard expired - don't use
    if (now > entry.expiresAt) {
      return null;
    }
    
    // Stale but usable
    const isStale = now > entry.staleAt;
    return { data: entry.data, isStale, sources: entry.sources };
  } catch (err) {
    console.error("[tire-search-cache] Cache read error:", err);
    return null;
  }
}

/**
 * Store search results in cache
 */
export async function setCachedSearch<T>(
  key: string, 
  data: T, 
  sources: { wheelpros: number; tireweb: number; km: number }
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  
  try {
    const now = Date.now();
    const entry: TireSearchCacheEntry<T> = {
      data,
      cachedAt: now,
      staleAt: now + CONFIG.STALE_TTL_MS,
      expiresAt: now + CONFIG.CACHE_TTL_MS,
      sources,
    };
    
    // Set with TTL slightly longer than expiresAt for safety
    const ttlSeconds = Math.ceil(CONFIG.CACHE_TTL_MS / 1000) + 300; // +5 min buffer
    await redis.set(key, entry, { ex: ttlSeconds });
    
    console.log(`[tire-search-cache] Cached ${key}: ${sources.wheelpros} WP + ${sources.tireweb} TW results`);
  } catch (err) {
    console.error("[tire-search-cache] Cache write error:", err);
  }
}

// ============================================================================
// SINGLE-FLIGHT DEDUPING
// ============================================================================

// In-memory map of in-flight searches (for single process)
const inFlightSearches = new Map<string, Promise<any>>();

/**
 * Execute a search with single-flight deduping
 * If the same key is already being searched, wait for that result
 */
export async function singleFlightSearch<T>(
  key: string,
  searchFn: () => Promise<T>
): Promise<T> {
  // Check if already in-flight locally
  const existing = inFlightSearches.get(key);
  if (existing) {
    console.log(`[tire-search-cache] Single-flight: deduping ${key}`);
    return existing as Promise<T>;
  }
  
  // Execute and track
  const promise = searchFn().finally(() => {
    inFlightSearches.delete(key);
  });
  
  inFlightSearches.set(key, promise);
  return promise;
}

// ============================================================================
// STALE-WHILE-REVALIDATE
// ============================================================================

// Track background revalidations to avoid duplicates
const revalidating = new Set<string>();

/**
 * Trigger background revalidation (non-blocking)
 */
export function triggerSearchRevalidation<T>(
  key: string,
  searchFn: () => Promise<{ results: T; sources: { wheelpros: number; tireweb: number; km: number } }>
): void {
  if (revalidating.has(key)) {
    return; // Already revalidating
  }
  
  revalidating.add(key);
  
  // Fire and forget
  (async () => {
    try {
      console.log(`[tire-search-cache] Background revalidation for ${key}`);
      const { results, sources } = await searchFn();
      await setCachedSearch(key, results, sources);
    } catch (err) {
      console.error(`[tire-search-cache] Revalidation failed for ${key}:`, err);
    } finally {
      revalidating.delete(key);
    }
  })();
}

// ============================================================================
// MAIN CACHED SEARCH FUNCTION
// ============================================================================

export interface CachedSearchOptions<T> {
  /** Cache key for this search */
  cacheKey: string;
  
  /** The actual search function (queries suppliers, merges, enriches) */
  searchFn: () => Promise<{ results: T[]; sources: { wheelpros: number; tireweb: number; km: number } }>;
}

export interface CachedSearchResult<T> {
  results: T[];
  source: "cache" | "api";
  stale: boolean;
  sources: { wheelpros: number; tireweb: number; km: number };
}

/**
 * Execute tire search with caching and single-flight deduping
 * 
 * Flow:
 * 1. Check cache → return immediately if fresh
 * 2. If stale → return stale + trigger background refresh
 * 3. If miss → single-flight search + cache result
 */
export async function cachedTireSearch<T>(
  options: CachedSearchOptions<T>
): Promise<CachedSearchResult<T>> {
  const { cacheKey, searchFn } = options;
  
  // Step 1: Check cache
  const cached = await getCachedSearch<T[]>(cacheKey);
  
  if (cached) {
    // Fresh cache - return immediately
    if (!cached.isStale) {
      console.log(`[tire-search-cache] Cache HIT (fresh): ${cacheKey}`);
      return { 
        results: cached.data, 
        source: "cache", 
        stale: false,
        sources: cached.sources 
      };
    }
    
    // Stale cache - return but trigger revalidation
    console.log(`[tire-search-cache] Cache HIT (stale): ${cacheKey}`);
    triggerSearchRevalidation(cacheKey, searchFn);
    
    return { 
      results: cached.data, 
      source: "cache", 
      stale: true,
      sources: cached.sources 
    };
  }
  
  // Step 2: Cache miss - execute with single-flight deduping
  console.log(`[tire-search-cache] Cache MISS: ${cacheKey}`);
  
  const { results, sources } = await singleFlightSearch(cacheKey, searchFn);
  
  // Step 3: Cache the results (only if we got some)
  if (results.length > 0) {
    await setCachedSearch(cacheKey, results, sources);
  }
  
  return { 
    results, 
    source: "api",
    stale: false,
    sources 
  };
}

// ============================================================================
// DIAGNOSTICS
// ============================================================================

export function getSearchCacheDiagnostics(): {
  inFlightCount: number;
  revalidatingCount: number;
  redisConnected: boolean;
} {
  return {
    inFlightCount: inFlightSearches.size,
    revalidatingCount: revalidating.size,
    redisConnected: getRedis() !== null,
  };
}

/**
 * Clear cache for a specific size (for admin/testing)
 */
export async function clearSizeCache(size: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  
  try {
    const key = buildSizeCacheKey(size);
    await redis.del(key);
    console.log(`[tire-search-cache] Cleared cache for ${key}`);
    return true;
  } catch (err) {
    console.error("[tire-search-cache] Clear cache error:", err);
    return false;
  }
}
