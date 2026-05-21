/**
 * UTV/Powersports Product Filter
 * 
 * P0 FIX: Prevents UTV/ATV/SxS wheels from appearing in automotive searches.
 * 
 * UTV wheels share 5x4.5 (5x114.3) bolt pattern with many classic muscle cars,
 * but they are NOT suitable for automotive use - different load ratings, sizing,
 * and intended application.
 * 
 * CRITICAL: This filter MUST be applied BEFORE results are shown to customers.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// UTV DETECTION PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Keywords that indicate a UTV/ATV/powersports wheel
 * Must be matched case-insensitively
 */
const UTV_KEYWORDS = [
  'UTV',
  'ATV',
  'SXS',
  'SIDE-BY-SIDE',
  'SIDE BY SIDE',
  'SIDEBYSIDE',
  'POLARIS',
  'CAN-AM',
  'CANAM',
  'KAWASAKI MULE',
  'RZRE',     // RZR variant
  'RANGER',   // Polaris Ranger
  'MAVERICK', // Can-Am Maverick
  'TERYX',    // Kawasaki Teryx
  'WILDCAT',  // Arctic Cat Wildcat
  'TALON',    // Honda Talon
  'PIONEER',  // Honda Pioneer
  'YXZ',      // Yamaha YXZ
  'VIKING',   // Yamaha Viking
  'WOLVERINE',// Yamaha Wolverine
] as const;

/**
 * Brand codes that are exclusively powersports
 */
const UTV_EXCLUSIVE_BRANDS = new Set([
  'MSA',  // MSA Offroad - primarily UTV
  // Add more as discovered
]);

/**
 * Brand + model combinations that are UTV despite brand making automotive wheels
 */
const UTV_MODEL_PATTERNS: Array<{ brand: string; patterns: string[] }> = [
  { brand: 'MSA', patterns: ['THUNDERLIPS', 'SPARK', 'CLUTCH', 'CANNON', 'DIESEL'] },
  { brand: 'ITP', patterns: ['*'] }, // ITP is all powersports
  { brand: 'STI', patterns: ['*'] }, // STI is all powersports
];

// ═══════════════════════════════════════════════════════════════════════════════
// UTV DETECTION LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

export interface UTVFilterInput {
  sku?: string;
  productDesc?: string;
  brandCode?: string;
  brandDesc?: string;
  style?: string;
  category?: string;
  application?: string;
}

export interface UTVFilterResult {
  isUTV: boolean;
  reason: string | null;
  matchedKeyword: string | null;
}

/**
 * Check if a product is a UTV/ATV wheel that should be excluded from automotive results
 */
export function isUTVProduct(input: UTVFilterInput): UTVFilterResult {
  // Build searchable text from all available fields
  const searchText = [
    input.sku,
    input.productDesc,
    input.brandDesc,
    input.style,
    input.category,
    input.application,
  ].filter(Boolean).join(' ').toUpperCase();
  
  const brandCode = (input.brandCode || '').toUpperCase();
  const style = (input.style || '').toUpperCase();
  
  // 1. Check for UTV keywords in any text field
  for (const keyword of UTV_KEYWORDS) {
    if (searchText.includes(keyword)) {
      return {
        isUTV: true,
        reason: `Product contains UTV keyword: "${keyword}"`,
        matchedKeyword: keyword,
      };
    }
  }
  
  // 2. Check if brand is exclusively powersports
  if (UTV_EXCLUSIVE_BRANDS.has(brandCode)) {
    // For UTV-exclusive brands, check if this specific model is automotive
    // (some MSA wheels are labeled "UTV" explicitly, others might not be)
    // Default to UTV if any ambiguity
    return {
      isUTV: true,
      reason: `Brand "${brandCode}" is primarily powersports`,
      matchedKeyword: brandCode,
    };
  }
  
  // 3. Check brand + model patterns
  for (const { brand, patterns } of UTV_MODEL_PATTERNS) {
    if (brandCode === brand || brandCode.includes(brand)) {
      if (patterns.includes('*')) {
        return {
          isUTV: true,
          reason: `Brand "${brand}" is exclusively powersports`,
          matchedKeyword: brand,
        };
      }
      for (const pattern of patterns) {
        if (style.includes(pattern)) {
          return {
            isUTV: true,
            reason: `Model "${pattern}" from brand "${brand}" is UTV`,
            matchedKeyword: pattern,
          };
        }
      }
    }
  }
  
  // 4. Check for specific MSA Offroad UTV wheels (most common false positive)
  if (searchText.includes('MSA OFFROAD') && (
    searchText.includes('20X7') || // UTV sizing
    searchText.includes('14X7') ||
    searchText.includes('15X7') ||
    searchText.includes('18X7')
  )) {
    // MSA 20x7 wheels are almost always UTV
    return {
      isUTV: true,
      reason: 'MSA Offroad wheel with UTV-typical sizing (20x7, 14x7, 15x7, or 18x7)',
      matchedKeyword: 'MSA+UTV_SIZE',
    };
  }
  
  return {
    isUTV: false,
    reason: null,
    matchedKeyword: null,
  };
}

/**
 * Filter an array of wheel candidates to remove UTV products
 * Returns filtered array and analytics data
 */
export function filterOutUTVProducts<T extends UTVFilterInput>(
  products: T[],
  options?: {
    logRejections?: boolean;
    vehicleType?: 'automotive' | 'utv' | 'unknown';
  }
): {
  filtered: T[];
  rejected: T[];
  analytics: {
    totalInput: number;
    totalRejected: number;
    rejectedByKeyword: Record<string, number>;
  };
} {
  const filtered: T[] = [];
  const rejected: T[] = [];
  const rejectedByKeyword: Record<string, number> = {};
  
  // If vehicle type is explicitly UTV, don't filter
  if (options?.vehicleType === 'utv') {
    return {
      filtered: products,
      rejected: [],
      analytics: {
        totalInput: products.length,
        totalRejected: 0,
        rejectedByKeyword: {},
      },
    };
  }
  
  for (const product of products) {
    const result = isUTVProduct(product);
    
    if (result.isUTV) {
      rejected.push(product);
      
      // Track analytics
      const keyword = result.matchedKeyword || 'unknown';
      rejectedByKeyword[keyword] = (rejectedByKeyword[keyword] || 0) + 1;
      
      if (options?.logRejections) {
        console.log(`[utvFilter] REJECTED: ${product.sku || 'unknown'} - ${result.reason}`);
      }
    } else {
      filtered.push(product);
    }
  }
  
  return {
    filtered,
    rejected,
    analytics: {
      totalInput: products.length,
      totalRejected: rejected.length,
      rejectedByKeyword,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS LOGGING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Log UTV filter analytics for monitoring
 */
export function logUTVFilterAnalytics(
  analytics: {
    totalInput: number;
    totalRejected: number;
    rejectedByKeyword: Record<string, number>;
  },
  context?: {
    vehicle?: string;
    boltPattern?: string;
    searchId?: string;
  }
): void {
  if (analytics.totalRejected === 0) return;
  
  console.log(`[utvFilter] 🚫 UTV Filter Applied:`, {
    context,
    inputCount: analytics.totalInput,
    rejectedCount: analytics.totalRejected,
    byKeyword: analytics.rejectedByKeyword,
  });
}
