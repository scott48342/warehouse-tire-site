/**
 * USAF Fitment Normalization Utilities
 * 
 * Normalizes USAF tire size data into canonical formats.
 * Handles LT sizes, flotation sizes, staggered sets, duplicates.
 */

import type { 
  NormalizedTireSize, 
  NormalizedFitment,
  UsafVehicleOption 
} from './types';

// ============================================================================
// TIRE SIZE NORMALIZATION
// ============================================================================

/**
 * Normalize a raw tire size string from USAF
 * 
 * Examples:
 * - "P275/65R18" -> { width: 275, aspectRatio: 65, rimDiameter: 18, prefix: 'P' }
 * - "LT275/65R18" -> { width: 275, aspectRatio: 65, rimDiameter: 18, prefix: 'LT' }
 * - "35X12.50R17LT" -> flotation format
 * - "275/65R18 116T" -> includes load index and speed rating
 */
export function normalizeUsafTireSize(raw: string): NormalizedTireSize | null {
  if (!raw || typeof raw !== 'string') return null;
  
  const input = raw.trim().toUpperCase();
  
  // Try standard metric format: P275/65R18, LT275/65R18, 275/65R18
  const metricMatch = input.match(
    /^(P|LT|ST|T)?(\d{3})\/(\d{2,3})(ZR|R)(\d{2})(\s*(\d{2,3})([A-Z]))?(\s*(XL|RF|C|D|E|F|G|H|J|L|M|N))?$/i
  );
  
  if (metricMatch) {
    const [, prefix, width, aspect, , rim, , loadIdx, speedRating, , loadRange] = metricMatch;
    return {
      raw,
      width: parseInt(width),
      aspectRatio: parseInt(aspect),
      rimDiameter: parseInt(rim),
      prefix: prefix as 'P' | 'LT' | 'ST' | 'T' | undefined,
      loadIndex: loadIdx ? parseInt(loadIdx) : undefined,
      speedRating: speedRating || undefined,
      loadRange: loadRange || undefined,
      isFlotation: false,
      normalized: `${prefix || ''}${width}/${aspect}R${rim}`,
    };
  }
  
  // Try flotation format: 35X12.50R17LT
  const flotationMatch = input.match(
    /^(\d{2,3})[Xx](\d{1,2}(?:\.\d{1,2})?)[Rr](\d{2})(LT)?$/
  );
  
  if (flotationMatch) {
    const [, diameter, width, rim, ltSuffix] = flotationMatch;
    // Convert flotation to approximate metric
    // Flotation: diameter x width R rim
    const widthMm = Math.round(parseFloat(width) * 25.4);
    const diameterIn = parseFloat(diameter);
    const rimIn = parseInt(rim);
    // Aspect ratio approximation: ((diameter - rim) / 2) / width * 100
    const sidewallHeight = (diameterIn - rimIn) / 2;
    const aspectRatio = Math.round((sidewallHeight / parseFloat(width)) * 100);
    
    return {
      raw,
      width: widthMm,
      aspectRatio,
      rimDiameter: rimIn,
      prefix: ltSuffix ? 'LT' : undefined,
      isFlotation: true,
      normalized: `${diameter}x${width}R${rim}${ltSuffix || ''}`,
    };
  }
  
  // Try simple format without slash: 2756518
  const simpleMatch = input.match(/^(\d{3})(\d{2})(\d{2})$/);
  if (simpleMatch) {
    const [, width, aspect, rim] = simpleMatch;
    return {
      raw,
      width: parseInt(width),
      aspectRatio: parseInt(aspect),
      rimDiameter: parseInt(rim),
      isFlotation: false,
      normalized: `${width}/${aspect}R${rim}`,
    };
  }
  
  console.warn(`[usaf-fitment] Could not parse tire size: ${raw}`);
  return null;
}

/**
 * Normalize load range from various formats
 */
export function normalizeLoadRange(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  
  const input = raw.trim().toUpperCase();
  
  // Standard load ranges
  const validRanges = ['SL', 'XL', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'L', 'M', 'N'];
  
  // Direct match
  if (validRanges.includes(input)) return input;
  
  // Numeric ply rating to load range
  const plyMap: Record<string, string> = {
    '4': 'B',
    '6': 'C',
    '8': 'D',
    '10': 'E',
    '12': 'F',
    '14': 'G',
  };
  
  if (plyMap[input]) return plyMap[input];
  
  // Extract from descriptions like "Load Range E"
  const rangeMatch = input.match(/LOAD\s*RANGE\s*([A-Z])/i);
  if (rangeMatch) return rangeMatch[1];
  
  return input;
}

/**
 * Normalize speed rating
 */
export function normalizeSpeedRating(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  
  const input = raw.trim().toUpperCase();
  
  // Valid speed ratings (in order of increasing speed)
  const validRatings = ['L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'H', 'V', 'W', 'Y', 'Z', 'ZR'];
  
  // Direct match
  if (validRatings.includes(input)) return input;
  
  // Extract from combined load/speed like "116T"
  const combinedMatch = input.match(/\d{2,3}([A-Z]{1,2})$/);
  if (combinedMatch && validRatings.includes(combinedMatch[1])) {
    return combinedMatch[1];
  }
  
  return input;
}

// ============================================================================
// STAGGERED DETECTION
// ============================================================================

/**
 * Parse USAF vehicle options to detect staggered configurations
 */
export function parseUsafStaggeredGroups(
  options: UsafVehicleOption[]
): { isStaggered: boolean; frontSize?: NormalizedTireSize; rearSize?: NormalizedTireSize } {
  
  if (!options || options.length === 0) {
    return { isStaggered: false };
  }
  
  // Group by position
  const frontOptions = options.filter(o => o.position === 'front');
  const rearOptions = options.filter(o => o.position === 'rear');
  
  // If we have explicit front/rear positions, check for different sizes
  if (frontOptions.length > 0 && rearOptions.length > 0) {
    const frontSize = normalizeUsafTireSize(frontOptions[0].tireSize);
    const rearSize = normalizeUsafTireSize(rearOptions[0].tireSize);
    
    if (frontSize && rearSize) {
      const isStaggered = 
        frontSize.width !== rearSize.width ||
        frontSize.aspectRatio !== rearSize.aspectRatio ||
        frontSize.rimDiameter !== rearSize.rimDiameter;
      
      return { isStaggered, frontSize, rearSize };
    }
  }
  
  // Check for different rim widths even with same tire size
  const uniqueRimWidths = [...new Set(options.map(o => o.rimWidth))];
  if (uniqueRimWidths.length > 1) {
    // Different rim widths suggest staggered
    const sortedOptions = [...options].sort((a, b) => a.rimWidth - b.rimWidth);
    return {
      isStaggered: true,
      frontSize: normalizeUsafTireSize(sortedOptions[0].tireSize) || undefined,
      rearSize: normalizeUsafTireSize(sortedOptions[sortedOptions.length - 1].tireSize) || undefined,
    };
  }
  
  // Check for multiple different tire sizes
  const uniqueSizes = [...new Set(options.map(o => o.tireSize))];
  if (uniqueSizes.length === 2) {
    const size1 = normalizeUsafTireSize(uniqueSizes[0]);
    const size2 = normalizeUsafTireSize(uniqueSizes[1]);
    
    if (size1 && size2 && size1.rimDiameter === size2.rimDiameter) {
      // Same diameter, different width/aspect = likely staggered
      if (size1.width !== size2.width || size1.aspectRatio !== size2.aspectRatio) {
        // Smaller width is typically front
        const [front, rear] = size1.width < size2.width ? [size1, size2] : [size2, size1];
        return { isStaggered: true, frontSize: front, rearSize: rear };
      }
    }
  }
  
  return { isStaggered: false };
}

/**
 * Infer all valid configurations from USAF options
 */
export function inferUsafConfigurations(options: UsafVehicleOption[]): NormalizedFitment {
  const allSizes: NormalizedTireSize[] = [];
  const wheelDiameters = new Set<number>();
  const loadRanges = new Set<string>();
  const speedRatings = new Set<string>();
  
  for (const opt of options) {
    const normalized = normalizeUsafTireSize(opt.tireSize);
    if (normalized) {
      // Deduplicate by normalized string
      if (!allSizes.some(s => s.normalized === normalized.normalized)) {
        allSizes.push(normalized);
      }
      wheelDiameters.add(normalized.rimDiameter);
    }
    
    if (opt.loadRange) {
      const lr = normalizeLoadRange(opt.loadRange);
      if (lr) loadRanges.add(lr);
    }
    
    if (opt.speedRating) {
      const sr = normalizeSpeedRating(opt.speedRating);
      if (sr) speedRatings.add(sr);
    }
  }
  
  const staggeredInfo = parseUsafStaggeredGroups(options);
  
  return {
    tireSizes: allSizes,
    isStaggered: staggeredInfo.isStaggered,
    frontSize: staggeredInfo.frontSize,
    rearSize: staggeredInfo.rearSize,
    wheelDiameters: [...wheelDiameters].sort((a, b) => a - b),
    loadRanges: [...loadRanges],
    speedRatings: [...speedRatings],
  };
}

// ============================================================================
// DEDUPLICATION
// ============================================================================

/**
 * Deduplicate noisy USAF records
 * USAF often returns the same size multiple times with slight variations
 */
export function deduplicateUsafOptions(options: UsafVehicleOption[]): UsafVehicleOption[] {
  const seen = new Map<string, UsafVehicleOption>();
  
  for (const opt of options) {
    const normalized = normalizeUsafTireSize(opt.tireSize);
    if (!normalized) continue;
    
    // Create a key that captures the essential uniqueness
    const key = `${normalized.normalized}|${opt.rimWidth || ''}|${opt.position || 'all'}`;
    
    // Keep the first occurrence, or prefer OE fitments
    if (!seen.has(key) || (opt.isOE && !seen.get(key)!.isOE)) {
      seen.set(key, opt);
    }
  }
  
  return [...seen.values()];
}

// ============================================================================
// COMPARISON HELPERS
// ============================================================================

/**
 * Compare two tire sizes for equality
 */
export function tireSizesMatch(a: string, b: string): boolean {
  const normA = normalizeUsafTireSize(a);
  const normB = normalizeUsafTireSize(b);
  
  if (!normA || !normB) return false;
  
  return normA.normalized === normB.normalized;
}

/**
 * Check if a tire size exists in a list (normalized comparison)
 */
export function tireSizeInList(size: string, list: string[]): boolean {
  const normalized = normalizeUsafTireSize(size);
  if (!normalized) return false;
  
  return list.some(s => {
    const norm = normalizeUsafTireSize(s);
    return norm && norm.normalized === normalized.normalized;
  });
}
