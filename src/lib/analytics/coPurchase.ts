/**
 * Co-Purchase Recommendation Service
 * 
 * Analyzes cart_add_events to find products frequently added together.
 * Powers "Customers also added" sections on PDPs and cart.
 * 
 * Key design principles:
 * - CACHED: Never query raw events in the request path
 * - REAL DATA: Only show relationships backed by actual behavior
 * - GRACEFUL: Degrade silently if no data available
 * - FILTERED: Only recommend relevant, compatible products
 * 
 * @created 2026-04-06
 */

import { db } from "@/lib/fitment-db/db";
import { cartAddEvents } from "@/lib/fitment-db/schema";
import { eq, and, gte, sql, ne } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

export type ProductType = "tire" | "wheel" | "accessory";

export interface CoAddedProduct {
  sku: string;
  productType: ProductType;
  productName: string;
  brand: string;
  coAddCount: number;
  /** How often this pair converts to purchase */
  conversionRate: number;
}

export interface ProductCoAddIndex {
  sku: string;
  productType: ProductType;
  alsoAdded: CoAddedProduct[];
}

export interface CachedCoAddData {
  updatedAt: Date;
  ttlMs: number;
  /** SKU -> list of co-added products */
  bySkuMap: Map<string, ProductCoAddIndex>;
  /** Stats for monitoring */
  stats: {
    totalProducts: number;
    totalRelationships: number;
    avgRelationshipsPerProduct: number;
  };
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  /** Cache TTL in milliseconds (15 minutes) */
  CACHE_TTL_MS: 15 * 60 * 1000,
  
  /** Days to look back for co-purchase data */
  LOOKBACK_DAYS: 60,
  
  /** Minimum co-add count to include in recommendations */
  MIN_CO_ADD_COUNT: 2,
  
  /** Maximum recommendations to return per product */
  MAX_RECOMMENDATIONS: 6,
  
  /** Maximum products to track in index */
  MAX_PRODUCTS: 3000,
  
  /** Minimum cart size for co-occurrence (2 = pairs) */
  MIN_CART_SIZE: 2,
};

// ============================================================================
// Accessory Category Mapping
// ============================================================================

/** Maps accessory categories to display-friendly names */
const ACCESSORY_CATEGORIES: Record<string, { name: string; icon: string }> = {
  tpms: { name: "TPMS Sensors", icon: "📡" },
  lug_nut: { name: "Lug Nuts", icon: "🔩" },
  lug_bolt: { name: "Lug Bolts", icon: "🔩" },
  hub_ring: { name: "Hub Rings", icon: "⚙️" },
  valve_stem: { name: "Valve Stems", icon: "🔧" },
};

// ============================================================================
// In-Memory Cache
// ============================================================================

let cache: CachedCoAddData | null = null;
let refreshPromise: Promise<void> | null = null;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Check if cache is valid
 */
function isCacheValid(): boolean {
  if (!cache) return false;
  const age = Date.now() - cache.updatedAt.getTime();
  return age < cache.ttlMs;
}

/**
 * Refresh the co-purchase cache from database
 * 
 * Strategy:
 * 1. Get all cart_add_events grouped by cartId
 * 2. For carts with 2+ items, build co-occurrence pairs
 * 3. Aggregate counts across all carts
 * 4. Store top relationships per SKU
 */
async function refreshCache(): Promise<CachedCoAddData> {
  const cutoffDate = new Date(Date.now() - CONFIG.LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  
  console.log(`[CoPurchase] Refreshing cache...`);
  const startTime = Date.now();

  try {
    // Step 1: Get all cart contents (grouped by cart)
    // Using a CTE for efficiency - get carts with 2+ items
    const cartContents = await db
      .select({
        cartId: cartAddEvents.cartId,
        sku: cartAddEvents.sku,
        productType: cartAddEvents.productType,
        productName: cartAddEvents.productName,
        brand: cartAddEvents.brand,
        purchased: cartAddEvents.purchased,
      })
      .from(cartAddEvents)
      .where(
        and(
          eq(cartAddEvents.isTest, false),
          gte(cartAddEvents.createdAt, cutoffDate)
        )
      );

    // Step 2: Group by cartId
    const cartMap = new Map<string, Array<{
      sku: string;
      productType: string;
      productName: string;
      brand: string;
      purchased: boolean | null;
    }>>();

    for (const row of cartContents) {
      const existing = cartMap.get(row.cartId) || [];
      existing.push({
        sku: row.sku,
        productType: row.productType,
        productName: row.productName,
        brand: row.brand,
        purchased: row.purchased,
      });
      cartMap.set(row.cartId, existing);
    }

    // Step 3: Build co-occurrence counts
    // Map: sku -> Map<coSku, {count, purchasedCount, product details}>
    const coOccurrenceMap = new Map<string, Map<string, {
      count: number;
      purchasedCount: number;
      productType: ProductType;
      productName: string;
      brand: string;
    }>>();

    for (const [, items] of cartMap) {
      // Only process carts with multiple unique SKUs
      const uniqueItems = new Map<string, typeof items[0]>();
      for (const item of items) {
        if (!uniqueItems.has(item.sku)) {
          uniqueItems.set(item.sku, item);
        }
      }

      if (uniqueItems.size < CONFIG.MIN_CART_SIZE) continue;

      // Build pairs
      const skus = Array.from(uniqueItems.keys());
      const allPurchased = items.every(i => i.purchased);

      for (let i = 0; i < skus.length; i++) {
        for (let j = 0; j < skus.length; j++) {
          if (i === j) continue;

          const skuA = skus[i];
          const skuB = skus[j];
          const itemB = uniqueItems.get(skuB)!;

          // Get or create the co-occurrence map for skuA
          if (!coOccurrenceMap.has(skuA)) {
            coOccurrenceMap.set(skuA, new Map());
          }
          const coMap = coOccurrenceMap.get(skuA)!;

          // Get or create the entry for skuB
          const existing = coMap.get(skuB);
          if (existing) {
            existing.count++;
            if (allPurchased) existing.purchasedCount++;
          } else {
            coMap.set(skuB, {
              count: 1,
              purchasedCount: allPurchased ? 1 : 0,
              productType: itemB.productType as ProductType,
              productName: itemB.productName,
              brand: itemB.brand,
            });
          }
        }
      }
    }

    // Step 4: Build the final index
    const bySkuMap = new Map<string, ProductCoAddIndex>();
    let totalRelationships = 0;

    for (const [sku, coMap] of coOccurrenceMap) {
      // Sort by count and take top N
      const sorted = Array.from(coMap.entries())
        .filter(([, data]) => data.count >= CONFIG.MIN_CO_ADD_COUNT)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, CONFIG.MAX_RECOMMENDATIONS);

      if (sorted.length === 0) continue;

      const alsoAdded: CoAddedProduct[] = sorted.map(([coSku, data]) => ({
        sku: coSku,
        productType: data.productType,
        productName: data.productName,
        brand: data.brand,
        coAddCount: data.count,
        conversionRate: data.count > 0 
          ? Math.round((data.purchasedCount / data.count) * 100) 
          : 0,
      }));

      // Determine the product type from the first co-add (we don't have it for the source SKU)
      const productType = alsoAdded[0]?.productType || "wheel";

      bySkuMap.set(sku, {
        sku,
        productType,
        alsoAdded,
      });

      totalRelationships += alsoAdded.length;
    }

    // Limit total products
    if (bySkuMap.size > CONFIG.MAX_PRODUCTS) {
      const entries = Array.from(bySkuMap.entries())
        .sort((a, b) => b[1].alsoAdded.length - a[1].alsoAdded.length)
        .slice(0, CONFIG.MAX_PRODUCTS);
      bySkuMap.clear();
      for (const [k, v] of entries) {
        bySkuMap.set(k, v);
      }
    }

    const newCache: CachedCoAddData = {
      updatedAt: new Date(),
      ttlMs: CONFIG.CACHE_TTL_MS,
      bySkuMap,
      stats: {
        totalProducts: bySkuMap.size,
        totalRelationships,
        avgRelationshipsPerProduct: bySkuMap.size > 0 
          ? Math.round(totalRelationships / bySkuMap.size * 10) / 10 
          : 0,
      },
    };

    cache = newCache;

    const elapsed = Date.now() - startTime;
    console.log(`[CoPurchase] Refreshed cache: ${bySkuMap.size} products, ${totalRelationships} relationships in ${elapsed}ms`);

    return newCache;
  } catch (err) {
    console.error(`[CoPurchase] Failed to refresh cache:`, err);
    
    // Return empty cache on error
    return {
      updatedAt: new Date(),
      ttlMs: CONFIG.CACHE_TTL_MS / 2, // Shorter TTL for retry
      bySkuMap: new Map(),
      stats: { totalProducts: 0, totalRelationships: 0, avgRelationshipsPerProduct: 0 },
    };
  }
}

/**
 * Get the cache (with auto-refresh)
 */
async function getCache(): Promise<CachedCoAddData> {
  if (isCacheValid()) {
    return cache!;
  }

  // Prevent thundering herd
  if (!refreshPromise) {
    refreshPromise = refreshCache().then(() => {
      refreshPromise = null;
    });
  }

  await refreshPromise;
  return cache || await refreshCache();
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get products frequently added with a specific SKU
 * 
 * @param sku - The product SKU to find co-additions for
 * @param options - Filtering options
 * @returns Array of co-added products, or empty array if no data
 */
export async function getCoAddedProducts(
  sku: string,
  options: {
    /** Maximum number of recommendations */
    limit?: number;
    /** Filter to specific product types */
    productTypes?: ProductType[];
    /** SKUs to exclude (e.g., already in cart) */
    excludeSkus?: string[];
  } = {}
): Promise<CoAddedProduct[]> {
  const { limit = 4, productTypes, excludeSkus = [] } = options;

  try {
    const cached = await getCache();
    const index = cached.bySkuMap.get(sku);
    
    if (!index || index.alsoAdded.length === 0) {
      return [];
    }

    let results = index.alsoAdded;

    // Filter by product type
    if (productTypes && productTypes.length > 0) {
      results = results.filter(p => productTypes.includes(p.productType));
    }

    // Exclude SKUs
    if (excludeSkus.length > 0) {
      const excludeSet = new Set(excludeSkus);
      results = results.filter(p => !excludeSet.has(p.sku));
    }

    return results.slice(0, limit);
  } catch (err) {
    console.error(`[CoPurchase] Error getting co-adds for ${sku}:`, err);
    return [];
  }
}

/**
 * Get products frequently added with ANY of the given SKUs
 * 
 * Useful for cart page - show items frequently added with anything in cart.
 * Deduplicates and ranks by total co-occurrence across all cart items.
 */
export async function getCoAddedForCart(
  cartSkus: string[],
  options: {
    limit?: number;
    productTypes?: ProductType[];
  } = {}
): Promise<CoAddedProduct[]> {
  const { limit = 4, productTypes } = options;

  if (cartSkus.length === 0) return [];

  try {
    const cached = await getCache();
    const cartSkuSet = new Set(cartSkus);
    
    // Aggregate co-adds from all cart items
    const aggregated = new Map<string, CoAddedProduct & { totalCount: number }>();

    for (const sku of cartSkus) {
      const index = cached.bySkuMap.get(sku);
      if (!index) continue;

      for (const coAdd of index.alsoAdded) {
        // Skip items already in cart
        if (cartSkuSet.has(coAdd.sku)) continue;

        // Filter by product type
        if (productTypes && productTypes.length > 0 && !productTypes.includes(coAdd.productType)) {
          continue;
        }

        const existing = aggregated.get(coAdd.sku);
        if (existing) {
          existing.totalCount += coAdd.coAddCount;
          // Keep highest conversion rate
          existing.conversionRate = Math.max(existing.conversionRate, coAdd.conversionRate);
        } else {
          aggregated.set(coAdd.sku, {
            ...coAdd,
            totalCount: coAdd.coAddCount,
          });
        }
      }
    }

    // Sort by total count and return
    return Array.from(aggregated.values())
      .sort((a, b) => b.totalCount - a.totalCount)
      .slice(0, limit)
      .map(({ totalCount, ...rest }) => ({
        ...rest,
        coAddCount: totalCount,
      }));
  } catch (err) {
    console.error(`[CoPurchase] Error getting cart co-adds:`, err);
    return [];
  }
}

/**
 * Check if we have co-add data for a SKU
 * 
 * Quick check without fetching full data.
 */
export async function hasCoAddData(sku: string): Promise<boolean> {
  try {
    const cached = await getCache();
    const index = cached.bySkuMap.get(sku);
    return !!index && index.alsoAdded.length > 0;
  } catch {
    return false;
  }
}

/**
 * Manually invalidate cache (for admin use)
 */
export function invalidateCache(): void {
  cache = null;
  console.log(`[CoPurchase] Cache invalidated`);
}

/**
 * Get cache status (for monitoring)
 */
export function getCacheStatus(): {
  valid: boolean;
  age: number | null;
  stats: CachedCoAddData["stats"] | null;
} {
  return {
    valid: isCacheValid(),
    age: cache ? Date.now() - cache.updatedAt.getTime() : null,
    stats: cache?.stats || null,
  };
}

// ============================================================================
// Export
// ============================================================================

export const coPurchaseService = {
  getCoAddedProducts,
  getCoAddedForCart,
  hasCoAddData,
  invalidateCache,
  getCacheStatus,
  CONFIG,
};

export default coPurchaseService;
