/**
 * Product Popularity Service
 * 
 * Provides cached, lightweight access to product popularity signals
 * derived from cart_add_events. Used by SRP and PDP for merchandising.
 * 
 * Key design principles:
 * - CACHED: Never query raw events in the request path
 * - LIGHTWEIGHT: Simple in-memory + optional Redis
 * - GRACEFUL: Degrade silently if data unavailable
 * - REAL: Only show signals backed by real data
 * 
 * @created 2026-04-06
 */

import { db } from "@/lib/fitment-db/db";
import { cartAddEvents } from "@/lib/fitment-db/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

export type ProductType = "tire" | "wheel";

export interface ProductPopularityData {
  sku: string;
  addToCartCount: number;
  uniqueCarts: number;
  purchases: number;
  conversionRate: number;
  lastAddedAt: Date | null;
  recentAdds24h: number;
  recentAdds72h: number;
}

export interface PopularitySignal {
  isPopular: boolean;
  isTrending: boolean;
  isBestValue: boolean;
  popularityRank: number | null;
  message: string | null;
}

export interface CachedPopularityIndex {
  productType: ProductType;
  updatedAt: Date;
  ttlMs: number;
  /** SKU -> popularity data */
  bySkuMap: Map<string, ProductPopularityData>;
  /** Sorted by addToCartCount desc */
  rankedSkus: string[];
  /** Stats for normalization */
  stats: {
    maxAddToCart: number;
    medianAddToCart: number;
    p90AddToCart: number;
    totalProducts: number;
  };
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  /** Cache TTL in milliseconds (10 minutes) */
  CACHE_TTL_MS: 10 * 60 * 1000,
  
  /** Days to look back for popularity */
  LOOKBACK_DAYS: 30,
  
  /** Minimum add-to-cart count to be considered "popular" */
  MIN_POPULAR_COUNT: 3,
  
  /** Top percentile to mark as "popular" */
  POPULAR_PERCENTILE: 0.20, // Top 20%
  
  /** Recent hours for "trending" detection */
  TRENDING_HOURS_24: 24,
  TRENDING_HOURS_72: 72,
  
  /** Minimum recent adds to be "trending" */
  MIN_TRENDING_ADDS_24H: 2,
  MIN_TRENDING_ADDS_72H: 5,
  
  /** Max products to track per type */
  MAX_PRODUCTS: 5000,
};

// ============================================================================
// In-Memory Cache
// ============================================================================

const cache = {
  tire: null as CachedPopularityIndex | null,
  wheel: null as CachedPopularityIndex | null,
};

let refreshPromise: Promise<void> | null = null;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Check if cache is valid
 */
function isCacheValid(productType: ProductType): boolean {
  const cached = cache[productType];
  if (!cached) return false;
  
  const age = Date.now() - cached.updatedAt.getTime();
  return age < cached.ttlMs;
}

/**
 * Refresh the popularity cache from database
 * 
 * Uses a single aggregation query for efficiency.
 * Called automatically when cache expires.
 */
async function refreshCache(productType: ProductType): Promise<CachedPopularityIndex> {
  const cutoffDate = new Date(Date.now() - CONFIG.LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const cutoff24h = new Date(Date.now() - CONFIG.TRENDING_HOURS_24 * 60 * 60 * 1000);
  const cutoff72h = new Date(Date.now() - CONFIG.TRENDING_HOURS_72 * 60 * 60 * 1000);

  console.log(`[ProductPopularity] Refreshing ${productType} cache...`);
  const startTime = Date.now();

  try {
    // Main aggregation query
    const results = await db
      .select({
        sku: cartAddEvents.sku,
        addToCartCount: sql<number>`SUM(${cartAddEvents.quantity})::int`,
        uniqueCarts: sql<number>`COUNT(DISTINCT ${cartAddEvents.cartId})::int`,
        purchases: sql<number>`SUM(CASE WHEN ${cartAddEvents.purchased} THEN ${cartAddEvents.quantity} ELSE 0 END)::int`,
        lastAddedAt: sql<Date>`MAX(${cartAddEvents.createdAt})`,
        recentAdds24h: sql<number>`SUM(CASE WHEN ${cartAddEvents.createdAt} >= ${cutoff24h} THEN ${cartAddEvents.quantity} ELSE 0 END)::int`,
        recentAdds72h: sql<number>`SUM(CASE WHEN ${cartAddEvents.createdAt} >= ${cutoff72h} THEN ${cartAddEvents.quantity} ELSE 0 END)::int`,
      })
      .from(cartAddEvents)
      .where(
        and(
          eq(cartAddEvents.productType, productType),
          eq(cartAddEvents.isTest, false),
          gte(cartAddEvents.createdAt, cutoffDate)
        )
      )
      .groupBy(cartAddEvents.sku)
      .orderBy(desc(sql`SUM(${cartAddEvents.quantity})`))
      .limit(CONFIG.MAX_PRODUCTS);

    // Build the index
    const bySkuMap = new Map<string, ProductPopularityData>();
    const rankedSkus: string[] = [];
    const addToCartCounts: number[] = [];

    for (const row of results) {
      const addToCartCount = Number(row.addToCartCount) || 0;
      const purchases = Number(row.purchases) || 0;
      
      const data: ProductPopularityData = {
        sku: row.sku,
        addToCartCount,
        uniqueCarts: Number(row.uniqueCarts) || 0,
        purchases,
        conversionRate: addToCartCount > 0 ? Math.round((purchases / addToCartCount) * 100) : 0,
        lastAddedAt: row.lastAddedAt || null,
        recentAdds24h: Number(row.recentAdds24h) || 0,
        recentAdds72h: Number(row.recentAdds72h) || 0,
      };

      bySkuMap.set(row.sku, data);
      rankedSkus.push(row.sku);
      addToCartCounts.push(addToCartCount);
    }

    // Calculate stats for normalization
    const sortedCounts = [...addToCartCounts].sort((a, b) => a - b);
    const stats = {
      maxAddToCart: sortedCounts.length > 0 ? sortedCounts[sortedCounts.length - 1] : 0,
      medianAddToCart: sortedCounts.length > 0 ? sortedCounts[Math.floor(sortedCounts.length / 2)] : 0,
      p90AddToCart: sortedCounts.length > 0 ? sortedCounts[Math.floor(sortedCounts.length * 0.9)] : 0,
      totalProducts: sortedCounts.length,
    };

    const index: CachedPopularityIndex = {
      productType,
      updatedAt: new Date(),
      ttlMs: CONFIG.CACHE_TTL_MS,
      bySkuMap,
      rankedSkus,
      stats,
    };

    // Update cache
    cache[productType] = index;

    const elapsed = Date.now() - startTime;
    console.log(`[ProductPopularity] Refreshed ${productType} cache: ${bySkuMap.size} products in ${elapsed}ms`);

    return index;
  } catch (err) {
    console.error(`[ProductPopularity] Failed to refresh ${productType} cache:`, err);
    
    // Return empty index on error
    return {
      productType,
      updatedAt: new Date(),
      ttlMs: CONFIG.CACHE_TTL_MS / 2, // Shorter TTL on error for retry
      bySkuMap: new Map(),
      rankedSkus: [],
      stats: { maxAddToCart: 0, medianAddToCart: 0, p90AddToCart: 0, totalProducts: 0 },
    };
  }
}

/**
 * Get the popularity index (with auto-refresh)
 */
async function getIndex(productType: ProductType): Promise<CachedPopularityIndex> {
  if (isCacheValid(productType)) {
    return cache[productType]!;
  }

  // Prevent thundering herd
  if (!refreshPromise) {
    refreshPromise = refreshCache(productType).then(() => {
      refreshPromise = null;
    });
  }

  await refreshPromise;
  return cache[productType] || await refreshCache(productType);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get popularity data for a single SKU
 * 
 * Returns null if no data available (graceful degradation).
 */
export async function getProductPopularity(
  productType: ProductType,
  sku: string
): Promise<ProductPopularityData | null> {
  try {
    const index = await getIndex(productType);
    return index.bySkuMap.get(sku) || null;
  } catch (err) {
    console.error(`[ProductPopularity] Error getting data for ${sku}:`, err);
    return null;
  }
}

/**
 * Get popularity data for multiple SKUs (batch)
 * 
 * Returns a Map with only SKUs that have data.
 */
export async function getProductPopularityBatch(
  productType: ProductType,
  skus: string[]
): Promise<Map<string, ProductPopularityData>> {
  try {
    const index = await getIndex(productType);
    const result = new Map<string, ProductPopularityData>();
    
    for (const sku of skus) {
      const data = index.bySkuMap.get(sku);
      if (data) {
        result.set(sku, data);
      }
    }
    
    return result;
  } catch (err) {
    console.error(`[ProductPopularity] Error getting batch data:`, err);
    return new Map();
  }
}

/**
 * Get merchandising signal for a product
 * 
 * Determines if product should show "Popular", "Trending", etc.
 * Returns null message if no signal applies (graceful degradation).
 */
export async function getPopularitySignal(
  productType: ProductType,
  sku: string
): Promise<PopularitySignal> {
  const defaultSignal: PopularitySignal = {
    isPopular: false,
    isTrending: false,
    isBestValue: false,
    popularityRank: null,
    message: null,
  };

  try {
    const index = await getIndex(productType);
    const data = index.bySkuMap.get(sku);
    
    if (!data || data.addToCartCount < CONFIG.MIN_POPULAR_COUNT) {
      return defaultSignal;
    }

    const { stats } = index;
    const rank = index.rankedSkus.indexOf(sku);
    const percentile = stats.totalProducts > 0 ? rank / stats.totalProducts : 1;

    // Determine "Popular"
    const isPopular = percentile <= CONFIG.POPULAR_PERCENTILE && data.addToCartCount >= CONFIG.MIN_POPULAR_COUNT;

    // Determine "Trending"
    const isTrending = 
      data.recentAdds24h >= CONFIG.MIN_TRENDING_ADDS_24H ||
      data.recentAdds72h >= CONFIG.MIN_TRENDING_ADDS_72H;

    // Build message (prioritize trending over popular)
    let message: string | null = null;
    if (isTrending && data.recentAdds24h >= CONFIG.MIN_TRENDING_ADDS_24H) {
      message = "Trending — gaining popularity";
    } else if (isPopular) {
      message = "Popular — frequently chosen by customers";
    } else if (isTrending) {
      message = "Trending this week";
    }

    return {
      isPopular,
      isTrending,
      isBestValue: false, // Computed separately with price data
      popularityRank: rank >= 0 ? rank + 1 : null,
      message,
    };
  } catch (err) {
    console.error(`[ProductPopularity] Error getting signal for ${sku}:`, err);
    return defaultSignal;
  }
}

/**
 * Get popularity signals for multiple SKUs (batch)
 * 
 * More efficient than calling getPopularitySignal in a loop.
 */
export async function getPopularitySignalsBatch(
  productType: ProductType,
  skus: string[]
): Promise<Map<string, PopularitySignal>> {
  const result = new Map<string, PopularitySignal>();
  
  try {
    const index = await getIndex(productType);
    const { stats } = index;

    for (const sku of skus) {
      const data = index.bySkuMap.get(sku);
      
      if (!data || data.addToCartCount < CONFIG.MIN_POPULAR_COUNT) {
        continue; // Skip - no signal
      }

      const rank = index.rankedSkus.indexOf(sku);
      const percentile = stats.totalProducts > 0 ? rank / stats.totalProducts : 1;

      const isPopular = percentile <= CONFIG.POPULAR_PERCENTILE && data.addToCartCount >= CONFIG.MIN_POPULAR_COUNT;
      const isTrending = 
        data.recentAdds24h >= CONFIG.MIN_TRENDING_ADDS_24H ||
        data.recentAdds72h >= CONFIG.MIN_TRENDING_ADDS_72H;

      let message: string | null = null;
      if (isTrending && data.recentAdds24h >= CONFIG.MIN_TRENDING_ADDS_24H) {
        message = "Trending — gaining popularity";
      } else if (isPopular) {
        message = "Popular — frequently chosen by customers";
      } else if (isTrending) {
        message = "Trending this week";
      }

      if (message) {
        result.set(sku, {
          isPopular,
          isTrending,
          isBestValue: false,
          popularityRank: rank >= 0 ? rank + 1 : null,
          message,
        });
      }
    }

    return result;
  } catch (err) {
    console.error(`[ProductPopularity] Error getting batch signals:`, err);
    return result;
  }
}

/**
 * Compute "Best Value" score combining price and popularity
 * 
 * Formula: valueScore = (priceScore * 0.5) + (popularityScore * 0.3) + (conversionScore * 0.2)
 * 
 * @param price - Product price
 * @param minPrice - Minimum price in result set
 * @param maxPrice - Maximum price in result set
 * @param popularityData - Popularity data from getProductPopularity
 * @param maxAddToCart - Max add-to-cart count in result set (for normalization)
 */
export function computeBestValueScore(
  price: number,
  minPrice: number,
  maxPrice: number,
  popularityData: ProductPopularityData | null,
  maxAddToCart: number
): number {
  // Price score: lower is better (inverted normalization)
  const priceRange = maxPrice - minPrice;
  const priceScore = priceRange > 0 
    ? 1 - ((price - minPrice) / priceRange)
    : 0.5;

  // Popularity score: higher add-to-cart is better
  const popularityScore = popularityData && maxAddToCart > 0
    ? popularityData.addToCartCount / maxAddToCart
    : 0;

  // Conversion score: higher conversion rate is better
  const conversionScore = popularityData
    ? popularityData.conversionRate / 100
    : 0;

  // Weighted combination
  const valueScore = 
    (priceScore * 0.5) + 
    (popularityScore * 0.3) + 
    (conversionScore * 0.2);

  return Math.round(valueScore * 100) / 100;
}

/**
 * Get top popular SKUs for a product type
 * 
 * Useful for "Popular Products" sections.
 */
export async function getTopPopularSkus(
  productType: ProductType,
  limit: number = 20
): Promise<string[]> {
  try {
    const index = await getIndex(productType);
    return index.rankedSkus.slice(0, limit);
  } catch (err) {
    console.error(`[ProductPopularity] Error getting top SKUs:`, err);
    return [];
  }
}

/**
 * Manually invalidate cache (for admin use)
 */
export function invalidateCache(productType?: ProductType): void {
  if (productType) {
    cache[productType] = null;
    console.log(`[ProductPopularity] Invalidated ${productType} cache`);
  } else {
    cache.tire = null;
    cache.wheel = null;
    console.log(`[ProductPopularity] Invalidated all caches`);
  }
}

/**
 * Get cache status (for monitoring)
 */
export function getCacheStatus(): {
  tire: { valid: boolean; age: number | null; size: number };
  wheel: { valid: boolean; age: number | null; size: number };
} {
  return {
    tire: {
      valid: isCacheValid("tire"),
      age: cache.tire ? Date.now() - cache.tire.updatedAt.getTime() : null,
      size: cache.tire?.bySkuMap.size || 0,
    },
    wheel: {
      valid: isCacheValid("wheel"),
      age: cache.wheel ? Date.now() - cache.wheel.updatedAt.getTime() : null,
      size: cache.wheel?.bySkuMap.size || 0,
    },
  };
}

// ============================================================================
// Export
// ============================================================================

export const productPopularityService = {
  getProductPopularity,
  getProductPopularityBatch,
  getPopularitySignal,
  getPopularitySignalsBatch,
  computeBestValueScore,
  getTopPopularSkus,
  invalidateCache,
  getCacheStatus,
  CONFIG,
};

export default productPopularityService;
