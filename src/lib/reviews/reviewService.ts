/**
 * Tire Review Service
 * 
 * Centralized service for fetching and managing tire reviews.
 * Designed to be easily swapped for real data sources later.
 * 
 * ARCHITECTURE NOTES:
 * - This service is the SINGLE source of truth for review data
 * - All components should use this service, not inline logic
 * - Swap the implementation here to connect to real review sources:
 *   - Supplier review feeds (WheelPros, TireRack, etc.)
 *   - Manufacturer review APIs
 *   - Our own post-purchase review system
 *   - Licensed review platforms (Yotpo, Reviews.io, etc.)
 * 
 * CURRENT STATE: Placeholder-ready (no real data sources connected)
 * 
 * @created 2026-04-06
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ReviewData {
  /** Overall rating (1-5 scale) */
  rating: number;
  /** Total number of reviews */
  reviewCount: number;
  /** Where the review data comes from */
  source: ReviewSource;
  /** Whether this is real verified data vs. placeholder/estimated */
  hasRealData: boolean;
  /** Optional breakdown by category */
  breakdown?: ReviewBreakdown;
  /** Last updated timestamp */
  updatedAt?: string;
}

export interface ReviewBreakdown {
  comfort?: number;
  noise?: number;
  treadLife?: number;
  wetGrip?: number;
  dryGrip?: number;
  value?: number;
}

export type ReviewSource = 
  | 'verified'       // Our own verified purchase reviews
  | 'manufacturer'   // From tire manufacturer
  | 'supplier'       // From supplier feed (WheelPros, etc.)
  | 'aggregated'     // Aggregated from multiple sources
  | 'estimated'      // Estimated/inferred (not real data)
  | 'none';          // No data available

export interface ReviewLookupParams {
  /** Tire SKU/part number */
  sku?: string;
  /** Brand name */
  brand?: string;
  /** Model/line name */
  model?: string;
  /** Size (e.g., "275/55R20") */
  size?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Feature flags for review system
 * Toggle these to control behavior in different environments
 */
export const REVIEW_CONFIG = {
  /** Show placeholder text when no real data exists (dev only) */
  showPlaceholderInDev: false,
  
  /** Show estimated reviews based on brand reputation (experimental) */
  showEstimatedReviews: false,
  
  /** Minimum review count to display (prevents showing "1 review") */
  minReviewCountToDisplay: 5,
  
  /** Minimum rating to display (prevents showing very low ratings) */
  minRatingToDisplay: 3.0,
  
  /** Enable brand-level fallback when product-level unavailable */
  enableBrandFallback: false,
  
  /** Log review lookups for debugging */
  debugMode: process.env.NODE_ENV === 'development',
};

// ============================================================================
// MAIN SERVICE
// ============================================================================

/**
 * Look up review data for a tire
 * 
 * @param params - Lookup parameters (sku, brand, model, size)
 * @returns ReviewData or null if no trustworthy data available
 */
export async function getReviewData(params: ReviewLookupParams): Promise<ReviewData | null> {
  const { sku, brand, model } = params;
  
  if (REVIEW_CONFIG.debugMode) {
    console.log('[reviews] Looking up:', { sku, brand, model });
  }
  
  // STEP 1: Try product-level reviews (by SKU)
  if (sku) {
    const productReviews = await lookupProductReviews(sku);
    if (productReviews && isValidReviewData(productReviews)) {
      return productReviews;
    }
  }
  
  // STEP 2: Try model-level reviews (by brand + model)
  if (brand && model && REVIEW_CONFIG.enableBrandFallback) {
    const modelReviews = await lookupModelReviews(brand, model);
    if (modelReviews && isValidReviewData(modelReviews)) {
      return modelReviews;
    }
  }
  
  // STEP 3: Return null - UI should hide gracefully
  return null;
}

/**
 * Synchronous version for client components
 * Returns cached/static data only, no async lookups
 */
export function getReviewDataSync(params: ReviewLookupParams): ReviewData | null {
  // Currently returns null - real implementation would check a client-side cache
  // or use pre-fetched data from server components
  return null;
}

// ============================================================================
// DATA SOURCE ADAPTERS
// ============================================================================

/**
 * Look up reviews by product SKU
 * 
 * TODO: Connect to real data sources:
 * - WheelPros review feed
 * - Our own verified_reviews table
 * - Third-party review API
 */
async function lookupProductReviews(sku: string): Promise<ReviewData | null> {
  // PLACEHOLDER: No real data source connected yet
  // When real data is available, implement lookup here
  
  // Example future implementation:
  // const reviews = await db.query.tireReviews.findFirst({
  //   where: eq(tireReviews.sku, sku)
  // });
  // if (reviews) {
  //   return {
  //     rating: reviews.avgRating,
  //     reviewCount: reviews.totalCount,
  //     source: 'verified',
  //     hasRealData: true,
  //   };
  // }
  
  return null;
}

/**
 * Look up reviews by brand + model (aggregated across sizes)
 * 
 * TODO: Connect to real data sources
 */
async function lookupModelReviews(brand: string, model: string): Promise<ReviewData | null> {
  // PLACEHOLDER: No real data source connected yet
  return null;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Check if review data meets our quality thresholds
 */
function isValidReviewData(data: ReviewData): boolean {
  // Must have minimum review count
  if (data.reviewCount < REVIEW_CONFIG.minReviewCountToDisplay) {
    return false;
  }
  
  // Must have minimum rating (don't show very low ratings)
  if (data.rating < REVIEW_CONFIG.minRatingToDisplay) {
    return false;
  }
  
  // Must be from a trustworthy source
  if (data.source === 'estimated' && !REVIEW_CONFIG.showEstimatedReviews) {
    return false;
  }
  
  return true;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format review count for display
 * e.g., 2341 → "2.3K", 500 → "500"
 */
export function formatReviewCount(count: number): string {
  if (count >= 10000) {
    return `${(count / 1000).toFixed(0)}K+`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return `${count}`;
}

/**
 * Format rating for display
 * e.g., 4.567 → "4.6"
 */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/**
 * Get star display configuration
 * Returns which stars should be full, half, or empty
 */
export function getStarDisplay(rating: number): ('full' | 'half' | 'empty')[] {
  const rounded = Math.round(rating * 2) / 2; // Round to nearest 0.5
  const stars: ('full' | 'half' | 'empty')[] = [];
  
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(rounded)) {
      stars.push('full');
    } else if (i - 0.5 === rounded) {
      stars.push('half');
    } else {
      stars.push('empty');
    }
  }
  
  return stars;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  getReviewData,
  getReviewDataSync,
  formatReviewCount,
  formatRating,
  getStarDisplay,
  REVIEW_CONFIG,
};
