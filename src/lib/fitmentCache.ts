/**
 * Fitment Cache & Resilience Layer
 * 
 * Handles:
 * - In-memory caching of fitment profiles
 * - Request deduplication (one in-flight request per vehicle)
 * - Exponential backoff for 429 rate limits
 * - Graceful degradation on API failures
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type CachedFitment = {
  boltPattern?: string;
  centerBore?: number;
  tireSizes?: string[];
  wheelDiameterRangeIn?: [number | null, number | null];
  wheelWidthRangeIn?: [number | null, number | null];
  offsetRangeMm?: [number | null, number | null];
  staggered?: { isStaggered: boolean; reason?: string };
  vehicle?: {
    year: number;
    make: string;
    model: string;
    trim?: string;
    submodel?: string;
  };
  source: "wheelsize" | "wheelpros" | "cache" | "fallback";
  cachedAt: number;
  expiresAt: number;
};

type CacheEntry = {
  data: CachedFitment;
  fetchedAt: number;
  expiresAt: number;
};

type InFlightRequest = {
  promise: Promise<CachedFitment | null>;
  startedAt: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  // Cache TTL (1 hour for successful fetches, 5 min for errors)
  CACHE_TTL_SUCCESS_MS: 60 * 60 * 1000,
  CACHE_TTL_ERROR_MS: 5 * 60 * 1000,
  
  // 429 backoff settings
  INITIAL_BACKOFF_MS: 5000,      // 5 seconds
  MAX_BACKOFF_MS: 5 * 60 * 1000, // 5 minutes
  BACKOFF_MULTIPLIER: 2,
  
  // Cooldown after 429 (don't retry for this period)
  COOLDOWN_AFTER_429_MS: 60 * 1000, // 1 minute
  
  // Max in-flight request age before considering stale
  MAX_INFLIGHT_AGE_MS: 30 * 1000,
};

// ─────────────────────────────────────────────────────────────────────────────
// STATE (module-level singletons)
// ─────────────────────────────────────────────────────────────────────────────

// LRU-ish cache (simple Map, could upgrade to proper LRU)
const cache = new Map<string, CacheEntry>();
const MAX_CACHE_SIZE = 500;

// In-flight request deduplication
const inFlight = new Map<string, InFlightRequest>();

// 429 rate limit state
let rateLimitState = {
  isLimited: false,
  limitedAt: 0,
  cooldownUntil: 0,
  consecutiveFailures: 0,
  currentBackoffMs: CONFIG.INITIAL_BACKOFF_MS,
};

// ─────────────────────────────────────────────────────────────────────────────
// CACHE KEY GENERATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a cache key for a vehicle fitment lookup.
 * Format: "year|make|model|modification" (lowercase, trimmed)
 */
export function makeCacheKey(
  year: string | number,
  make: string,
  model: string,
  modification?: string
): string {
  const parts = [
    String(year).trim(),
    String(make).trim().toLowerCase(),
    String(model).trim().toLowerCase(),
    modification ? String(modification).trim().toLowerCase() : "",
  ];
  return parts.join("|");
}

// ─────────────────────────────────────────────────────────────────────────────
// CACHE OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get cached fitment data if available and not expired.
 */
export function getCached(key: string): CachedFitment | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  // Check expiration
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  
  return { ...entry.data, source: "cache" };
}

/**
 * Store fitment data in cache.
 */
export function setCache(
  key: string,
  data: CachedFitment,
  ttlMs: number = CONFIG.CACHE_TTL_SUCCESS_MS
): void {
  const now = Date.now();
  
  // Evict oldest entries if cache is full
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  
  cache.set(key, {
    data: { ...data, cachedAt: now, expiresAt: now + ttlMs },
    fetchedAt: now,
    expiresAt: now + ttlMs,
  });
}

/**
 * Clear all cached data (useful for testing or forced refresh).
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Get cache statistics.
 */
export function getCacheStats(): {
  size: number;
  maxSize: number;
  rateLimited: boolean;
  cooldownRemainingMs: number;
} {
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
    rateLimited: rateLimitState.isLimited,
    cooldownRemainingMs: Math.max(0, rateLimitState.cooldownUntil - Date.now()),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RATE LIMIT HANDLING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if we're currently in cooldown due to 429.
 */
export function isInCooldown(): boolean {
  return Date.now() < rateLimitState.cooldownUntil;
}

/**
 * Record a 429 response and update backoff state.
 */
export function record429(): void {
  const now = Date.now();
  rateLimitState.isLimited = true;
  rateLimitState.limitedAt = now;
  rateLimitState.consecutiveFailures++;
  
  // Exponential backoff
  rateLimitState.currentBackoffMs = Math.min(
    rateLimitState.currentBackoffMs * CONFIG.BACKOFF_MULTIPLIER,
    CONFIG.MAX_BACKOFF_MS
  );
  
  rateLimitState.cooldownUntil = now + rateLimitState.currentBackoffMs;
  
  console.warn(
    `[fitmentCache] 429 rate limit hit. Cooldown for ${rateLimitState.currentBackoffMs}ms. ` +
    `Consecutive failures: ${rateLimitState.consecutiveFailures}`
  );
}

/**
 * Record a successful API response and reset backoff.
 */
export function recordSuccess(): void {
  rateLimitState.isLimited = false;
  rateLimitState.consecutiveFailures = 0;
  rateLimitState.currentBackoffMs = CONFIG.INITIAL_BACKOFF_MS;
}

/**
 * Get current rate limit state for debugging.
 */
export function getRateLimitState(): typeof rateLimitState {
  return { ...rateLimitState };
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST DEDUPLICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if there's already an in-flight request for this key.
 * Returns the existing promise if so, null otherwise.
 */
export function getInFlight(key: string): Promise<CachedFitment | null> | null {
  const entry = inFlight.get(key);
  if (!entry) return null;
  
  // Check if request is stale (took too long)
  if (Date.now() - entry.startedAt > CONFIG.MAX_INFLIGHT_AGE_MS) {
    inFlight.delete(key);
    return null;
  }
  
  return entry.promise;
}

/**
 * Register an in-flight request for deduplication.
 */
export function setInFlight(key: string, promise: Promise<CachedFitment | null>): void {
  inFlight.set(key, {
    promise,
    startedAt: Date.now(),
  });
  
  // Clean up after promise resolves
  promise.finally(() => {
    inFlight.delete(key);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// FETCH WITH CACHING
// ─────────────────────────────────────────────────────────────────────────────

export type FetchFitmentOptions = {
  year: string | number;
  make: string;
  model: string;
  modification?: string;
  forceRefresh?: boolean;
};

/**
 * Fetch fitment data with caching, deduplication, and rate limit handling.
 * 
 * This is the main entry point for getting fitment data. It:
 * 1. Checks cache first
 * 2. Deduplicates concurrent requests
 * 3. Respects 429 cooldown
 * 4. Falls back gracefully on errors
 * 
 * @param fetcher - The actual fetch function to call if cache miss
 * @param options - Vehicle identification
 */
export async function fetchWithCache(
  fetcher: () => Promise<CachedFitment | null>,
  options: FetchFitmentOptions
): Promise<CachedFitment | null> {
  const key = makeCacheKey(options.year, options.make, options.model, options.modification);
  
  // 1. Check cache (unless force refresh)
  if (!options.forceRefresh) {
    const cached = getCached(key);
    if (cached) {
      return cached;
    }
  }
  
  // 2. Check for in-flight request (deduplication)
  const existing = getInFlight(key);
  if (existing) {
    return existing;
  }
  
  // 3. Check 429 cooldown
  if (isInCooldown()) {
    console.log(`[fitmentCache] In cooldown, returning null for ${key}`);
    return null;
  }
  
  // 4. Make the actual request
  const promise = (async (): Promise<CachedFitment | null> => {
    try {
      const result = await fetcher();
      
      if (result) {
        recordSuccess();
        setCache(key, result);
        return result;
      }
      
      return null;
    } catch (err: any) {
      // Check for 429
      if (err?.status === 429 || err?.message?.includes("429") || err?.message?.includes("rate limit")) {
        record429();
      }
      
      console.error(`[fitmentCache] Fetch error for ${key}:`, err?.message || err);
      return null;
    }
  })();
  
  // Register for deduplication
  setInFlight(key, promise);
  
  return promise;
}

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK DATA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a minimal fallback fitment object when API is unavailable.
 * Used to ensure the UI can still render without raw engine text.
 */
export function createFallbackFitment(
  year: string | number,
  make: string,
  model: string
): CachedFitment {
  return {
    vehicle: {
      year: Number(year),
      make,
      model,
      // Note: NO trim/submodel - we don't have verified data
    },
    source: "fallback",
    cachedAt: Date.now(),
    expiresAt: Date.now() + CONFIG.CACHE_TTL_ERROR_MS,
  };
}
