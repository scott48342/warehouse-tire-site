/**
 * Public API Response Cache
 * 
 * In-memory cache for fitment data to reduce database load.
 * Cache keys are based on endpoint + query params.
 * 
 * For production scale, this could be replaced with Redis/Upstash.
 */

// ============================================================================
// Cache Configuration
// ============================================================================

interface CacheConfig {
  ttlMs: number;
  maxEntries: number;
}

const CACHE_CONFIG: Record<string, CacheConfig> = {
  // Years change rarely
  "/api/public/fitment/years": { ttlMs: 3600_000, maxEntries: 100 },      // 1 hour
  
  // Makes are stable
  "/api/public/fitment/makes": { ttlMs: 3600_000, maxEntries: 50 },       // 1 hour
  
  // Models change occasionally
  "/api/public/fitment/models": { ttlMs: 1800_000, maxEntries: 500 },     // 30 min
  
  // Trims are relatively stable
  "/api/public/fitment/trims": { ttlMs: 900_000, maxEntries: 2000 },      // 15 min
  
  // Specs are the core data - cache aggressively
  "/api/public/fitment/specs": { ttlMs: 1800_000, maxEntries: 5000 },     // 30 min
};

const DEFAULT_CONFIG: CacheConfig = { ttlMs: 300_000, maxEntries: 100 }; // 5 min

// ============================================================================
// Cache Storage
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

// ============================================================================
// Cache Operations
// ============================================================================

/**
 * Generate cache key from endpoint and query params
 */
export function makeCacheKey(endpoint: string, params: Record<string, string>): string {
  const sortedParams = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  
  return sortedParams ? `${endpoint}?${sortedParams}` : endpoint;
}

/**
 * Get cached response
 */
export function getFromCache<T>(key: string): { data: T; hit: true } | { data: null; hit: false } {
  const entry = cache.get(key);
  
  if (!entry) {
    return { data: null, hit: false };
  }

  // Check TTL
  const config = getConfigForKey(key);
  const age = Date.now() - entry.timestamp;
  
  if (age > config.ttlMs) {
    cache.delete(key);
    return { data: null, hit: false };
  }

  // Update hit count
  entry.hits++;
  
  return { data: entry.data as T, hit: true };
}

/**
 * Store response in cache
 */
export function setInCache<T>(key: string, data: T): void {
  const config = getConfigForKey(key);
  
  // Evict old entries if at max capacity
  if (cache.size >= config.maxEntries) {
    evictOldEntries(config);
  }

  cache.set(key, {
    data,
    timestamp: Date.now(),
    hits: 0,
  });
}

/**
 * Invalidate cache entries matching a pattern
 */
export function invalidateCache(pattern?: string): number {
  if (!pattern) {
    const size = cache.size;
    cache.clear();
    return size;
  }

  let count = 0;
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
      count++;
    }
  }
  return count;
}

/**
 * Get cache stats
 */
export function getCacheStats(): {
  size: number;
  endpoints: Record<string, { entries: number; hits: number }>;
} {
  const endpoints: Record<string, { entries: number; hits: number }> = {};

  for (const [key, entry] of cache) {
    const endpoint = key.split("?")[0];
    if (!endpoints[endpoint]) {
      endpoints[endpoint] = { entries: 0, hits: 0 };
    }
    endpoints[endpoint].entries++;
    endpoints[endpoint].hits += entry.hits;
  }

  return { size: cache.size, endpoints };
}

// ============================================================================
// Helpers
// ============================================================================

function getConfigForKey(key: string): CacheConfig {
  const endpoint = key.split("?")[0];
  return CACHE_CONFIG[endpoint] || DEFAULT_CONFIG;
}

function evictOldEntries(config: CacheConfig): void {
  // Find entries to evict (oldest first, considering hits)
  const entries = Array.from(cache.entries())
    .map(([key, entry]) => ({
      key,
      score: entry.timestamp - (entry.hits * 60_000), // Hits extend effective age
    }))
    .sort((a, b) => a.score - b.score);

  // Evict 10% of entries
  const evictCount = Math.max(1, Math.floor(config.maxEntries * 0.1));
  for (let i = 0; i < evictCount && i < entries.length; i++) {
    cache.delete(entries[i].key);
  }
}

// ============================================================================
// Periodic Cleanup (runs every 5 minutes)
// ============================================================================

let cleanupInterval: NodeJS.Timeout | null = null;

export function startCacheCleanup(): void {
  if (cleanupInterval) return;
  
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of cache) {
      const config = getConfigForKey(key);
      if (now - entry.timestamp > config.ttlMs) {
        cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[API Cache] Cleaned ${cleaned} expired entries, ${cache.size} remaining`);
    }
  }, 300_000); // 5 minutes
}

export function stopCacheCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Auto-start in non-test environments
if (typeof process !== "undefined" && process.env.NODE_ENV !== "test") {
  startCacheCleanup();
}
