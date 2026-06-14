/**
 * Fitment Cache
 * 
 * Caches vehicle fitment lookups for 24 hours to reduce API calls and latency.
 * Uses Upstash Redis when available, falls back to in-memory cache.
 * 
 * Only caches SUCCESSFUL responses:
 * - Has tire sizes or wheel fitment data
 * - No errors
 * - No "trim required" responses
 * 
 * @created 2026-06-14
 */

import { Redis } from "@upstash/redis";

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const CACHE_PREFIX = "jake:fitment:";

// In-memory fallback cache
const memoryCache = new Map<string, { data: any; expiresAt: number }>();

// Initialize Redis client (may be undefined if not configured)
let redis: Redis | null = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch (err) {
  console.warn("[FitmentCache] Failed to initialize Redis:", err);
}

/**
 * Generate cache key for fitment lookup
 */
function generateKey(year: number, make: string, model: string, trim?: string): string {
  const normalizedMake = make.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedModel = model.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedTrim = trim ? trim.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  
  return `${CACHE_PREFIX}${year}:${normalizedMake}:${normalizedModel}:${normalizedTrim}`;
}

/**
 * Check if response should be cached
 */
function isCacheable(data: any): boolean {
  if (!data) return false;
  if (data.error) return false;
  if (data.trimRequired) return false;
  
  // Must have some useful data
  const hasTireSizes = data.tireSizes?.length > 0;
  const hasBoltPattern = !!data.boltPattern;
  const hasWheelDiameters = data.wheelDiameters?.length > 0;
  const hasFitment = data.fitment?.boltPattern;
  
  return hasTireSizes || hasBoltPattern || hasWheelDiameters || hasFitment;
}

/**
 * Get from cache
 */
async function get(key: string): Promise<any | null> {
  try {
    // Try Redis first
    if (redis) {
      const data = await redis.get(key);
      if (data) {
        console.log(`[FitmentCache] Redis HIT: ${key}`);
        return data;
      }
    }
    
    // Fall back to memory cache
    const memEntry = memoryCache.get(key);
    if (memEntry && memEntry.expiresAt > Date.now()) {
      console.log(`[FitmentCache] Memory HIT: ${key}`);
      return memEntry.data;
    }
    
    // Clean up expired memory entry
    if (memEntry) {
      memoryCache.delete(key);
    }
    
    return null;
  } catch (err) {
    console.warn(`[FitmentCache] Get error:`, err);
    return null;
  }
}

/**
 * Set in cache
 */
async function set(key: string, data: any): Promise<void> {
  if (!isCacheable(data)) {
    console.log(`[FitmentCache] Not caching (not cacheable): ${key}`);
    return;
  }
  
  try {
    // Try Redis first
    if (redis) {
      await redis.setex(key, CACHE_TTL_SECONDS, data);
      console.log(`[FitmentCache] Redis SET: ${key} (TTL: ${CACHE_TTL_SECONDS}s)`);
    }
    
    // Also set in memory cache as backup
    memoryCache.set(key, {
      data,
      expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
    });
    
    // Limit memory cache size
    if (memoryCache.size > 1000) {
      // Delete oldest entries
      const entries = Array.from(memoryCache.entries());
      entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);
      for (let i = 0; i < 200; i++) {
        memoryCache.delete(entries[i][0]);
      }
    }
  } catch (err) {
    console.warn(`[FitmentCache] Set error:`, err);
  }
}

/**
 * Invalidate cache entry
 */
async function invalidate(key: string): Promise<void> {
  try {
    if (redis) {
      await redis.del(key);
    }
    memoryCache.delete(key);
  } catch (err) {
    console.warn(`[FitmentCache] Invalidate error:`, err);
  }
}

/**
 * Get cache stats (for debugging)
 */
function stats(): { memorySize: number; redisAvailable: boolean } {
  return {
    memorySize: memoryCache.size,
    redisAvailable: !!redis,
  };
}

export const fitmentCache = {
  key: generateKey,
  get,
  set,
  invalidate,
  stats,
  isCacheable,
};
