/**
 * Wheel Availability Cache
 * 
 * Centralized cache for wheel availability checks from WheelPros.
 * Supports pre-warming for common vehicle searches.
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * CACHE KEY STRUCTURE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Format: `${sku}|minQty=${minQty}`
 * 
 * Examples:
 * - "W1234567|minQty=4"  → Standard consumer order (4 wheels)
 * - "W1234567|minQty=1"  → Single wheel replacement
 * 
 * The cache key includes minQty because availability depends on stock thresholds.
 * A SKU may be available for qty=1 but not qty=4.
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 * CACHE BEHAVIOR
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * - TTL: 30 minutes (configurable via WT_AVAIL_CACHE_TTL_MS)
 * - Max size: 10,000 entries (LRU eviction)
 * - Pre-warm targets: Common truck/SUV bolt patterns
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type AvailabilityResult = {
  ok: boolean;
  inventoryType: string;
  localQty: number;
  globalQty: number;
  checkedAt: string;
  fromCache?: boolean;
  fromPrewarm?: boolean;
};

type CacheEntry = {
  expiresAt: number;
  ok: boolean;
  inventoryType?: string;
  localQty?: number;
  globalQty?: number;
  checkedAt: string;
  prewarmed?: boolean;
};

export type CacheStats = {
  size: number;
  maxSize: number;
  ttlMs: number;
  hits: number;
  misses: number;
  hitRate: number;
  prewarmedEntries: number;
  prewarmedHits: number;
  lastPrewarmAt: string | null;
  lastPrewarmDurationMs: number | null;
  lastPrewarmSkusWarmed: number | null;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  // Cache TTL: 30 minutes default, configurable via env
  TTL_MS: Math.max(
    60_000,
    Math.min(60 * 60_000, Number(process.env.WT_AVAIL_CACHE_TTL_MS || "1800000") || 1_800_000)
  ),
  
  // Max cache size (LRU eviction above this)
  MAX_SIZE: 10_000,
  
  // Orderable inventory types
  ORDERABLE_TYPES: new Set(["SO", "ST", "NW", "BW", "CS"]),
};

// ═══════════════════════════════════════════════════════════════════════════════
// STATE (module-level singleton)
// ═══════════════════════════════════════════════════════════════════════════════

const cache = new Map<string, CacheEntry>();

// Metrics
let metrics = {
  hits: 0,
  misses: 0,
  prewarmedHits: 0,
  lastPrewarmAt: null as string | null,
  lastPrewarmDurationMs: null as number | null,
  lastPrewarmSkusWarmed: null as number | null,
};

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE KEY GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a cache key for availability lookup.
 * 
 * Format: `${sku}|minQty=${minQty}`
 */
export function makeCacheKey(sku: string, minQty: number = 4): string {
  return `${sku.trim()}|minQty=${minQty}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get cached availability if available and not expired.
 */
export function getCached(sku: string, minQty: number = 4): AvailabilityResult | null {
  const key = makeCacheKey(sku, minQty);
  const entry = cache.get(key);
  
  if (!entry) {
    metrics.misses++;
    return null;
  }
  
  // Check expiration
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    metrics.misses++;
    return null;
  }
  
  metrics.hits++;
  if (entry.prewarmed) {
    metrics.prewarmedHits++;
  }
  
  return {
    ok: entry.ok,
    inventoryType: entry.inventoryType || "",
    localQty: entry.localQty || 0,
    globalQty: entry.globalQty || 0,
    checkedAt: entry.checkedAt,
    fromCache: true,
    fromPrewarm: entry.prewarmed,
  };
}

/**
 * Store availability result in cache.
 */
export function setCache(
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
): void {
  const key = makeCacheKey(sku, minQty);
  const ttl = options?.ttlMs ?? CONFIG.TTL_MS;
  
  // LRU eviction if at max size
  if (cache.size >= CONFIG.MAX_SIZE) {
    // Delete oldest entry (first in Map iteration order)
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  
  cache.set(key, {
    expiresAt: Date.now() + ttl,
    ok: result.ok,
    inventoryType: result.inventoryType,
    localQty: result.localQty,
    globalQty: result.globalQty,
    checkedAt: result.checkedAt,
    prewarmed: options?.prewarmed,
  });
}

/**
 * Bulk set multiple cache entries (for pre-warming).
 */
export function setCacheBulk(
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
): void {
  for (const entry of entries) {
    setCache(entry.sku, entry.minQty, entry.result, options);
  }
}

/**
 * Clear all cached data.
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Get cache statistics.
 */
export function getCacheStats(): CacheStats {
  let prewarmedEntries = 0;
  for (const entry of cache.values()) {
    if (entry.prewarmed) prewarmedEntries++;
  }
  
  const total = metrics.hits + metrics.misses;
  
  return {
    size: cache.size,
    maxSize: CONFIG.MAX_SIZE,
    ttlMs: CONFIG.TTL_MS,
    hits: metrics.hits,
    misses: metrics.misses,
    hitRate: total > 0 ? metrics.hits / total : 0,
    prewarmedEntries,
    prewarmedHits: metrics.prewarmedHits,
    lastPrewarmAt: metrics.lastPrewarmAt,
    lastPrewarmDurationMs: metrics.lastPrewarmDurationMs,
    lastPrewarmSkusWarmed: metrics.lastPrewarmSkusWarmed,
  };
}

/**
 * Reset metrics (for testing).
 */
export function resetMetrics(): void {
  metrics = {
    hits: 0,
    misses: 0,
    prewarmedHits: 0,
    lastPrewarmAt: null,
    lastPrewarmDurationMs: null,
    lastPrewarmSkusWarmed: null,
  };
}

/**
 * Record pre-warm completion.
 */
export function recordPrewarmComplete(durationMs: number, skusWarmed: number): void {
  metrics.lastPrewarmAt = new Date().toISOString();
  metrics.lastPrewarmDurationMs = durationMs;
  metrics.lastPrewarmSkusWarmed = skusWarmed;
}

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
  
  // Check cache first
  const cached = getCached(sku, opts.minQty);
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
    
    // Cache the result
    setCache(sku, opts.minQty, { ok, inventoryType, localQty, globalQty, checkedAt });
    
    return { ok, inventoryType, localQty, globalQty, checkedAt };
  } catch {
    // Cache negative result on error
    setCache(sku, opts.minQty, { ok: false, checkedAt });
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
