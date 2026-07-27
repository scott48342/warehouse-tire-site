/**
 * Inventory Cache - Redis lookups for wheel inventory data
 * 
 * This module ONLY handles Redis reads - no SFTP dependencies.
 * The SFTP sync happens in inventorySync.ts (only used by cron).
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Redis } from "@upstash/redis";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type CachedInventory = {
  inventoryType: string;
  totalQty: number;
  msrp: number | null;
  mapPrice: number | null;
  cachedAt: number;
};

export type InventoryBulkResult = {
  data: Map<string, CachedInventory>;
  /** True if Redis failed - caller should bypass inventory filtering */
  redisError: boolean;
  errorMessage?: string;
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

// Redis key prefix for inventory data (must match inventorySync.ts)
const CACHE_KEY_PREFIX = "wt:inv:";

// ═══════════════════════════════════════════════════════════════════════════════
// REDIS CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    return null;
  }
  
  return new Redis({ url, token });
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY LOOKUPS
// ═══════════════════════════════════════════════════════════════════════════════

export async function getInventoryForSku(sku: string): Promise<CachedInventory | null> {
  const redis = getRedis();
  if (!redis) return null;
  
  try {
    const key = `${CACHE_KEY_PREFIX}${sku}`;
    const value = await redis.get<string>(key);
    
    if (!value) return null;
    
    const data = typeof value === "string" ? JSON.parse(value) : value;
    return {
      inventoryType: data.t || "UNKNOWN",
      totalQty: data.q || 0,
      msrp: data.m || null,
      mapPrice: data.p || null,
      cachedAt: data.u || 0,
    };
  } catch (err: any) {
    // Gracefully handle Redis failures (rate limits, connection issues, etc.)
    console.warn(`[inventoryCache] Redis error for SKU ${sku}: ${err?.message || err}`);
    return null;
  }
}

/**
 * Fetch inventory for multiple SKUs.
 * Returns { data, redisError } - if redisError is true, caller should bypass inventory filtering.
 */
export async function getInventoryBulk(skus: string[]): Promise<InventoryBulkResult> {
  const result: InventoryBulkResult = {
    data: new Map<string, CachedInventory>(),
    redisError: false,
  };
  
  const redis = getRedis();
  if (!redis || skus.length === 0) return result;
  
  try {
    const keys = skus.map((sku) => `${CACHE_KEY_PREFIX}${sku}`);
    const values = await redis.mget<string[]>(...keys);
    
    // Check if the response itself is an error object (Upstash returns errors this way sometimes)
    if (values && typeof values === 'object' && 'error' in (values as any)) {
      const errorMsg = (values as any).error || 'Unknown Redis error';
      console.warn(`[inventoryCache] Redis bulk error response for ${skus.length} SKUs: ${errorMsg}`);
      result.redisError = true;
      result.errorMessage = errorMsg;
      return result;
    }
    
    // Check if values is not an array (unexpected response format)
    if (!Array.isArray(values)) {
      console.warn(`[inventoryCache] Unexpected Redis response type: ${typeof values}`);
      result.redisError = true;
      result.errorMessage = 'Unexpected Redis response format';
      return result;
    }
    
    for (let i = 0; i < skus.length; i++) {
      const value = values[i];
      if (!value) continue;
      
      try {
        const data = typeof value === "string" ? JSON.parse(value) : value;
        result.data.set(skus[i], {
          inventoryType: data.t || "UNKNOWN",
          totalQty: data.q || 0,
          msrp: data.m || null,
          mapPrice: data.p || null,
          cachedAt: data.u || 0,
        });
      } catch {
        // Skip invalid entries
      }
    }
  } catch (err: any) {
    // Gracefully handle Redis failures (rate limits, connection issues, etc.)
    // Set redisError flag so caller can bypass inventory filtering
    const errorMsg = err?.message || String(err);
    console.warn(`[inventoryCache] Redis bulk error for ${skus.length} SKUs: ${errorMsg}`);
    result.redisError = true;
    result.errorMessage = errorMsg;
  }
  
  return result;
}
