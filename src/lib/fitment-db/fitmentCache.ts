/**
 * Fitment Profile Cache
 * 
 * Uses Upstash Redis for cross-instance cache sharing in Vercel serverless.
 * Caches fitment profile lookups to avoid repeated DB queries.
 * 
 * Cache key format: "wt:fit:${year}:${make}:${model}:${modificationId}"
 * TTL: 15 minutes (fitment data changes less frequently than availability)
 */

import { Redis } from "@upstash/redis";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type CachedFitmentProfile = {
  boltPattern: string | null;
  centerBoreMm: string | null;
  threadSize: string | null;
  seatType: string | null;
  offsetMinMm: string | null;
  offsetMaxMm: string | null;
  oemWheelSizes: any[] | null;
  displayTrim: string | null;
  source: string;
  cachedAt: string;
};

export type FitmentCacheStats = {
  hits: number;
  misses: number;
  hitRate: number;
  writes: number;
  errors: number;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  KEY_PREFIX: "wt:fit:",
  TTL_SECONDS: 15 * 60,  // 15 minutes
  LOCAL_MAX_SIZE: 2_000,
  TIMEOUT_MS: 500,
};

// ═══════════════════════════════════════════════════════════════════════════════
// REDIS CLIENT (reuses same Upstash instance)
// ═══════════════════════════════════════════════════════════════════════════════

let redis: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redis) return redis;
  
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    return null;
  }
  
  try {
    redis = new Redis({ url, token });
    return redis;
  } catch (e) {
    console.error("[fitmentCache] Failed to initialize Redis:", e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL FALLBACK CACHE
// ═══════════════════════════════════════════════════════════════════════════════

const localCache = new Map<string, { data: CachedFitmentProfile; expiresAt: number }>();

function cleanLocalCache() {
  const now = Date.now();
  for (const [key, value] of localCache.entries()) {
    if (value.expiresAt < now) {
      localCache.delete(key);
    }
  }
  // Limit size
  if (localCache.size > CONFIG.LOCAL_MAX_SIZE) {
    const entries = Array.from(localCache.entries());
    entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    const toRemove = entries.slice(0, localCache.size - CONFIG.LOCAL_MAX_SIZE + 100);
    toRemove.forEach(([key]) => localCache.delete(key));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════════════════════

let stats: FitmentCacheStats = {
  hits: 0,
  misses: 0,
  hitRate: 0,
  writes: 0,
  errors: 0,
};

export function getFitmentCacheStats(): FitmentCacheStats {
  const total = stats.hits + stats.misses;
  return {
    ...stats,
    hitRate: total > 0 ? stats.hits / total : 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE KEY GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

export function makeFitmentCacheKey(
  year: number,
  make: string,
  model: string,
  modificationId: string
): string {
  // Normalize for consistent cache hits
  const normalizedMake = make.toLowerCase().trim();
  const normalizedModel = model.toLowerCase().trim().replace(/\s+/g, "-");
  return `${CONFIG.KEY_PREFIX}${year}:${normalizedMake}:${normalizedModel}:${modificationId}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get cached fitment profile.
 * Tries Redis first, falls back to local cache.
 */
export async function getCachedFitment(
  year: number,
  make: string,
  model: string,
  modificationId: string
): Promise<CachedFitmentProfile | null> {
  const key = makeFitmentCacheKey(year, make, model, modificationId);
  
  // Try Redis first
  const client = getRedisClient();
  if (client) {
    try {
      const cached = await Promise.race([
        client.get<CachedFitmentProfile>(key),
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error("timeout")), CONFIG.TIMEOUT_MS)
        ),
      ]);
      
      if (cached) {
        stats.hits++;
        return cached;
      }
    } catch (e) {
      // Redis failed, try local
      stats.errors++;
    }
  }
  
  // Try local cache
  cleanLocalCache();
  const local = localCache.get(key);
  if (local && local.expiresAt > Date.now()) {
    stats.hits++;
    return local.data;
  }
  
  stats.misses++;
  return null;
}

/**
 * Cache a fitment profile.
 * Writes to both Redis (if available) and local cache.
 */
export async function setCachedFitment(
  year: number,
  make: string,
  model: string,
  modificationId: string,
  profile: Omit<CachedFitmentProfile, "cachedAt">
): Promise<void> {
  const key = makeFitmentCacheKey(year, make, model, modificationId);
  const entry: CachedFitmentProfile = {
    ...profile,
    cachedAt: new Date().toISOString(),
  };
  
  // Write to local cache
  localCache.set(key, {
    data: entry,
    expiresAt: Date.now() + CONFIG.TTL_SECONDS * 1000,
  });
  
  // Write to Redis (fire and forget)
  const client = getRedisClient();
  if (client) {
    try {
      await Promise.race([
        client.set(key, entry, { ex: CONFIG.TTL_SECONDS }),
        new Promise<void>((_, reject) => 
          setTimeout(() => reject(new Error("timeout")), CONFIG.TIMEOUT_MS)
        ),
      ]);
      stats.writes++;
    } catch (e) {
      stats.errors++;
      // Local cache still has it, so not a total failure
    }
  }
}

/**
 * Invalidate cached fitment for a vehicle.
 * Use when fitment data is updated via admin tools.
 */
export async function invalidateFitmentCache(
  year: number,
  make: string,
  model: string,
  modificationId?: string
): Promise<void> {
  // If modificationId provided, delete specific key
  if (modificationId) {
    const key = makeFitmentCacheKey(year, make, model, modificationId);
    localCache.delete(key);
    
    const client = getRedisClient();
    if (client) {
      try {
        await client.del(key);
      } catch (e) {
        // Best effort
      }
    }
    return;
  }
  
  // Otherwise, scan and delete all keys for this YMM
  // (More expensive, use sparingly)
  const pattern = makeFitmentCacheKey(year, make, model, "*").replace("*", "");
  
  // Clear matching local cache entries
  for (const key of localCache.keys()) {
    if (key.startsWith(pattern)) {
      localCache.delete(key);
    }
  }
  
  // For Redis, we'd need SCAN which is expensive - skip for now
  // Admin operations are rare enough that TTL expiration is acceptable
}
