/**
 * Data Quality Tier System
 * 
 * Tiers:
 * - "complete": has wheel specs (diameter + width) AND tire sizes - USE FOR WHEELS
 * - "partial": has tire sizes but no wheel specs - USE FOR TIRES ONLY
 * - "low_confidence": missing data OR from unreliable sources - AVOID
 * 
 * Query Rules:
 * - WHEEL SEARCH: only "complete" records
 * - TIRE SEARCH: "complete" + "partial" records
 * - PACKAGE BUILDS: only "complete" records
 */

export type QualityTier = "complete" | "partial" | "low_confidence" | "unknown";

export interface QualityTierStats {
  complete: number;
  partial: number;
  low_confidence: number;
  total: number;
  usedFallback: boolean;
  fallbackVehicle?: {
    year: number;
    make: string;
    model: string;
  };
}

/**
 * Determine which tiers to use based on search type
 */
export function getAllowedTiers(searchType: "wheel" | "tire" | "package"): QualityTier[] {
  switch (searchType) {
    case "wheel":
    case "package":
      return ["complete"];
    case "tire":
      return ["complete", "partial"];
    default:
      return ["complete"];
  }
}

/**
 * Check if a quality tier is allowed for a search type
 */
export function isTierAllowed(tier: QualityTier | string | null, searchType: "wheel" | "tire" | "package"): boolean {
  if (!tier) return false;
  const allowed = getAllowedTiers(searchType);
  return allowed.includes(tier as QualityTier);
}

/**
 * Validate that a fitment record has complete wheel specs
 * (for determining quality tier at runtime)
 */
export function hasCompleteWheelSpecs(oemWheelSizes: unknown): boolean {
  if (!Array.isArray(oemWheelSizes) || oemWheelSizes.length === 0) {
    return false;
  }
  
  // Must have at least one valid wheel spec with diameter AND width
  return oemWheelSizes.some(ws => {
    if (!ws || typeof ws !== 'object') return false;
    const obj = ws as Record<string, unknown>;
    const diameter = Number(obj.diameter || obj.rimDiameter || 0);
    const width = Number(obj.width || obj.rimWidth || 0);
    return diameter >= 13 && diameter <= 30 && width >= 4 && width <= 14;
  });
}

/**
 * Validate that a fitment record has valid tire sizes
 */
export function hasValidTireSizes(oemTireSizes: unknown): boolean {
  if (!Array.isArray(oemTireSizes) || oemTireSizes.length === 0) {
    return false;
  }
  
  // Must have at least one valid tire size format
  return oemTireSizes.some(ts => 
    typeof ts === 'string' && /^\d{3}\/\d{2}R\d{2}/.test(ts)
  );
}

/**
 * Check if wheel specs have proper front/rear position data for staggered detection
 */
export function hasStaggeredPositionData(oemWheelSizes: unknown): boolean {
  if (!Array.isArray(oemWheelSizes) || oemWheelSizes.length < 2) {
    return false;
  }
  
  let hasFront = false;
  let hasRear = false;
  
  for (const ws of oemWheelSizes) {
    if (!ws || typeof ws !== 'object') continue;
    const obj = ws as Record<string, unknown>;
    const position = obj.position || obj.axle;
    if (position === 'front') hasFront = true;
    if (position === 'rear') hasRear = true;
  }
  
  return hasFront && hasRear;
}

/**
 * Determine quality tier for a fitment record at runtime
 * (Used when DB doesn't have quality_tier set yet)
 */
export function determineQualityTier(
  oemWheelSizes: unknown,
  oemTireSizes: unknown,
  boltPattern: string | null,
  source?: string
): QualityTier {
  const lowConfidenceSources = [
    'catalog-gap-fill',
    'luxury-gap-fill',
    'batch1-fill',
    'batch2v2-trim-groups',
    'batch3-sports-cars',
    'batch4-suvs-sedans',
    'batch5-sports-more',
    'batch6-minivans-evs',
    'batch7-subcompacts-final',
    'final-gap-fill',
    'gap-fix',
    'priority-gap-fill',
  ];
  
  const hasWheels = hasCompleteWheelSpecs(oemWheelSizes);
  const hasTires = hasValidTireSizes(oemTireSizes);
  const hasBolt = Boolean(boltPattern?.trim());
  
  // Complete: has everything
  if (hasWheels && hasTires && hasBolt) {
    return "complete";
  }
  
  // Partial: has tires but not wheels (and not from low-confidence source)
  if (hasTires && hasBolt && !lowConfidenceSources.includes(source || '')) {
    return "partial";
  }
  
  // Low confidence: missing data or from unreliable source
  return "low_confidence";
}

/**
 * PHASE 3: Stagger detection rules
 * 
 * Only mark as staggered if:
 * 1. Has quality_tier = "complete"
 * 2. Has wheel specs with EXPLICIT front/rear position data
 * 
 * Do NOT assume staggered from:
 * - Multiple tire sizes (could be trim options)
 * - Multiple wheel diameters without position data
 */
export function canDetectStaggered(
  qualityTier: QualityTier | string | null,
  oemWheelSizes: unknown
): { canDetect: boolean; reason: string } {
  if (qualityTier !== "complete") {
    return {
      canDetect: false,
      reason: `Quality tier is "${qualityTier}" - staggered detection requires "complete" tier`
    };
  }
  
  if (!hasStaggeredPositionData(oemWheelSizes)) {
    return {
      canDetect: false,
      reason: "No explicit front/rear position data in wheel specs"
    };
  }
  
  return {
    canDetect: true,
    reason: "Has complete wheel specs with front/rear positions"
  };
}
