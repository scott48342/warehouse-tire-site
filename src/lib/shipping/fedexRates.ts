/**
 * FedEx Live Rate Integration
 * 
 * Calls FedEx Rate API for accurate shipping quotes on heavy/oversized items.
 * Results are cached in Redis to minimize API calls.
 * 
 * @created 2026-09-03
 */

import { getShippingRates, type PackageInfo, type ShippingRate } from '@/lib/fedex';
import { isOversizedTireSize } from './shippingService';
import { Redis } from '@upstash/redis';

// Initialize Redis client (same pattern as sharedCache.ts)
let redis: Redis | null = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch (e) {
  console.warn('[fedex] Redis init failed, caching disabled:', e);
}

// =============================================================================
// Configuration
// =============================================================================

/** Cache TTL for FedEx rates (1 hour) */
const RATE_CACHE_TTL = 60 * 60;

/** Minimum item weight (lbs) to trigger live FedEx lookup */
export const FEDEX_LOOKUP_WEIGHT_THRESHOLD = 40;

/** Origin warehouses - we ship from multiple locations */
export const SHIP_ORIGINS = {
  // Primary: Warehouse Tire Pontiac
  pontiac: {
    postalCode: '48340',
    stateOrProvinceCode: 'MI',
    city: 'Pontiac',
    countryCode: 'US',
    residential: false,
  },
  // US AutoForce - Appleton, WI (for drop-ship tires)
  usaf_appleton: {
    postalCode: '54913',
    stateOrProvinceCode: 'WI', 
    city: 'Appleton',
    countryCode: 'US',
    residential: false,
  },
} as const;

// =============================================================================
// Types
// =============================================================================

export interface CartItemForShipping {
  type: 'wheel' | 'tire' | 'accessory';
  quantity: number;
  weightLbs?: number;
  diameterInches?: number;
  widthInches?: number;
  /** If true, freight is included in price (skip shipping calc) */
  freeShipping?: boolean;
  /** Source/supplier - determines origin warehouse */
  source?: string;
  /** Tire size label for LT/oversized detection */
  sizeLabel?: string;
}

export interface FedExRateResult {
  success: boolean;
  groundRate: number | null;
  expeditedRate: number | null;
  transitDays: number | null;
  serviceName: string | null;
  fromCache: boolean;
  error?: string;
}

// =============================================================================
// Cache Helpers
// =============================================================================

function buildCacheKey(
  originZip: string,
  destZip: string,
  packages: PackageInfo[]
): string {
  // Create a deterministic key from the shipment details
  const pkgHash = packages
    .map(p => `${p.weight}-${p.length}x${p.width}x${p.height}`)
    .sort()
    .join('|');
  return `fedex:rate:${originZip}:${destZip}:${pkgHash}`;
}

async function getCachedRate(key: string): Promise<FedExRateResult | null> {
  try {
    if (!redis) return null;
    const cached = await redis.get(key);
    if (cached && typeof cached === 'string') {
      return JSON.parse(cached);
    }
    if (cached && typeof cached === 'object') {
      return cached as FedExRateResult;
    }
  } catch (e) {
    console.warn('[fedex] Cache read error:', e);
  }
  return null;
}

async function setCachedRate(key: string, result: FedExRateResult): Promise<void> {
  try {
    if (!redis) return;
    await redis.set(key, JSON.stringify(result), { ex: RATE_CACHE_TTL });
  } catch (e) {
    console.warn('[fedex] Cache write error:', e);
  }
}

// =============================================================================
// Package Conversion
// =============================================================================

/**
 * Convert cart items to FedEx package specs
 */
export function cartItemsToPackages(items: CartItemForShipping[]): PackageInfo[] {
  const packages: PackageInfo[] = [];
  
  for (const item of items) {
    // Skip items with free shipping (freight included)
    if (item.freeShipping) continue;
    
    // Skip accessories (negligible shipping)
    if (item.type === 'accessory') continue;
    
    const qty = item.quantity || 1;
    
    if (item.type === 'tire') {
      // Tire package dimensions
      // Diameter determines length, width ~12" when boxed flat
      const diameter = item.diameterInches || 30;
      
      // Estimate weight based on tire size if not provided
      // LT/flotation/oversized tires typically 45-70 lbs
      // Passenger tires typically 20-35 lbs
      let weight = item.weightLbs;
      if (!weight) {
        const isOversized = isOversizedTireSize(item.sizeLabel);
        weight = isOversized ? 55 : 25; // Conservative estimate for LT tires
      }
      
      for (let i = 0; i < qty; i++) {
        packages.push({
          weight,
          length: Math.ceil(diameter),
          width: 12,
          height: 12,
        });
      }
    } else if (item.type === 'wheel') {
      // Wheel package dimensions
      // Square box based on diameter, ~10" deep
      const diameter = item.diameterInches || 20;
      const weight = item.weightLbs || 28;
      
      for (let i = 0; i < qty; i++) {
        packages.push({
          weight,
          length: Math.ceil(diameter) + 4, // Padding
          width: Math.ceil(diameter) + 4,
          height: 10,
        });
      }
    }
  }
  
  return packages;
}

/**
 * Check if cart has items heavy enough to warrant FedEx lookup
 */
export function shouldUseFedExLookup(items: CartItemForShipping[]): boolean {
  for (const item of items) {
    if (item.freeShipping) continue;
    if (item.type === 'accessory') continue;
    
    const weight = item.weightLbs || 0;
    if (weight >= FEDEX_LOOKUP_WEIGHT_THRESHOLD) {
      return true;
    }
    
    // Trigger for LT/oversized tires even if weight unknown
    // (they're almost always 45+ lbs)
    if (item.type === 'tire') {
      // Check by size label (LT prefix, flotation, large metric)
      if (isOversizedTireSize(item.sizeLabel)) {
        return true;
      }
      // Check by diameter (32"+ tires are always heavy)
      if (item.diameterInches && item.diameterInches >= 32) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Determine origin warehouse based on item sources
 */
export function getOriginForItems(items: CartItemForShipping[]): typeof SHIP_ORIGINS[keyof typeof SHIP_ORIGINS] {
  // Check if any items are from USAF
  const hasUsafItem = items.some(
    item => item.source?.toLowerCase().includes('usautoforce') || 
            item.source?.toLowerCase().includes('usaf')
  );
  
  // If mixed sources or USAF, use Pontiac (we may consolidate)
  // For pure USAF drop-ship, could use their warehouse
  // For now, default to Pontiac as primary
  return SHIP_ORIGINS.pontiac;
}

// =============================================================================
// Main Rate Lookup
// =============================================================================

/**
 * Get live FedEx shipping rate for cart items
 * 
 * @param destZip - Destination ZIP code
 * @param destState - Destination state code
 * @param items - Cart items with weight/dimension info
 * @returns FedEx rate result with ground rate and transit time
 */
export async function getFedExShippingRate(
  destZip: string,
  destState: string,
  items: CartItemForShipping[]
): Promise<FedExRateResult> {
  // Convert items to packages
  const packages = cartItemsToPackages(items);
  
  if (packages.length === 0) {
    return {
      success: true,
      groundRate: 0,
      expeditedRate: null,
      transitDays: null,
      serviceName: null,
      fromCache: false,
    };
  }
  
  // Determine origin
  const origin = getOriginForItems(items);
  
  // Check cache first
  const cacheKey = buildCacheKey(origin.postalCode, destZip, packages);
  const cached = await getCachedRate(cacheKey);
  if (cached) {
    return { ...cached, fromCache: true };
  }
  
  try {
    // Call FedEx API
    const rates = await getShippingRates({
      origin: {
        city: origin.city,
        stateOrProvinceCode: origin.stateOrProvinceCode,
        postalCode: origin.postalCode,
        countryCode: origin.countryCode,
        residential: false,
      },
      destination: {
        city: '',
        stateOrProvinceCode: destState,
        postalCode: destZip,
        countryCode: 'US',
        residential: true,
      },
      packages,
    });
    
    // Find ground rate (cheapest practical option)
    const groundRate = rates.find(
      r => r.serviceType === 'FEDEX_GROUND' || r.serviceType === 'GROUND_HOME_DELIVERY'
    );
    
    // Find expedited option (Express Saver or 2-Day)
    const expeditedRate = rates.find(
      r => r.serviceType === 'FEDEX_EXPRESS_SAVER' || r.serviceType === 'FEDEX_2_DAY'
    );
    
    const result: FedExRateResult = {
      success: true,
      groundRate: groundRate?.totalCharge || null,
      expeditedRate: expeditedRate?.totalCharge || null,
      transitDays: groundRate?.transitDays || null,
      serviceName: groundRate?.serviceName || null,
      fromCache: false,
    };
    
    // Cache successful result
    await setCachedRate(cacheKey, result);
    
    return result;
    
  } catch (error: any) {
    console.error('[fedex] Rate lookup failed:', error);
    
    return {
      success: false,
      groundRate: null,
      expeditedRate: null,
      transitDays: null,
      serviceName: null,
      fromCache: false,
      error: error.message || 'FedEx rate lookup failed',
    };
  }
}

/**
 * Get shipping rate with automatic fallback
 * 
 * Tries FedEx first, falls back to zone-based estimate if API fails
 */
export async function getShippingRateWithFallback(
  destZip: string,
  destState: string,
  items: CartItemForShipping[],
  fallbackEstimate: number
): Promise<{
  amount: number;
  source: 'fedex' | 'estimate';
  transitDays: number | null;
  serviceName: string | null;
}> {
  // Only use FedEx for heavy items
  if (!shouldUseFedExLookup(items)) {
    return {
      amount: fallbackEstimate,
      source: 'estimate',
      transitDays: null,
      serviceName: null,
    };
  }
  
  const fedexResult = await getFedExShippingRate(destZip, destState, items);
  
  if (fedexResult.success && fedexResult.groundRate !== null) {
    return {
      amount: Math.ceil(fedexResult.groundRate),
      source: 'fedex',
      transitDays: fedexResult.transitDays,
      serviceName: fedexResult.serviceName,
    };
  }
  
  // Fallback to estimate
  console.warn('[fedex] Using fallback estimate due to:', fedexResult.error);
  return {
    amount: fallbackEstimate,
    source: 'estimate',
    transitDays: null,
    serviceName: null,
  };
}

// =============================================================================
// Exports
// =============================================================================

export const fedexRates = {
  getFedExShippingRate,
  getShippingRateWithFallback,
  shouldUseFedExLookup,
  cartItemsToPackages,
  getOriginForItems,
  SHIP_ORIGINS,
  FEDEX_LOOKUP_WEIGHT_THRESHOLD,
};

export default fedexRates;
