/**
 * Wheel Availability Cache
 * 
 * Centralized cache for wheel availability checks from WheelPros.
 * Now uses SHARED CACHE (Upstash Redis) for cross-instance sharing.
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * ARCHITECTURE CHANGE (March 2026)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * BEFORE: Instance-local Map cache
 * - Pre-warm hit rate: 0% (users hit different instances)
 * - Pre-warm effort: wasted
 * 
 * AFTER: Shared Redis cache (Upstash)
 * - Pre-warm benefits ALL instances
 * - ~5-15ms latency overhead (acceptable for 30-min TTL)
 * - Falls back to local cache if Redis unavailable
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * CACHE KEY STRUCTURE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Format: `wt:avail:${sku}:minQty=${minQty}`
 * 
 * Examples:
 * - "wt:avail:W1234567:minQty=4"  → Standard consumer order (4 wheels)
 * - "wt:avail:W1234567:minQty=1"  → Single wheel replacement
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * CACHE BEHAVIOR
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * - TTL: 30 minutes
 * - Primary: Upstash Redis (shared across instances)
 * - Fallback: Local Map cache (per-instance)
 * - Pre-warm targets: Common truck/SUV bolt patterns
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import {
  getAvailability,
  setAvailability,
  setAvailabilityBulk,
  getSharedCacheStats,
  resetSharedCacheMetrics,
  recordPrewarmStats,
  makeAvailabilityKey,
  clearAvailabilityCache,
  getAvailabilityCacheSize,
  runHealthCheck,
  type AvailabilityEntry,
  type SharedCacheStats,
} from "./sharedCache";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES (re-export for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════════

export type AvailabilityResult = AvailabilityEntry & {
  fromCache?: boolean;
  fromPrewarm?: boolean;
  fromShared?: boolean;
};

export type CacheStats = SharedCacheStats & {
  size: number;
  maxSize: number;
  ttlMs: number;
  prewarmedEntries: number; // Note: can't easily count in Redis, will be approximate
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  // Cache TTL: 30 minutes (in ms for backward compat)
  TTL_MS: 30 * 60 * 1000,
  
  // Max cache size (for local fallback)
  MAX_SIZE: 10_000,
  
  // Orderable inventory types
  ORDERABLE_TYPES: new Set(["SO", "ST", "NW", "BW", "CS"]),
};

// ═══════════════════════════════════════════════════════════════════════════════
// LEGACY API COMPATIBILITY
// ═══════════════════════════════════════════════════════════════════════════════

// These maintain backward compatibility with existing code

/**
 * Generate a cache key for availability lookup.
 * @deprecated Use makeAvailabilityKey from sharedCache.ts
 */
export function makeCacheKey(sku: string, minQty: number = 4): string {
  return makeAvailabilityKey(sku, minQty);
}

/**
 * Get cached availability if available and not expired.
 * Now uses shared Redis cache with local fallback.
 */
export async function getCached(sku: string, minQty: number = 4): Promise<AvailabilityResult | null> {
  const result = await getAvailability(sku, minQty);
  if (!result) return null;
  
  return {
    ok: result.ok,
    inventoryType: result.inventoryType,
    localQty: result.localQty,
    globalQty: result.globalQty,
    checkedAt: result.checkedAt,
    fromCache: result.fromCache,
    fromPrewarm: result.prewarmed,
    fromShared: result.fromShared,
  };
}

/**
 * Synchronous cache check (local only).
 * For hot-path performance where async isn't acceptable.
 * Note: This only checks local cache, not shared Redis.
 */
export function getCachedSync(sku: string, minQty: number = 4): AvailabilityResult | null {
  // This is the legacy behavior - local only
  // We keep a small local cache for ultra-fast repeated access
  const key = makeAvailabilityKey(sku, minQty);
  const entry = localCacheForSync.get(key);
  
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    localCacheForSync.delete(key);
    return null;
  }
  
  return {
    ok: entry.ok,
    inventoryType: entry.inventoryType,
    localQty: entry.localQty,
    globalQty: entry.globalQty,
    checkedAt: entry.checkedAt,
    fromCache: true,
    fromPrewarm: entry.prewarmed,
    fromShared: false,
  };
}

// Local cache for sync access (small, request-scoped essentially)
type LocalEntry = AvailabilityEntry & { expiresAt: number };
const localCacheForSync = new Map<string, LocalEntry>();

function updateLocalSyncCache(sku: string, minQty: number, data: AvailabilityEntry): void {
  const key = makeAvailabilityKey(sku, minQty);
  
  // LRU eviction
  if (localCacheForSync.size >= 1000) {
    const firstKey = localCacheForSync.keys().next().value;
    if (firstKey) localCacheForSync.delete(firstKey);
  }
  
  localCacheForSync.set(key, {
    ...data,
    expiresAt: Date.now() + CONFIG.TTL_MS,
  });
}

/**
 * Store availability result in cache.
 * Now writes to shared Redis cache.
 */
export async function setCache(
  sku: string,
  minQty: number,
  result: {
    ok: boolean;
    inventoryType?: string;
    localQty?: number;
    globalQty?: number;
    checkedAt: string;
  },
  options?: { prewarmed?: boolean; ttlMs?: number }
): Promise<void> {
  const ttlSeconds = Math.round((options?.ttlMs ?? CONFIG.TTL_MS) / 1000);
  
  const data: AvailabilityEntry = {
    ok: result.ok,
    inventoryType: result.inventoryType || "",
    localQty: result.localQty || 0,
    globalQty: result.globalQty || 0,
    checkedAt: result.checkedAt,
    prewarmed: options?.prewarmed,
  };
  
  // Also update local sync cache
  updateLocalSyncCache(sku, minQty, data);
  
  await setAvailability(sku, minQty, data, {
    prewarmed: options?.prewarmed,
    ttlSeconds,
  });
}

/**
 * Synchronous cache set (local only).
 * For cases where we can't await.
 */
export function setCacheSync(
  sku: string,
  minQty: number,
  result: {
    ok: boolean;
    inventoryType?: string;
    localQty?: number;
    globalQty?: number;
    checkedAt: string;
  },
  options?: { prewarmed?: boolean }
): void {
  const data: AvailabilityEntry = {
    ok: result.ok,
    inventoryType: result.inventoryType || "",
    localQty: result.localQty || 0,
    globalQty: result.globalQty || 0,
    checkedAt: result.checkedAt,
    prewarmed: options?.prewarmed,
  };
  
  updateLocalSyncCache(sku, minQty, data);
  
  // Fire-and-forget async write to shared cache
  setAvailability(sku, minQty, data, { prewarmed: options?.prewarmed }).catch(() => {});
}

/**
 * Bulk set multiple cache entries (for pre-warming).
 */
export async function setCacheBulk(
  entries: Array<{
    sku: string;
    minQty: number;
    result: {
      ok: boolean;
      inventoryType?: string;
      localQty?: number;
      globalQty?: number;
      checkedAt: string;
    };
  }>,
  options?: { prewarmed?: boolean; ttlMs?: number }
): Promise<{ success: number; failed: number }> {
  const ttlSeconds = Math.round((options?.ttlMs ?? CONFIG.TTL_MS) / 1000);
  
  const bulkEntries = entries.map((e) => ({
    sku: e.sku,
    minQty: e.minQty,
    data: {
      ok: e.result.ok,
      inventoryType: e.result.inventoryType || "",
      localQty: e.result.localQty || 0,
      globalQty: e.result.globalQty || 0,
      checkedAt: e.result.checkedAt,
      prewarmed: options?.prewarmed ?? true,
    } as AvailabilityEntry,
  }));
  
  // Also update local sync cache
  for (const e of bulkEntries) {
    updateLocalSyncCache(e.sku, e.minQty, e.data);
  }
  
  return setAvailabilityBulk(bulkEntries, {
    prewarmed: options?.prewarmed ?? true,
    ttlSeconds,
  });
}

/**
 * Clear all cached data.
 */
export async function clearCache(): Promise<void> {
  localCacheForSync.clear();
  await clearAvailabilityCache();
}

/**
 * Get cache statistics.
 */
export async function getCacheStats(): Promise<CacheStats> {
  const shared = getSharedCacheStats();
  const size = await getAvailabilityCacheSize();
  
  return {
    ...shared,
    size,
    maxSize: CONFIG.MAX_SIZE,
    ttlMs: CONFIG.TTL_MS,
    prewarmedEntries: shared.lastPrewarmSkusWarmed ?? 0,
  };
}

/**
 * Get cache statistics (sync version - returns shared stats only).
 */
export function getCacheStatsSync(): Omit<CacheStats, "size"> & { size: number } {
  const shared = getSharedCacheStats();
  return {
    ...shared,
    size: localCacheForSync.size,
    maxSize: CONFIG.MAX_SIZE,
    ttlMs: CONFIG.TTL_MS,
    prewarmedEntries: shared.lastPrewarmSkusWarmed ?? 0,
  };
}

/**
 * Reset metrics (for testing).
 */
export function resetMetrics(): void {
  resetSharedCacheMetrics();
}

/**
 * Record pre-warm completion.
 */
export function recordPrewarmComplete(durationMs: number, skusWarmed: number): void {
  recordPrewarmStats(skusWarmed);
}

/**
 * Run health check on cache infrastructure.
 */
export { runHealthCheck };

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE AVAILABILITY CHECK
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fetch live availability from WheelPros, with caching.
 * This is the main entry point for availability checks.
 */
export async function fetchAvailability(opts: {
  wheelProsBase: string;
  headers: Record<string, string>;
  sku: string;
  minQty: number;
  customerNumber?: string;
  companyCode?: string;
}): Promise<AvailabilityResult> {
  const checkedAt = new Date().toISOString();
  const sku = String(opts.sku || "").trim();
  
  if (!sku) {
    return { ok: false, inventoryType: "", localQty: 0, globalQty: 0, checkedAt };
  }
  
  // Check shared cache first
  const cached = await getCached(sku, opts.minQty);
  if (cached) {
    return cached;
  }
  
  // Fetch live
  const ac = new AbortController();
  const timeoutMs = Math.max(400, Math.min(1500, Number(process.env.WT_AVAIL_TIMEOUT_MS || "800") || 800));
  const to = setTimeout(() => ac.abort(), timeoutMs);
  
  try {
    const u = new URL("/wheels/search", opts.wheelProsBase);
    u.searchParams.set("sku", sku);
    u.searchParams.set("page", "1");
    u.searchParams.set("pageSize", "1");
    u.searchParams.set("fields", "inventory");
    u.searchParams.set("customer", opts.customerNumber || "1022165");
    u.searchParams.set("company", opts.companyCode || "1000");
    u.searchParams.set("min_qty", String(opts.minQty));
    
    const res = await fetch(u.toString(), {
      headers: opts.headers,
      cache: "no-store",
      signal: ac.signal,
    });
    
    const data = await res.json().catch(() => null);
    const item = data?.results?.[0] || data?.items?.[0] || null;
    
    const inv = item?.inventory;
    const invObj = Array.isArray(inv) ? inv[0] : inv;
    const inventoryType = typeof invObj?.type === "string" ? invObj.type.trim().toUpperCase() : "";
    
    const localQty = Number(invObj?.localStock ?? invObj?.local_qty ?? invObj?.localQty ?? 0) || 0;
    const globalQty = Number(invObj?.globalStock ?? invObj?.global_qty ?? invObj?.globalQty ?? invObj?.quantity ?? 0) || 0;
    const total = localQty + globalQty;
    
    const ok = Boolean(inventoryType && CONFIG.ORDERABLE_TYPES.has(inventoryType) && total >= opts.minQty);
    
    // Cache the result (fire-and-forget to not block response)
    setCache(sku, opts.minQty, { ok, inventoryType, localQty, globalQty, checkedAt }).catch(() => {});
    
    return { ok, inventoryType, localQty, globalQty, checkedAt };
  } catch {
    // Cache negative result on error (fire-and-forget)
    setCache(sku, opts.minQty, { ok: false, checkedAt }).catch(() => {});
    return { ok: false, inventoryType: "", localQty: 0, globalQty: 0, checkedAt };
  } finally {
    clearTimeout(to);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export const ORDERABLE_TYPES = CONFIG.ORDERABLE_TYPES;
export const CACHE_TTL_MS = CONFIG.TTL_MS;
