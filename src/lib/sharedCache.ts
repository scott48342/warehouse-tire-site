/**
 * Shared Cache for Wheel Availability
 * 
 * Uses Upstash Redis for cross-instance cache sharing in Vercel serverless.
 * Falls back to local in-memory cache if Redis is unavailable.
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * WHY SHARED CACHE?
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Vercel serverless runs multiple isolated instances. Each instance has its own
 * memory, so an in-memory cache only benefits requests hitting the SAME instance.
 * 
 * Production testing showed:
 * - Instance-local pre-warm hit rate: 0%
 * - Users almost never hit the pre-warmed instance
 * - Pre-warm effort was completely wasted
 * 
 * Shared cache (Redis) solves this:
 * - All instances read/write to the same cache
 * - Pre-warm benefits ALL user requests
 * - ~5-15ms latency overhead (acceptable for 30-min TTL items)
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 *   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
 *   │ Instance A  │   │ Instance B  │   │ Instance C  │
 *   │  (search)   │   │  (prewarm)  │   │  (search)   │
 *   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
 *          │                 │                 │
 *          └────────────┬────┴────────────────┘
 *                       │
 *                       ▼
 *              ┌─────────────────┐
 *              │  Upstash Redis  │
 *              │  (shared cache) │
 *              └─────────────────┘
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Redis } from "@upstash/redis";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type AvailabilityEntry = {
  ok: boolean;
  inventoryType: string;
  localQty: number;
  globalQty: number;
  checkedAt: string;
  prewarmed?: boolean;
};

export type SharedCacheStats = {
  enabled: boolean;
  healthy: boolean;
  lastHealthCheck: string | null;
  hits: number;
  misses: number;
  hitRate: number;
  prewarmedHits: number;
  writes: number;
  errors: number;
  fallbackHits: number;
  avgLatencyMs: number;
  lastPrewarmAt: string | null;
  lastPrewarmSkusWarmed: number | null;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  // Cache key prefix (namespace for wheel availability)
  KEY_PREFIX: "wt:avail:",
  
  // TTL: 30 minutes (matches original design)
  TTL_SECONDS: 30 * 60,
  
  // Fallback local cache max size
  LOCAL_MAX_SIZE: 5_000,
  
  // Health check interval (5 minutes)
  HEALTH_CHECK_INTERVAL_MS: 5 * 60 * 1000,
  
  // Redis operation timeout
  TIMEOUT_MS: 500,
};

// ═══════════════════════════════════════════════════════════════════════════════
// REDIS CLIENT INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

let redis: Redis | null = null;
let redisHealthy = false;
let lastHealthCheck: string | null = null;

/**
 * Initialize Redis client from environment variables.
 * Supports both naming conventions:
 * - UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (standard)
 * - KV_REST_API_URL / KV_REST_API_TOKEN (Vercel integration)
 * Returns null if credentials not configured.
 */
function getRedisClient(): Redis | null {
  if (redis) return redis;
  
  // Try both naming conventions (Vercel KV-style first, then standard Upstash)
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    console.log("[sharedCache] Upstash Redis not configured - using local fallback only");
    console.log("[sharedCache] Looking for KV_REST_API_URL or UPSTASH_REDIS_REST_URL");
    return null;
  }
  
  try {
    redis = new Redis({ url, token });
    console.log("[sharedCache] Upstash Redis client initialized");
    return redis;
  } catch (e) {
    console.error("[sharedCache] Failed to initialize Redis:", e);
    return null;
  }
}

/**
 * Check if Redis is healthy.
 */
async function checkRedisHealth(): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;
  
  try {
    const start = Date.now();
    await client.ping();
    const latency = Date.now() - start;
    
    redisHealthy = true;
    lastHealthCheck = new Date().toISOString();
    
    if (latency > 100) {
      console.warn(`[sharedCache] Redis latency high: ${latency}ms`);
    }
    
    return true;
  } catch (e) {
    console.error("[sharedCache] Redis health check failed:", e);
    redisHealthy = false;
    lastHealthCheck = new Date().toISOString();
    return false;
  }
}

// Initial health check on module load (non-blocking)
if (typeof process !== "undefined" && (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL)) {
  checkRedisHealth().catch(() => {});
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL FALLBACK CACHE (LRU)
// ═══════════════════════════════════════════════════════════════════════════════

type LocalCacheEntry = AvailabilityEntry & { expiresAt: number };
const localCache = new Map<string, LocalCacheEntry>();

function getLocalCache(key: string): AvailabilityEntry | null {
  const entry = localCache.get(key);
  if (!entry) return null;
  
  if (Date.now() > entry.expiresAt) {
    localCache.delete(key);
    return null;
  }
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { expiresAt, ...result } = entry;
  return result;
}

function setLocalCache(key: string, value: AvailabilityEntry, ttlSeconds: number): void {
  // LRU eviction
  if (localCache.size >= CONFIG.LOCAL_MAX_SIZE) {
    const firstKey = localCache.keys().next().value;
    if (firstKey) localCache.delete(firstKey);
  }
  
  localCache.set(key, {
    ...value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// METRICS
// ═══════════════════════════════════════════════════════════════════════════════

const metrics = {
  hits: 0,
  misses: 0,
  prewarmedHits: 0,
  writes: 0,
  errors: 0,
  fallbackHits: 0,
  totalLatencyMs: 0,
  latencyCount: 0,
  lastPrewarmAt: null as string | null,
  lastPrewarmSkusWarmed: null as number | null,
};

export function getSharedCacheStats(): SharedCacheStats {
  const total = metrics.hits + metrics.misses;
  return {
    enabled: !!getRedisClient(),
    healthy: redisHealthy,
    lastHealthCheck,
    hits: metrics.hits,
    misses: metrics.misses,
    hitRate: total > 0 ? metrics.hits / total : 0,
    prewarmedHits: metrics.prewarmedHits,
    writes: metrics.writes,
    errors: metrics.errors,
    fallbackHits: metrics.fallbackHits,
    avgLatencyMs: metrics.latencyCount > 0 
      ? Math.round(metrics.totalLatencyMs / metrics.latencyCount)
      : 0,
    lastPrewarmAt: metrics.lastPrewarmAt,
    lastPrewarmSkusWarmed: metrics.lastPrewarmSkusWarmed,
  };
}

export function resetSharedCacheMetrics(): void {
  metrics.hits = 0;
  metrics.misses = 0;
  metrics.prewarmedHits = 0;
  metrics.writes = 0;
  metrics.errors = 0;
  metrics.fallbackHits = 0;
  metrics.totalLatencyMs = 0;
  metrics.latencyCount = 0;
}

export function recordPrewarmStats(skusWarmed: number): void {
  metrics.lastPrewarmAt = new Date().toISOString();
  metrics.lastPrewarmSkusWarmed = skusWarmed;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE KEY GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate cache key for availability lookup.
 * Format: wt:avail:SKU:minQty=N
 */
export function makeAvailabilityKey(sku: string, minQty: number = 4): string {
  return `${CONFIG.KEY_PREFIX}${sku.trim()}:minQty=${minQty}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED CACHE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get availability from shared cache.
 * Falls back to local cache if Redis unavailable.
 */
export async function getAvailability(
  sku: string,
  minQty: number = 4
): Promise<(AvailabilityEntry & { fromCache: boolean; fromShared: boolean }) | null> {
  const key = makeAvailabilityKey(sku, minQty);
  const client = getRedisClient();
  
  // Try Redis first
  if (client && redisHealthy) {
    const start = Date.now();
    try {
      const data = await client.get<AvailabilityEntry>(key);
      const latency = Date.now() - start;
      metrics.totalLatencyMs += latency;
      metrics.latencyCount++;
      
      if (data) {
        metrics.hits++;
        if (data.prewarmed) metrics.prewarmedHits++;
        
        // Also store in local cache for ultra-fast repeated access
        setLocalCache(key, data, CONFIG.TTL_SECONDS);
        
        return { ...data, fromCache: true, fromShared: true };
      }
      
      metrics.misses++;
      return null;
    } catch (e) {
      metrics.errors++;
      console.warn("[sharedCache] Redis get failed, trying local:", e);
      // Fall through to local cache
    }
  }
  
  // Fallback to local cache
  const local = getLocalCache(key);
  if (local) {
    metrics.fallbackHits++;
    return { ...local, fromCache: true, fromShared: false };
  }
  
  metrics.misses++;
  return null;
}

/**
 * Bulk get availability from shared cache using MGET.
 * Much more efficient than individual GET calls - 1 round trip instead of N.
 * Falls back to individual lookups if MGET fails.
 */
export async function getAvailabilityBulk(
  skus: string[],
  minQty: number = 4
): Promise<Map<string, AvailabilityEntry & { fromCache: boolean; fromShared: boolean }>> {
  const results = new Map<string, AvailabilityEntry & { fromCache: boolean; fromShared: boolean }>();
  
  if (skus.length === 0) return results;
  
  const keys = skus.map(sku => makeAvailabilityKey(sku, minQty));
  const client = getRedisClient();
  
  // Try Redis MGET first
  if (client && redisHealthy) {
    const start = Date.now();
    try {
      const values = await client.mget<(AvailabilityEntry | null)[]>(...keys);
      const latency = Date.now() - start;
      metrics.totalLatencyMs += latency;
      metrics.latencyCount++;
      
      for (let i = 0; i < skus.length; i++) {
        const data = values[i];
        if (data) {
          metrics.hits++;
          if (data.prewarmed) metrics.prewarmedHits++;
          
          // Also store in local cache for ultra-fast repeated access
          setLocalCache(keys[i], data, CONFIG.TTL_SECONDS);
          
          results.set(skus[i], { ...data, fromCache: true, fromShared: true });
        } else {
          metrics.misses++;
        }
      }
      
      return results;
    } catch (e) {
      metrics.errors++;
      console.warn("[sharedCache] Redis MGET failed, trying local cache:", e);
      // Fall through to local cache
    }
  }
  
  // Fallback to local cache for each SKU
  for (let i = 0; i < skus.length; i++) {
    const local = getLocalCache(keys[i]);
    if (local) {
      metrics.fallbackHits++;
      results.set(skus[i], { ...local, fromCache: true, fromShared: false });
    } else {
      metrics.misses++;
    }
  }
  
  return results;
}

/**
 * Set availability in shared cache.
 * Also stores in local cache for redundancy.
 */
export async function setAvailability(
  sku: string,
  minQty: number,
  data: AvailabilityEntry,
  options?: { prewarmed?: boolean; ttlSeconds?: number }
): Promise<boolean> {
  const key = makeAvailabilityKey(sku, minQty);
  const ttl = options?.ttlSeconds ?? CONFIG.TTL_SECONDS;
  const entry: AvailabilityEntry = {
    ...data,
    prewarmed: options?.prewarmed ?? data.prewarmed,
  };
  
  // Always store in local cache
  setLocalCache(key, entry, ttl);
  
  // Try Redis
  const client = getRedisClient();
  if (client) {
    try {
      await client.set(key, entry, { ex: ttl });
      metrics.writes++;
      return true;
    } catch (e) {
      metrics.errors++;
      console.warn("[sharedCache] Redis set failed:", e);
      return false;
    }
  }
  
  return false;
}

/**
 * Bulk set availability entries (for pre-warming).
 * Uses Redis pipeline for efficiency.
 */
export async function setAvailabilityBulk(
  entries: Array<{
    sku: string;
    minQty: number;
    data: AvailabilityEntry;
  }>,
  options?: { prewarmed?: boolean; ttlSeconds?: number }
): Promise<{ success: number; failed: number }> {
  const ttl = options?.ttlSeconds ?? CONFIG.TTL_SECONDS;
  let success = 0;
  let failed = 0;
  
  // Always store in local cache
  for (const entry of entries) {
    const key = makeAvailabilityKey(entry.sku, entry.minQty);
    const data: AvailabilityEntry = {
      ...entry.data,
      prewarmed: options?.prewarmed ?? true,
    };
    setLocalCache(key, data, ttl);
  }
  
  // Try Redis pipeline
  const client = getRedisClient();
  if (client) {
    try {
      const pipeline = client.pipeline();
      
      for (const entry of entries) {
        const key = makeAvailabilityKey(entry.sku, entry.minQty);
        const data: AvailabilityEntry = {
          ...entry.data,
          prewarmed: options?.prewarmed ?? true,
        };
        pipeline.set(key, data, { ex: ttl });
      }
      
      const results = await pipeline.exec();
      
      for (const r of results) {
        if (r === "OK" || r === 1) {
          success++;
          metrics.writes++;
        } else {
          failed++;
        }
      }
      
      return { success, failed };
    } catch (e) {
      metrics.errors++;
      console.error("[sharedCache] Redis bulk set failed:", e);
      return { success: 0, failed: entries.length };
    }
  }
  
  // No Redis - count local cache writes as success
  return { success: entries.length, failed: 0 };
}

/**
 * Clear all availability cache entries.
 * For testing/maintenance only.
 */
export async function clearAvailabilityCache(): Promise<boolean> {
  // Clear local
  localCache.clear();
  
  // Clear Redis (scan and delete by prefix)
  const client = getRedisClient();
  if (client) {
    try {
      let cursor: string | number = 0;
      let done = false;
      while (!done) {
        const [nextCursor, keys] = await client.scan(cursor, {
          match: `${CONFIG.KEY_PREFIX}*`,
          count: 100,
        }) as [string | number, string[]];
        
        if (keys.length > 0) {
          await client.del(...keys);
        }
        
        cursor = nextCursor;
        done = cursor === 0 || cursor === "0";
      }
      return true;
    } catch (e) {
      console.error("[sharedCache] Redis clear failed:", e);
      return false;
    }
  }
  
  return true;
}

/**
 * Get cache entry count (approximate).
 */
export async function getAvailabilityCacheSize(): Promise<number> {
  const client = getRedisClient();
  if (client) {
    try {
      let count = 0;
      let cursor: string | number = 0;
      let done = false;
      while (!done) {
        const [nextCursor, keys] = await client.scan(cursor, {
          match: `${CONFIG.KEY_PREFIX}*`,
          count: 1000,
        }) as [string | number, string[]];
        
        count += keys.length;
        cursor = nextCursor;
        done = cursor === 0 || cursor === "0";
      }
      return count;
    } catch (e) {
      console.error("[sharedCache] Redis scan failed:", e);
    }
  }
  
  return localCache.size;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEALTH CHECK ENDPOINT HELPER
// ═══════════════════════════════════════════════════════════════════════════════

export async function runHealthCheck(): Promise<{
  redis: { connected: boolean; latencyMs: number | null; error: string | null };
  localCache: { size: number };
}> {
  const client = getRedisClient();
  let redisResult = { connected: false, latencyMs: null as number | null, error: null as string | null };
  
  if (client) {
    const start = Date.now();
    try {
      await client.ping();
      redisResult = {
        connected: true,
        latencyMs: Date.now() - start,
        error: null,
      };
      redisHealthy = true;
    } catch (e: any) {
      redisResult = {
        connected: false,
        latencyMs: null,
        error: e?.message || String(e),
      };
      redisHealthy = false;
    }
    lastHealthCheck = new Date().toISOString();
  }
  
  return {
    redis: redisResult,
    localCache: { size: localCache.size },
  };
}
