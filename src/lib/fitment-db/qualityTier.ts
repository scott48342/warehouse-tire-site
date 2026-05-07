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
 * Known staggered-capable vehicle patterns.
 * These vehicles commonly have staggered front/rear wheel widths.
 */
const STAGGERED_CAPABLE_PATTERNS: Array<{ make: RegExp; model: RegExp }> = [
  // American Muscle
  { make: /^ford$/i, model: /mustang/i },
  { make: /^chevrolet$/i, model: /camaro|corvette/i },
  { make: /^dodge$/i, model: /challenger|charger|viper/i },
  // German Performance
  { make: /^bmw$/i, model: /m[2-8]|z[1-8]|[1-8]\s*series|x5|x6/i },
  { make: /^mercedes-?benz$/i, model: /amg|sl|cls|gt/i },
  { make: /^audi$/i, model: /rs|r8|tt|s[3-8]/i },
  { make: /^porsche$/i, model: /911|718|cayman|boxster|panamera|taycan|cayenne/i },
  // EVs with staggered setups (Performance trims)
  { make: /^tesla$/i, model: /model\s*[3sxy]/i },
  { make: /^volkswagen$/i, model: /id\.?4/i },
  // Japanese Sports
  { make: /^nissan$/i, model: /gt-?r|370z|350z|z$/i },
  { make: /^lexus$/i, model: /rc|lc|is-?f|gs-?f|lfa/i },
  { make: /^infiniti$/i, model: /q60|g37|q50.*(red\s*sport|sport)/i },
  { make: /^toyota$/i, model: /supra|gr86/i },
  { make: /^subaru$/i, model: /brz/i },
  { make: /^mazda$/i, model: /mx-?5|miata|rx-?[78]/i },
  // Italian/British
  { make: /^ferrari$/i, model: /.+/i },
  { make: /^lamborghini$/i, model: /.+/i },
  { make: /^maserati$/i, model: /.+/i },
  { make: /^jaguar$/i, model: /f-?type|xk/i },
  { make: /^aston\s*martin$/i, model: /.+/i },
  { make: /^mclaren$/i, model: /.+/i },
  { make: /^lotus$/i, model: /.+/i },
];

/**
 * Check if a vehicle is known to commonly have staggered wheel setups.
 */
export function isStaggeredCapableVehicle(make: string, model: string): boolean {
  const normalizedMake = (make || '').trim();
  const normalizedModel = (model || '').trim();
  
  return STAGGERED_CAPABLE_PATTERNS.some(
    p => p.make.test(normalizedMake) && p.model.test(normalizedModel)
  );
}

/**
 * Detailed staggered detection result for debugging
 */
export interface StaggeredDetectionResult {
  hasStaggeredData: boolean;
  reason: string;
  debug: {
    hasExplicitPositions: boolean;
    hasFront: boolean;
    hasRear: boolean;
    widths: number[];
    widthDelta: number;
    minWidth: number;
    maxWidth: number;
    specCount: number;
  };
}

/**
 * Check if wheel specs have proper front/rear position data for staggered detection.
 * 
 * Detection logic (v2 - 2026-05-06):
 * 1. Explicit position markers (front/rear) → always trust
 * 2. Width difference >= 0.5" with 2+ specs → staggered data exists
 * 3. For staggered-capable vehicles, lower threshold applies
 * 
 * This function determines IF staggered data exists, not IF the vehicle IS staggered.
 * The actual staggered determination uses the wheel specs directly.
 */
export function hasStaggeredPositionData(oemWheelSizes: unknown): boolean {
  return analyzeStaggeredData(oemWheelSizes).hasStaggeredData;
}

/**
 * Detailed analysis of staggered wheel data.
 * Returns debug info for logging and troubleshooting.
 */
export function analyzeStaggeredData(oemWheelSizes: unknown): StaggeredDetectionResult {
  const defaultResult: StaggeredDetectionResult = {
    hasStaggeredData: false,
    reason: "No wheel specs provided",
    debug: {
      hasExplicitPositions: false,
      hasFront: false,
      hasRear: false,
      widths: [],
      widthDelta: 0,
      minWidth: 0,
      maxWidth: 0,
      specCount: 0,
    },
  };

  if (!Array.isArray(oemWheelSizes) || oemWheelSizes.length === 0) {
    return defaultResult;
  }

  let hasFront = false;
  let hasRear = false;
  const widths: number[] = [];
  
  for (const ws of oemWheelSizes) {
    if (!ws || typeof ws !== 'object') continue;
    const obj = ws as Record<string, unknown>;
    const position = obj.position || obj.axle;
    
    // Check explicit position markers
    if (position === 'front' || obj.front === true) hasFront = true;
    if (position === 'rear' || obj.rear === true) hasRear = true;
    
    // Collect widths for inference
    const width = Number(obj.width || obj.rimWidth || 0);
    if (width > 0) widths.push(width);
  }
  
  const uniqueWidths = [...new Set(widths)];
  const minWidth = uniqueWidths.length > 0 ? Math.min(...uniqueWidths) : 0;
  const maxWidth = uniqueWidths.length > 0 ? Math.max(...uniqueWidths) : 0;
  const widthDelta = maxWidth - minWidth;
  const hasExplicitPositions = hasFront || hasRear;
  
  const debug = {
    hasExplicitPositions,
    hasFront,
    hasRear,
    widths: uniqueWidths,
    widthDelta,
    minWidth,
    maxWidth,
    specCount: oemWheelSizes.length,
  };

  // CASE 1: Explicit front/rear markers found
  if (hasFront && hasRear) {
    return {
      hasStaggeredData: true,
      reason: "Explicit front AND rear position markers found",
      debug,
    };
  }
  
  // CASE 2: Only rear is marked (Corvette-style) - treat unmarked as front
  if (hasRear && !hasFront && uniqueWidths.length >= 1) {
    return {
      hasStaggeredData: true,
      reason: "Explicit rear marker found (unmarked specs treated as front)",
      debug,
    };
  }
  
  // CASE 3: Only front is marked - treat unmarked as rear
  if (hasFront && !hasRear && uniqueWidths.length >= 1) {
    return {
      hasStaggeredData: true,
      reason: "Explicit front marker found (unmarked specs treated as rear)",
      debug,
    };
  }

  // CASE 4: No explicit positions - infer from width difference
  // Must have 2+ specs with different widths
  if (uniqueWidths.length >= 2) {
    // v2 FIX: Lower threshold to 0.5" to catch Mustang GT Perf Pack (9" vs 9.5"), 
    // Camaro SS (10" vs 11"), etc.
    // 
    // Safety: This only enables detection. The actual staggered decision
    // happens in detectStaggeredFromParsed() which also validates the vehicle.
    // False positives are prevented by:
    // - Trucks/SUVs rarely have multiple wheel widths in OEM data
    // - Square sedans have same width for all options
    // - True staggered is confirmed by different tire sizes too
    if (widthDelta >= 0.5) {
      return {
        hasStaggeredData: true,
        reason: `Width difference of ${widthDelta}" detected (${minWidth}" vs ${maxWidth}")`,
        debug,
      };
    }
    
    return {
      hasStaggeredData: false,
      reason: `Multiple widths but delta (${widthDelta}") < 0.5"`,
      debug,
    };
  }
  
  return {
    hasStaggeredData: false,
    reason: uniqueWidths.length === 1 
      ? "Single wheel width (square fitment)" 
      : "No valid wheel widths found",
    debug,
  };
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
 * Extended staggered detection result with debug info
 */
export interface CanDetectStaggeredResult {
  canDetect: boolean;
  reason: string;
  debug?: StaggeredDetectionResult["debug"];
  isStaggeredCapable?: boolean;
}

/**
 * PHASE 3: Stagger detection rules (v2 - 2026-05-06)
 * 
 * Detection is enabled if:
 * 1. Has quality_tier = "complete"
 * 2. Has wheel specs with:
 *    - Explicit front/rear position markers, OR
 *    - Width difference >= 0.5" (lowered from 2" to catch real staggered vehicles)
 * 
 * The actual staggered DECISION is made by detectStaggeredFromParsed() in the route,
 * which validates that front/rear specs actually differ.
 * 
 * @param qualityTier - The quality tier of the fitment record
 * @param oemWheelSizes - Array of wheel size objects
 * @param make - Vehicle make (optional, for staggered-capable check)
 * @param model - Vehicle model (optional, for staggered-capable check)
 */
export function canDetectStaggered(
  qualityTier: QualityTier | string | null,
  oemWheelSizes: unknown,
  make?: string,
  model?: string
): CanDetectStaggeredResult {
  // Check quality tier first
  if (qualityTier !== "complete") {
    return {
      canDetect: false,
      reason: `Quality tier is "${qualityTier}" - staggered detection requires "complete" tier`
    };
  }
  
  // Analyze the wheel data
  const analysis = analyzeStaggeredData(oemWheelSizes);
  
  // Check if vehicle is known staggered-capable (for logging)
  const isStaggeredCapable = make && model 
    ? isStaggeredCapableVehicle(make, model) 
    : undefined;
  
  if (!analysis.hasStaggeredData) {
    return {
      canDetect: false,
      reason: analysis.reason,
      debug: analysis.debug,
      isStaggeredCapable,
    };
  }
  
  return {
    canDetect: true,
    reason: analysis.reason,
    debug: analysis.debug,
    isStaggeredCapable,
  };
}
