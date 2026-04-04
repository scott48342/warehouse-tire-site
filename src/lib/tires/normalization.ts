/**
 * Tire Data Normalization Utilities
 * 
 * Normalizes mileage warranty and tread category data from various suppliers
 * into consistent formats for filtering and display.
 */

// ============================================================================
// TYPES
// ============================================================================

export type TreadCategory = 
  | 'All-Season'
  | 'All-Weather'
  | 'Summer'
  | 'Winter'
  | 'All-Terrain'
  | 'Mud-Terrain'
  | 'Highway/Touring'
  | 'Performance'
  | 'Rugged-Terrain'
  | 'Off-Road';

export type MileageBand = '40K+' | '60K+' | '80K+';

export interface TireEnrichment {
  /** Normalized mileage warranty in miles (integer) */
  mileage: number | null;
  /** Normalized tread category */
  treadCategory: TreadCategory | null;
  /** Mileage badge: "Long Life" (60K+) or "Ultra Long Life" (80K+) */
  mileageBadge: 'Long Life' | 'Ultra Long Life' | null;
  /** Load range (C, D, E, F, SL, XL) */
  loadRange: string | null;
  /** Is run flat tire */
  isRunFlat: boolean;
}

// ============================================================================
// TREAD CATEGORY NORMALIZATION
// ============================================================================

/**
 * Map of raw terrain/category values to normalized tread categories
 * Keys are uppercase for case-insensitive matching
 */
const TREAD_CATEGORY_MAP: Record<string, TreadCategory> = {
  // All-Season variants
  'ALL SEASON': 'All-Season',
  'ALL-SEASON': 'All-Season',
  'A/S': 'All-Season',
  'AS': 'All-Season',
  'ALL-SEASON ULTRA HIGH PERFORMA': 'Performance', // Performance variant
  
  // All-Weather variants
  'ALL WEATHER': 'All-Weather',
  'ALL-WEATHER': 'All-Weather',
  'A/W': 'All-Weather',
  'AW': 'All-Weather',
  
  // Summer variants
  'SUMMER': 'Summer',
  'MAX PERFORMANCE': 'Performance',
  'EXTREME PERFORMANCE': 'Performance',
  
  // Winter variants
  'WINTER': 'Winter',
  'SNOW': 'Winter',
  'ICE': 'Winter',
  'BLIZZAK': 'Winter',
  
  // All-Terrain variants
  'ALL TERRAIN': 'All-Terrain',
  'ALL-TERRAIN': 'All-Terrain',
  'A/T': 'All-Terrain',
  'AT': 'All-Terrain',
  
  // Mud-Terrain variants
  'MUD TERRAIN': 'Mud-Terrain',
  'MUD-TERRAIN': 'Mud-Terrain',
  'M/T': 'Mud-Terrain',
  'MT': 'Mud-Terrain',
  'MUD': 'Mud-Terrain',
  'EXTREME TERRAIN': 'Mud-Terrain',
  
  // Highway/Touring variants
  'HIGHWAY': 'Highway/Touring',
  'H/T': 'Highway/Touring',
  'HT': 'Highway/Touring',
  'HIGHWAY TOURING': 'Highway/Touring',
  'HIGHWAY TOURING (H/T)': 'Highway/Touring',
  'TOURING': 'Highway/Touring',
  'TOUR': 'Highway/Touring',
  'GRAND TOURING': 'Highway/Touring',
  
  // Performance variants
  'PERFORMANCE': 'Performance',
  'PERF': 'Performance',
  'HP': 'Performance',
  'UHP': 'Performance',
  'ULTRA HIGH PERFORMANCE': 'Performance',
  'HIGH PERFORMANCE': 'Performance',
  'STREET': 'Performance',
  
  // Rugged terrain variants  
  'RUGGED TERRAIN': 'Rugged-Terrain',
  'RUGGED': 'Rugged-Terrain',
  'R/T': 'Rugged-Terrain',
  'HYBRID TERRAIN': 'Rugged-Terrain',
  
  // Off-Road variants
  'OFF-HIGHWAY USE ONLY': 'Off-Road',
  'OFF-ROAD USE ONLY': 'Off-Road',
  'DOT APPROVED OFF-ROAD USE': 'Off-Road',
  'SAND': 'Off-Road',
};

/**
 * Normalize terrain string to standard tread category
 * Checks both direct mapping and keyword matching
 */
export function normalizeTreadCategory(
  terrain: string | null | undefined,
  description?: string | null
): TreadCategory | null {
  // First try direct mapping from terrain field
  if (terrain) {
    const upperTerrain = terrain.trim().toUpperCase();
    if (TREAD_CATEGORY_MAP[upperTerrain]) {
      return TREAD_CATEGORY_MAP[upperTerrain];
    }
    
    // Partial match for terrain field
    for (const [key, category] of Object.entries(TREAD_CATEGORY_MAP)) {
      if (upperTerrain.includes(key) || key.includes(upperTerrain)) {
        return category;
      }
    }
  }
  
  // Fall back to description parsing
  if (description) {
    const upperDesc = description.toUpperCase();
    
    // Check for specific patterns in description
    if (/\bBLIZZAK\b|\bWINTER\b|\bSNOW\b|\bICE\b|\bWS\d+\b|\bX-ICE\b/.test(upperDesc)) {
      return 'Winter';
    }
    if (/\bM\/T\b|\bMUD[\s-]?TERRAIN\b/.test(upperDesc)) {
      return 'Mud-Terrain';
    }
    if (/\bA\/T\b|\bALL[\s-]?TERRAIN\b/.test(upperDesc)) {
      return 'All-Terrain';
    }
    if (/\bR\/T\b|\bRUGGED[\s-]?TERRAIN\b/.test(upperDesc)) {
      return 'Rugged-Terrain';
    }
    if (/\bH\/T\b|\bHIGHWAY[\s-]?TOURING\b|\bHIGHWAY\b|\bTOURING\b/.test(upperDesc)) {
      return 'Highway/Touring';
    }
    if (/\bUHP\b|\bULTRA[\s-]?HIGH[\s-]?PERFORMANCE\b|\bMAX[\s-]?PERFORMANCE\b/.test(upperDesc)) {
      return 'Performance';
    }
    if (/\bA\/S\b|\bALL[\s-]?SEASON\b/.test(upperDesc)) {
      return 'All-Season';
    }
    if (/\bA\/W\b|\bALL[\s-]?WEATHER\b/.test(upperDesc)) {
      return 'All-Weather';
    }
    if (/\bSUMMER\b/.test(upperDesc)) {
      return 'Summer';
    }
  }
  
  return null;
}

// ============================================================================
// MILEAGE NORMALIZATION
// ============================================================================

/**
 * Normalize mileage warranty value to integer
 * Handles various input formats:
 * - "60,000 miles" -> 60000
 * - "60000" -> 60000
 * - 60000 -> 60000
 * - "60K" -> 60000
 */
export function normalizeMileage(warranty: string | number | null | undefined): number | null {
  if (warranty == null) return null;
  
  // Already a number
  if (typeof warranty === 'number') {
    return warranty > 0 ? Math.round(warranty) : null;
  }
  
  // String handling
  const str = String(warranty).trim().toUpperCase();
  if (!str) return null;
  
  // Handle "XXK" format (e.g., "60K", "80K")
  const kMatch = str.match(/^(\d+)K\s*(MILE)?/i);
  if (kMatch) {
    return parseInt(kMatch[1], 10) * 1000;
  }
  
  // Remove non-numeric characters except decimal point
  const cleaned = str.replace(/[,\s]/g, '').replace(/MILES?/gi, '');
  
  // Parse as number
  const num = parseInt(cleaned, 10);
  return num > 0 ? num : null;
}

/**
 * Get mileage badge based on warranty miles
 */
export function getMileageBadge(mileage: number | null): 'Long Life' | 'Ultra Long Life' | null {
  if (!mileage || mileage < 60000) return null;
  if (mileage >= 80000) return 'Ultra Long Life';
  return 'Long Life';
}

/**
 * Get mileage band for filtering
 */
export function getMileageBand(mileage: number | null): MileageBand | null {
  if (!mileage) return null;
  if (mileage >= 80000) return '80K+';
  if (mileage >= 60000) return '60K+';
  if (mileage >= 40000) return '40K+';
  return null;
}

/**
 * Check if mileage meets minimum band threshold
 */
export function meetsMinimumMileage(mileage: number | null, minBand: MileageBand): boolean {
  if (!mileage) return false;
  switch (minBand) {
    case '40K+': return mileage >= 40000;
    case '60K+': return mileage >= 60000;
    case '80K+': return mileage >= 80000;
    default: return false;
  }
}

/**
 * Format mileage for display
 * e.g., 60000 -> "60K mile warranty"
 */
export function formatMileageDisplay(mileage: number | null): string | null {
  if (!mileage || mileage < 1000) return null;
  const k = Math.round(mileage / 1000);
  return `${k}K mile warranty`;
}

// ============================================================================
// LOAD RANGE NORMALIZATION
// ============================================================================

/**
 * Normalize load range from various formats
 * - SL = Standard Load
 * - XL = Extra Load
 * - C, D, E, F = Light Truck load ranges
 */
export function normalizeLoadRange(
  loadRange: string | null | undefined,
  plyRating: string | null | undefined,
  description?: string | null
): string | null {
  // Direct load range value
  if (loadRange) {
    const upper = loadRange.trim().toUpperCase();
    // Valid load ranges: SL, XL, C, D, E, F
    if (/^(SL|XL|C|D|E|F)$/i.test(upper)) {
      return upper;
    }
  }
  
  // Try to extract from ply rating
  if (plyRating) {
    const upper = plyRating.trim().toUpperCase();
    // 6-ply = C, 8-ply = D, 10-ply = E, 12-ply = F
    if (upper.includes('6') || upper === 'C') return 'C';
    if (upper.includes('8') || upper === 'D') return 'D';
    if (upper.includes('10') || upper === 'E') return 'E';
    if (upper.includes('12') || upper === 'F') return 'F';
  }
  
  // Try to extract from description
  if (description) {
    const upper = description.toUpperCase();
    // Look for patterns like "/E " or "/D " or "10-ply"
    const match = upper.match(/\/([CDEF])\s|(\d+)[\s-]?PLY/);
    if (match) {
      if (match[1]) return match[1];
      const ply = parseInt(match[2], 10);
      if (ply === 6) return 'C';
      if (ply === 8) return 'D';
      if (ply === 10) return 'E';
      if (ply === 12) return 'F';
    }
    
    // XL indicator
    if (/\bXL\b/.test(upper) && !upper.includes('NON-XL')) {
      return 'XL';
    }
  }
  
  return null;
}

// ============================================================================
// RUN FLAT DETECTION
// ============================================================================

/**
 * Detect if tire is run-flat from various indicators
 */
export function isRunFlat(
  sidewall: string | null | undefined,
  description?: string | null,
  features?: string | null
): boolean {
  const text = [sidewall, description, features]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();
    
  return /\bRUN[\s-]?FLAT\b|\bRFT\b|\bSSR\b|\bEMT\b|\bZP\b|\bROF\b/.test(text);
}

// ============================================================================
// FULL ENRICHMENT
// ============================================================================

export interface TireRawData {
  terrain?: string | null;
  description?: string | null;
  warranty?: string | number | null;
  mileageWarranty?: string | number | null;
  loadRange?: string | null;
  plyRating?: string | null;
  sidewall?: string | null;
  features?: string | null;
}

/**
 * Enrich tire data with normalized fields
 */
export function enrichTireData(raw: TireRawData): TireEnrichment {
  const mileage = normalizeMileage(raw.warranty ?? raw.mileageWarranty);
  const treadCategory = normalizeTreadCategory(raw.terrain, raw.description);
  const loadRange = normalizeLoadRange(raw.loadRange, raw.plyRating, raw.description);
  
  return {
    mileage,
    treadCategory,
    mileageBadge: getMileageBadge(mileage),
    loadRange,
    isRunFlat: isRunFlat(raw.sidewall, raw.description, raw.features),
  };
}

// ============================================================================
// FILTER HELPERS
// ============================================================================

export const TREAD_CATEGORIES: TreadCategory[] = [
  'All-Season',
  'All-Weather', 
  'Summer',
  'Winter',
  'All-Terrain',
  'Mud-Terrain',
  'Highway/Touring',
  'Performance',
];

export const MILEAGE_BANDS: MileageBand[] = ['40K+', '60K+', '80K+'];

export const LOAD_RANGES = [
  { value: 'SL', label: 'Standard Load' },
  { value: 'XL', label: 'XL (Extra Load)' },
  { value: 'C', label: 'C (6-ply)' },
  { value: 'D', label: 'D (8-ply)' },
  { value: 'E', label: 'E (10-ply)' },
  { value: 'F', label: 'F (12-ply)' },
];
