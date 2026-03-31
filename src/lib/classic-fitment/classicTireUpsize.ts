/**
 * Classic Tire Upsize Engine
 * 
 * Generates equivalent tire sizes for larger wheel diameters.
 * Used when classic vehicles have stock 14-15" tires but customers
 * want to run 17-20" wheels.
 * 
 * ONLY used when isClassicVehicle === true
 */

// ============================================================================
// Types
// ============================================================================

export interface TireSize {
  width: number;      // mm (e.g., 225)
  aspectRatio: number; // % (e.g., 70)
  rimDiameter: number; // inches (e.g., 14)
  metric: string;     // formatted (e.g., "225/70R14")
}

export interface UpsizeResult {
  rimDiameter: number;
  sizes: TireSize[];
  diameterVariance: number; // % difference from stock
  recommended: boolean;
}

export interface UpsizeOptions {
  /** Target rim diameters to generate sizes for */
  targetDiameters?: number[];
  /** Maximum diameter variance allowed (default 3%) */
  maxVariance?: number;
  /** Include plus-sizing (wider, lower profile) */
  includePlusSizing?: boolean;
}

// ============================================================================
// Legacy Size Conversion
// ============================================================================

/**
 * Legacy tire size patterns and their metric equivalents
 * Format: [width, aspect ratio]
 */
const LEGACY_CONVERSIONS: Record<string, [number, number]> = {
  // Numeric sizes (bias-ply era)
  "5.60": [155, 82],
  "6.00": [165, 82],
  "6.50": [175, 82],
  "6.95": [185, 82],
  "7.00": [185, 82],
  "7.35": [195, 82],
  "7.75": [205, 78],
  "8.15": [215, 75],
  "8.25": [215, 75],
  "8.55": [225, 75],
  "8.85": [235, 75],
  "9.00": [245, 75],
  "9.15": [245, 75],
  
  // Alpha-numeric sizes (60-70 series)
  "A70": [185, 70],
  "B70": [195, 70],
  "C70": [195, 70],
  "D70": [205, 70],
  "E70": [215, 70],
  "F70": [225, 70],
  "G70": [235, 70],
  "H70": [245, 70],
  "J70": [255, 70],
  "L70": [265, 70],
  
  "A78": [185, 78],
  "B78": [195, 78],
  "C78": [195, 78],
  "D78": [205, 78],
  "E78": [215, 78],
  "F78": [225, 78],
  "G78": [235, 78],
  "H78": [245, 78],
  
  // 60-series (performance)
  "E60": [215, 60],
  "F60": [225, 60],
  "G60": [245, 60],
  "H60": [255, 60],
  "L60": [275, 60],
};

/**
 * Parse a tire size string into components
 */
export function parseTireSize(sizeStr: string): TireSize | null {
  if (!sizeStr) return null;
  
  const normalized = sizeStr.toUpperCase().trim();
  
  // Try metric format first: 225/70R14 or 225/70-14
  const metricMatch = normalized.match(/^(\d{3})\/(\d{2})R?-?(\d{2})$/);
  if (metricMatch) {
    return {
      width: parseInt(metricMatch[1], 10),
      aspectRatio: parseInt(metricMatch[2], 10),
      rimDiameter: parseInt(metricMatch[3], 10),
      metric: `${metricMatch[1]}/${metricMatch[2]}R${metricMatch[3]}`,
    };
  }
  
  // Try alpha-numeric format: E70-14, F60-15, G78-14
  const alphaMatch = normalized.match(/^([A-L])(\d{2})-?(\d{2})$/);
  if (alphaMatch) {
    const letterCode = `${alphaMatch[1]}${alphaMatch[2]}`;
    const conversion = LEGACY_CONVERSIONS[letterCode];
    if (conversion) {
      const [width, aspect] = conversion;
      const rim = parseInt(alphaMatch[3], 10);
      return {
        width,
        aspectRatio: aspect,
        rimDiameter: rim,
        metric: `${width}/${aspect}R${rim}`,
      };
    }
  }
  
  // Try numeric format: 7.00-14, 8.55-15
  const numericMatch = normalized.match(/^(\d+\.\d{2})-?(\d{2})$/);
  if (numericMatch) {
    const numCode = numericMatch[1];
    const conversion = LEGACY_CONVERSIONS[numCode];
    if (conversion) {
      const [width, aspect] = conversion;
      const rim = parseInt(numericMatch[2], 10);
      return {
        width,
        aspectRatio: aspect,
        rimDiameter: rim,
        metric: `${width}/${aspect}R${rim}`,
      };
    }
  }
  
  return null;
}

/**
 * Parse multiple tire sizes from a string (separated by / or ,)
 */
export function parseMultipleTireSizes(sizeStr: string): TireSize[] {
  if (!sizeStr) return [];
  
  // Split by common separators
  const parts = sizeStr.split(/[\/,]/).map(s => s.trim()).filter(Boolean);
  const sizes: TireSize[] = [];
  
  for (const part of parts) {
    const parsed = parseTireSize(part);
    if (parsed) {
      sizes.push(parsed);
    }
  }
  
  return sizes;
}

// ============================================================================
// Diameter Calculation
// ============================================================================

/**
 * Calculate overall tire diameter in inches
 * Formula: (2 * sidewall height) + rim diameter
 * Sidewall height = width * (aspect ratio / 100)
 */
export function calculateOverallDiameter(size: TireSize): number {
  const sidewallHeightMm = size.width * (size.aspectRatio / 100);
  const sidewallHeightInches = sidewallHeightMm / 25.4;
  return (2 * sidewallHeightInches) + size.rimDiameter;
}

/**
 * Calculate diameter variance percentage
 */
export function calculateVariance(original: number, upsize: number): number {
  return Math.abs((upsize - original) / original) * 100;
}

// ============================================================================
// Upsize Generation
// ============================================================================

/**
 * Common tire widths available in the market
 */
const COMMON_WIDTHS = [195, 205, 215, 225, 235, 245, 255, 265, 275, 285, 295, 305];

/**
 * Common aspect ratios by category
 */
const ASPECT_RATIOS = {
  touring: [70, 65, 60],
  performance: [55, 50, 45],
  aggressive: [40, 35],
};

/**
 * Generate equivalent tire sizes for a target rim diameter
 */
export function generateUpsizesForDiameter(
  stockSize: TireSize,
  targetRimDiameter: number,
  maxVariance: number = 3
): TireSize[] {
  const stockDiameter = calculateOverallDiameter(stockSize);
  const results: TireSize[] = [];
  
  // Calculate required sidewall height to match overall diameter
  const requiredSidewallInches = (stockDiameter - targetRimDiameter) / 2;
  const requiredSidewallMm = requiredSidewallInches * 25.4;
  
  // Try different width/aspect combinations
  const allAspects = [...ASPECT_RATIOS.touring, ...ASPECT_RATIOS.performance];
  
  for (const width of COMMON_WIDTHS) {
    for (const aspect of allAspects) {
      // Skip unrealistic combinations
      if (width < 195 && targetRimDiameter > 16) continue;
      if (width > 285 && aspect > 60) continue;
      
      const candidate: TireSize = {
        width,
        aspectRatio: aspect,
        rimDiameter: targetRimDiameter,
        metric: `${width}/${aspect}R${targetRimDiameter}`,
      };
      
      const candidateDiameter = calculateOverallDiameter(candidate);
      const variance = calculateVariance(stockDiameter, candidateDiameter);
      
      if (variance <= maxVariance) {
        results.push(candidate);
      }
    }
  }
  
  // Sort by variance (closest match first), then by width (narrower first for clearance)
  return results.sort((a, b) => {
    const varA = calculateVariance(stockDiameter, calculateOverallDiameter(a));
    const varB = calculateVariance(stockDiameter, calculateOverallDiameter(b));
    if (Math.abs(varA - varB) < 0.5) {
      return a.width - b.width;
    }
    return varA - varB;
  });
}

/**
 * Generate complete upsize table for a classic vehicle
 */
export function generateClassicUpsizeTable(
  stockTireSizeStr: string,
  options: UpsizeOptions = {}
): UpsizeResult[] {
  const {
    targetDiameters = [15, 16, 17, 18, 19, 20],
    maxVariance = 3,
  } = options;
  
  // Parse stock size(s) - take the first valid one
  const stockSizes = parseMultipleTireSizes(stockTireSizeStr);
  if (stockSizes.length === 0) {
    console.warn(`[classicTireUpsize] Could not parse stock size: ${stockTireSizeStr}`);
    return [];
  }
  
  const stockSize = stockSizes[0];
  const stockDiameter = calculateOverallDiameter(stockSize);
  
  console.log(`[classicTireUpsize] Stock: ${stockSize.metric}, OD: ${stockDiameter.toFixed(1)}"`);
  
  const results: UpsizeResult[] = [];
  
  for (const rimDiameter of targetDiameters) {
    // Skip if target is same or smaller than stock
    if (rimDiameter <= stockSize.rimDiameter) continue;
    
    const sizes = generateUpsizesForDiameter(stockSize, rimDiameter, maxVariance);
    
    if (sizes.length > 0) {
      // Calculate best variance for this diameter
      const bestSize = sizes[0];
      const bestDiameter = calculateOverallDiameter(bestSize);
      const variance = calculateVariance(stockDiameter, bestDiameter);
      
      results.push({
        rimDiameter,
        sizes: sizes.slice(0, 5), // Top 5 options per diameter
        diameterVariance: variance,
        recommended: variance <= 2 && rimDiameter <= 18, // Conservative recommendation
      });
    }
  }
  
  return results;
}

/**
 * Get all valid tire sizes for classic vehicle wheel search
 * Returns sizes to use in tire search query
 */
export function getClassicTireSizesForWheelDiameter(
  stockTireSizeStr: string,
  wheelDiameter: number,
  maxResults: number = 3
): string[] {
  // Parse stock size
  const stockSizes = parseMultipleTireSizes(stockTireSizeStr);
  if (stockSizes.length === 0) return [];
  
  const stockSize = stockSizes[0];
  
  // If wheel matches stock, return stock size
  if (wheelDiameter === stockSize.rimDiameter) {
    return [stockSize.metric];
  }
  
  // Generate upsizes for this specific diameter
  const upsizes = generateUpsizesForDiameter(stockSize, wheelDiameter, 3);
  
  // Return top matches as formatted strings
  return upsizes.slice(0, maxResults).map(s => s.metric);
}

/**
 * Get best tire size recommendation for a classic vehicle
 */
export function getRecommendedTireSize(
  stockTireSizeStr: string,
  wheelDiameter: number
): TireSize | null {
  const sizes = getClassicTireSizesForWheelDiameter(stockTireSizeStr, wheelDiameter, 1);
  if (sizes.length === 0) return null;
  return parseTireSize(sizes[0]);
}

// ============================================================================
// Exports
// ============================================================================

export default {
  parseTireSize,
  parseMultipleTireSizes,
  calculateOverallDiameter,
  generateClassicUpsizeTable,
  getClassicTireSizesForWheelDiameter,
  getRecommendedTireSize,
};
