/**
 * TireWeb Protection Layer
 * 
 * Reduces live TireWeb API calls during real shopper traffic:
 * - Read-through cache (Redis)
 * - Single-flight request deduping
 * - Stale-while-revalidate
 * - Circuit breaker on ErrorCode 127
 * - DB-first fallback (WheelPros always available)
 * 
 * NO bulk prewarming - this layer is purely defensive.
 */

import { Redis } from "@upstash/redis";

// ============================================================================
// TYPES
// ============================================================================

export interface TireWebCacheEntry<T> {
  data: T;
  cachedAt: number;      // Unix timestamp (ms)
  expiresAt: number;     // Hard expiry
  staleAt: number;       // Soft expiry (serve stale, refresh in background)
}

export interface CircuitBreakerState {
  status: "closed" | "open" | "half-open";
  failures: number;
  lastFailure: number;
  openedAt: number | null;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Cache TTLs
  CACHE_TTL_MS: 30 * 60 * 1000,           // 30 minutes hard expiry
  STALE_TTL_MS: 10 * 60 * 1000,           // 10 minutes before considered stale
  
  // Circuit breaker
  FAILURE_THRESHOLD: 3,                    // Open circuit after 3 failures
  CIRCUIT_OPEN_DURATION_MS: 5 * 60 * 1000, // Stay open for 5 minutes
  HALF_OPEN_TEST_INTERVAL_MS: 60 * 1000,   // Test every 60 seconds in half-open
  
  // Single-flight
  IN_FLIGHT_TTL_MS: 30 * 1000,             // Max wait for in-flight request
  
  // Keys
  CACHE_PREFIX: "tireweb:cache:",
  CIRCUIT_KEY: "tireweb:circuit",
  IN_FLIGHT_PREFIX: "tireweb:inflight:",
};

// ============================================================================
// REDIS CLIENT
// ============================================================================

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    console.warn("[tireweb-protection] Redis not configured, cache disabled");
    return null;
  }
  
  _redis = new Redis({ url, token });
  return _redis;
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

const localCircuit: CircuitBreakerState = {
  status: "closed",
  failures: 0,
  lastFailure: 0,
  openedAt: null,
};

/**
 * Check if circuit allows requests
 */
export async function isCircuitOpen(): Promise<boolean> {
  const now = Date.now();
  
  // If circuit is open, check if it's time to try half-open
  if (localCircuit.status === "open") {
    const elapsed = now - (localCircuit.openedAt || 0);
    if (elapsed >= CONFIG.CIRCUIT_OPEN_DURATION_MS) {
      localCircuit.status = "half-open";
      console.log("[tireweb-protection] Circuit moving to half-open");
      return false; // Allow one test request
    }
    return true; // Still open
  }
  
  // Half-open allows requests through
  if (localCircuit.status === "half-open") {
    return false;
  }
  
  return false; // Closed = allow requests
}

/**
 * Record a successful request (closes circuit)
 */
export function recordSuccess(): void {
  if (localCircuit.status === "half-open") {
    console.log("[tireweb-protection] Circuit closing after successful test");
  }
  localCircuit.status = "closed";
  localCircuit.failures = 0;
}

/**
 * Record a failure (may open circuit)
 */
export function recordFailure(isRateLimit: boolean): void {
  localCircuit.failures++;
  localCircuit.lastFailure = Date.now();
  
  // Rate limit errors immediately open circuit
  if (isRateLimit) {
    console.log("[tireweb-protection] Rate limit detected, opening circuit immediately");
    localCircuit.status = "open";
    localCircuit.openedAt = Date.now();
    return;
  }
  
  // Other failures need threshold
  if (localCircuit.failures >= CONFIG.FAILURE_THRESHOLD) {
    console.log(`[tireweb-protection] Failure threshold reached (${localCircuit.failures}), opening circuit`);
    localCircuit.status = "open";
    localCircuit.openedAt = Date.now();
  }
}

/**
 * Get circuit status for diagnostics
 */
export function getCircuitStatus(): CircuitBreakerState {
  return { ...localCircuit };
}

// ============================================================================
// CACHE LAYER
// ============================================================================

/**
 * Get cached data if available
 * Returns { data, isStale } or null if no cache
 */
export async function getCached<T>(key: string): Promise<{ data: T; isStale: boolean } | null> {
  const redis = getRedis();
  if (!redis) return null;
  
  try {
    const cacheKey = CONFIG.CACHE_PREFIX + key;
    const entry = await redis.get<TireWebCacheEntry<T>>(cacheKey);
    
    if (!entry) return null;
    
    const now = Date.now();
    
    // Hard expired - don't use
    if (now > entry.expiresAt) {
      return null;
    }
    
    // Stale but usable
    const isStale = now > entry.staleAt;
    return { data: entry.data, isStale };
  } catch (err) {
    console.error("[tireweb-protection] Cache read error:", err);
    return null;
  }
}

/**
 * Store data in cache
 */
export async function setCache<T>(key: string, data: T): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  
  try {
    const now = Date.now();
    const entry: TireWebCacheEntry<T> = {
      data,
      cachedAt: now,
      staleAt: now + CONFIG.STALE_TTL_MS,
      expiresAt: now + CONFIG.CACHE_TTL_MS,
    };
    
    const cacheKey = CONFIG.CACHE_PREFIX + key;
    // Set with TTL slightly longer than expiresAt for safety
    const ttlSeconds = Math.ceil(CONFIG.CACHE_TTL_MS / 1000) + 60;
    await redis.set(cacheKey, entry, { ex: ttlSeconds });
  } catch (err) {
    console.error("[tireweb-protection] Cache write error:", err);
  }
}

// ============================================================================
// SINGLE-FLIGHT DEDUPING
// ============================================================================

// In-memory map of in-flight requests (for single process)
const inFlightRequests = new Map<string, Promise<any>>();

/**
 * Execute a function with single-flight deduping
 * If the same key is already in-flight, wait for that result
 */
export async function singleFlight<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  // Check if already in-flight locally
  const existing = inFlightRequests.get(key);
  if (existing) {
    console.log(`[tireweb-protection] Deduping request for ${key}`);
    return existing as Promise<T>;
  }
  
  // Execute and track
  const promise = fn().finally(() => {
    inFlightRequests.delete(key);
  });
  
  inFlightRequests.set(key, promise);
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
export function triggerRevalidation<T>(
  key: string,
  fetchFn: () => Promise<T>
): void {
  if (revalidating.has(key)) {
    return; // Already revalidating
  }
  
  revalidating.add(key);
  
  // Fire and forget - don't await
  (async () => {
    try {
      console.log(`[tireweb-protection] Background revalidation for ${key}`);
      const data = await fetchFn();
      await setCache(key, data);
    } catch (err) {
      console.error(`[tireweb-protection] Revalidation failed for ${key}:`, err);
    } finally {
      revalidating.delete(key);
    }
  })();
}

// ============================================================================
// MAIN PROTECTED FETCH
// ============================================================================

export interface ProtectedFetchOptions<T> {
  /** Cache key for this query */
  cacheKey: string;
  
  /** The actual TireWeb fetch function */
  fetchFn: () => Promise<T>;
  
  /** Fallback function (e.g., WheelPros DB query) */
  fallbackFn: () => Promise<T>;
  
  /** Check if result indicates rate limiting */
  isRateLimitError?: (result: T) => boolean;
  
  /** Check if result is empty/error that shouldn't be cached */
  isEmptyResult?: (result: T) => boolean;
}

export interface ProtectedFetchResult<T> {
  data: T;
  source: "cache" | "api" | "fallback";
  stale: boolean;
  circuitOpen: boolean;
}

/**
 * Protected fetch with all safeguards:
 * 1. Check cache first
 * 2. If stale, serve stale + trigger background revalidation
 * 3. If circuit open, use fallback
 * 4. Single-flight dedupe API calls
 * 5. Update circuit breaker on success/failure
 */
export async function protectedFetch<T>(
  options: ProtectedFetchOptions<T>
): Promise<ProtectedFetchResult<T>> {
  const { cacheKey, fetchFn, fallbackFn, isRateLimitError, isEmptyResult } = options;
  
  // Step 1: Check cache
  const cached = await getCached<T>(cacheKey);
  
  if (cached) {
    // Fresh cache - return immediately
    if (!cached.isStale) {
      return { data: cached.data, source: "cache", stale: false, circuitOpen: false };
    }
    
    // Stale cache - return but trigger revalidation
    const circuitOpen = await isCircuitOpen();
    if (!circuitOpen) {
      triggerRevalidation(cacheKey, async () => {
        return singleFlight(cacheKey, fetchFn);
      });
    }
    
    return { data: cached.data, source: "cache", stale: true, circuitOpen };
  }
  
  // Step 2: No cache - check circuit breaker
  const circuitOpen = await isCircuitOpen();
  
  if (circuitOpen) {
    // Circuit open - use fallback immediately
    console.log(`[tireweb-protection] Circuit open, using fallback for ${cacheKey}`);
    const fallbackData = await fallbackFn();
    return { data: fallbackData, source: "fallback", stale: false, circuitOpen: true };
  }
  
  // Step 3: Try API with single-flight deduping
  try {
    const data = await singleFlight(cacheKey, fetchFn);
    
    // Check for rate limit in response
    if (isRateLimitError?.(data)) {
      recordFailure(true);
      console.log(`[tireweb-protection] Rate limit in response, falling back`);
      const fallbackData = await fallbackFn();
      return { data: fallbackData, source: "fallback", stale: false, circuitOpen: false };
    }
    
    // Success - cache if not empty
    recordSuccess();
    if (!isEmptyResult?.(data)) {
      await setCache(cacheKey, data);
    }
    
    return { data, source: "api", stale: false, circuitOpen: false };
  } catch (err) {
    // API error - record failure and use fallback
    console.error(`[tireweb-protection] API error for ${cacheKey}:`, err);
    recordFailure(false);
    
    const fallbackData = await fallbackFn();
    return { data: fallbackData, source: "fallback", stale: false, circuitOpen: false };
  }
}

// ============================================================================
// DIAGNOSTICS
// ============================================================================

export async function getDiagnostics(): Promise<{
  circuit: CircuitBreakerState;
  inFlightCount: number;
  revalidatingCount: number;
  redisConnected: boolean;
}> {
  return {
    circuit: getCircuitStatus(),
    inFlightCount: inFlightRequests.size,
    revalidatingCount: revalidating.size,
    redisConnected: getRedis() !== null,
  };
}
