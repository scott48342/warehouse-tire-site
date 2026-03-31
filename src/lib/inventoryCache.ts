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
  cachedAt: number;
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
  
  const key = `${CACHE_KEY_PREFIX}${sku}`;
  const value = await redis.get<string>(key);
  
  if (!value) return null;
  
  try {
    const data = typeof value === "string" ? JSON.parse(value) : value;
    return {
      inventoryType: data.t || "UNKNOWN",
      totalQty: data.q || 0,
      msrp: data.m || null,
      cachedAt: data.u || 0,
    };
  } catch {
    return null;
  }
}

export async function getInventoryBulk(skus: string[]): Promise<Map<string, CachedInventory>> {
  const result = new Map<string, CachedInventory>();
  const redis = getRedis();
  if (!redis || skus.length === 0) return result;
  
  const keys = skus.map((sku) => `${CACHE_KEY_PREFIX}${sku}`);
  const values = await redis.mget<string[]>(...keys);
  
  for (let i = 0; i < skus.length; i++) {
    const value = values[i];
    if (!value) continue;
    
    try {
      const data = typeof value === "string" ? JSON.parse(value) : value;
      result.set(skus[i], {
        inventoryType: data.t || "UNKNOWN",
        totalQty: data.q || 0,
        msrp: data.m || null,
        cachedAt: data.u || 0,
      });
    } catch {
      // Skip invalid entries
    }
  }
  
  return result;
}
