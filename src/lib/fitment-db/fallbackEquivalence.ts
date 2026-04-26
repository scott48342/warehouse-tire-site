/**
 * Fitment Fallback Equivalence Checker
 * 
 * Determines if two trims are fitment-equivalent for safe fallback.
 * Only allows fallback when ALL critical specs match.
 * 
 * @created 2026-04-26
 */

import type { VehicleFitment } from "./schema";

// ============================================================================
// Types
// ============================================================================

export type FallbackConfidence = 
  | "exact_certified"           // Exact trim match, certified
  | "equivalent_certified"      // Different trim, but fitment-equivalent
  | "wheel_safe_only"           // Bolt/hub/thread match, but tire/package unknown
  | "needs_manual_verification" // Cannot verify equivalence
  | "blocked";                  // Needs review, no safe fallback

export interface FallbackResult {
  allowed: boolean;
  confidence: FallbackConfidence;
  fallbackTrim: VehicleFitment | null;
  reasons: string[];
  warnings: string[];
}

export interface EquivalenceCheck {
  isEquivalent: boolean;
  confidence: FallbackConfidence;
  matchedSpecs: string[];
  mismatchedSpecs: string[];
  warnings: string[];
}

// ============================================================================
// OEM Wheel Size Parsing
// ============================================================================

interface ParsedWheelSize {
  diameter: number;
  width: number;
  offset?: number;
  axle?: "front" | "rear" | "both";
}

function parseOemWheelSizes(sizes: any): ParsedWheelSize[] {
  if (!sizes || !Array.isArray(sizes)) return [];
  
  return sizes.map(s => {
    if (typeof s === "object") {
      return {
        diameter: Number(s.diameter) || 0,
        width: Number(s.width) || 0,
        offset: s.offset != null ? Number(s.offset) : undefined,
        axle: s.axle as "front" | "rear" | "both" | undefined,
      };
    }
    return { diameter: 0, width: 0 };
  }).filter(s => s.diameter > 0);
}

function getDiameterRange(sizes: ParsedWheelSize[]): { min: number; max: number } | null {
  if (sizes.length === 0) return null;
  const diameters = sizes.map(s => s.diameter);
  return { min: Math.min(...diameters), max: Math.max(...diameters) };
}

function isStaggeredSetup(sizes: ParsedWheelSize[]): boolean {
  const frontSizes = sizes.filter(s => s.axle === "front");
  const rearSizes = sizes.filter(s => s.axle === "rear");
  
  if (frontSizes.length > 0 && rearSizes.length > 0) {
    // Check if front and rear have different specs
    const frontWidths = new Set(frontSizes.map(s => s.width));
    const rearWidths = new Set(rearSizes.map(s => s.width));
    
    // If different widths exist, it's staggered
    for (const fw of frontWidths) {
      for (const rw of rearWidths) {
        if (Math.abs(fw - rw) >= 0.5) return true;
      }
    }
  }
  
  return false;
}

// ============================================================================
// Tire Size Parsing
// ============================================================================

interface ParsedTireSize {
  width: number;
  aspectRatio: number;
  rimDiameter: number;
}

function parseTireSize(size: string): ParsedTireSize | null {
  // Format: 275/55R20 or P275/55R20
  const match = size.match(/P?(\d{3})\/(\d{2,3})R(\d{2})/i);
  if (!match) return null;
  
  return {
    width: parseInt(match[1], 10),
    aspectRatio: parseInt(match[2], 10),
    rimDiameter: parseInt(match[3], 10),
  };
}

function getTireRimDiameterRange(sizes: string[]): { min: number; max: number } | null {
  if (!sizes || sizes.length === 0) return null;
  
  const parsed = sizes.map(parseTireSize).filter(Boolean) as ParsedTireSize[];
  if (parsed.length === 0) return null;
  
  const diameters = parsed.map(t => t.rimDiameter);
  return { min: Math.min(...diameters), max: Math.max(...diameters) };
}

// ============================================================================
// Performance Trim Detection
// ============================================================================

const PERFORMANCE_TRIM_PATTERNS = [
  /\b(GT|GT-S|GTS|GTI|GT-R|GTR)\b/i,
  /\b(RS|RSX|RS-Q|RSQ)\b/i,
  /\b(Sport|S-Line|S Line|SRT|SS|SSR)\b/i,
  /\b(AMG|M|M-Sport|M Sport)\b/i,
  /\b(Type R|Type-R|Type S|Type-S)\b/i,
  /\b(TRD|TRD Pro|TRD Off-Road|NISMO|STI|WRX)\b/i,
  /\b(Shelby|Raptor|Hellcat|Demon|Redeye|Blackwing)\b/i,
  /\b(Track|Track Pack|Performance Pack|Performance Pkg)\b/i,
  /\b(ZL1|Z06|Z07|ZR1|ZR2|Z28)\b/i,
  /\b(Scat Pack|Widebody|1LE|SS 1LE)\b/i,
  /\b(Dark Horse|Mach 1|Boss)\b/i,
  /\b(Trail Boss|AT4|AT4X|Tremor|Sasquatch)\b/i,
];

function isPerformanceTrim(displayTrim: string | null): boolean {
  if (!displayTrim) return false;
  return PERFORMANCE_TRIM_PATTERNS.some(p => p.test(displayTrim));
}

function getPerformanceClass(displayTrim: string | null): string | null {
  if (!displayTrim) return null;
  
  // Extract performance package identifier
  for (const pattern of PERFORMANCE_TRIM_PATTERNS) {
    const match = displayTrim.match(pattern);
    if (match) return match[0].toUpperCase();
  }
  
  return null;
}

// ============================================================================
// HD Truck Detection
// ============================================================================

const HD_TRUCK_PATTERNS = [
  /\b(2500|3500|4500|5500)\b/,
  /\b(HD|Heavy Duty)\b/i,
  /\b(DRW|Dually|Dual Rear)\b/i,
  /\b(SRW|Single Rear)\b/i,
];

function isHDTruck(model: string): boolean {
  return HD_TRUCK_PATTERNS.some(p => p.test(model));
}

// ============================================================================
// Core Equivalence Check
// ============================================================================

/**
 * Check if two fitments are equivalent for safe fallback.
 * 
 * Equivalence requires:
 * - Same bolt pattern
 * - Same center bore (within tolerance)
 * - Same thread size
 * - Same OEM wheel diameter range
 * - Same tire rim diameter range
 * - Same stagger behavior
 * - Same performance class (if applicable)
 */
export function checkFitmentEquivalence(
  source: VehicleFitment,
  target: VehicleFitment
): EquivalenceCheck {
  const matchedSpecs: string[] = [];
  const mismatchedSpecs: string[] = [];
  const warnings: string[] = [];
  
  // 1. Bolt Pattern - MUST MATCH
  const sourceBolt = source.boltPattern?.toUpperCase().replace(/\s/g, "");
  const targetBolt = target.boltPattern?.toUpperCase().replace(/\s/g, "");
  
  if (!sourceBolt || !targetBolt) {
    return {
      isEquivalent: false,
      confidence: "needs_manual_verification",
      matchedSpecs: [],
      mismatchedSpecs: ["bolt_pattern (missing)"],
      warnings: ["Bolt pattern unknown for one or both trims"],
    };
  }
  
  if (sourceBolt === targetBolt) {
    matchedSpecs.push(`bolt_pattern: ${sourceBolt}`);
  } else {
    mismatchedSpecs.push(`bolt_pattern: ${sourceBolt} vs ${targetBolt}`);
  }
  
  // 2. Center Bore - MUST MATCH (within 0.5mm tolerance)
  const sourceBore = source.centerBoreMm ? Number(source.centerBoreMm) : null;
  const targetBore = target.centerBoreMm ? Number(target.centerBoreMm) : null;
  
  if (sourceBore && targetBore) {
    if (Math.abs(sourceBore - targetBore) <= 0.5) {
      matchedSpecs.push(`center_bore: ${sourceBore}mm`);
    } else {
      mismatchedSpecs.push(`center_bore: ${sourceBore}mm vs ${targetBore}mm`);
    }
  } else {
    warnings.push("Center bore unknown for one or both trims");
  }
  
  // 3. Thread Size - MUST MATCH
  const sourceThread = source.threadSize?.toUpperCase();
  const targetThread = target.threadSize?.toUpperCase();
  
  if (sourceThread && targetThread) {
    if (sourceThread === targetThread) {
      matchedSpecs.push(`thread_size: ${sourceThread}`);
    } else {
      mismatchedSpecs.push(`thread_size: ${sourceThread} vs ${targetThread}`);
    }
  } else if (sourceThread || targetThread) {
    warnings.push("Thread size unknown for one trim");
  }
  
  // 4. OEM Wheel Diameter Range - SHOULD MATCH
  const sourceWheels = parseOemWheelSizes(source.oemWheelSizes);
  const targetWheels = parseOemWheelSizes(target.oemWheelSizes);
  const sourceDiamRange = getDiameterRange(sourceWheels);
  const targetDiamRange = getDiameterRange(targetWheels);
  
  if (sourceDiamRange && targetDiamRange) {
    if (sourceDiamRange.min === targetDiamRange.min && 
        sourceDiamRange.max === targetDiamRange.max) {
      matchedSpecs.push(`wheel_diameter_range: ${sourceDiamRange.min}-${sourceDiamRange.max}"`);
    } else {
      mismatchedSpecs.push(
        `wheel_diameter_range: ${sourceDiamRange.min}-${sourceDiamRange.max}" vs ${targetDiamRange.min}-${targetDiamRange.max}"`
      );
    }
  } else {
    warnings.push("Wheel diameter range unknown");
  }
  
  // 5. Tire Rim Diameter Range - SHOULD MATCH
  const sourceTires = Array.isArray(source.oemTireSizes) ? source.oemTireSizes : [];
  const targetTires = Array.isArray(target.oemTireSizes) ? target.oemTireSizes : [];
  const sourceTireRange = getTireRimDiameterRange(sourceTires);
  const targetTireRange = getTireRimDiameterRange(targetTires);
  
  if (sourceTireRange && targetTireRange) {
    if (sourceTireRange.min === targetTireRange.min && 
        sourceTireRange.max === targetTireRange.max) {
      matchedSpecs.push(`tire_rim_diameter: ${sourceTireRange.min}-${sourceTireRange.max}"`);
    } else {
      mismatchedSpecs.push(
        `tire_rim_diameter: ${sourceTireRange.min}-${sourceTireRange.max}" vs ${targetTireRange.min}-${targetTireRange.max}"`
      );
    }
  } else {
    warnings.push("Tire rim diameter range unknown");
  }
  
  // 6. Stagger Behavior - MUST MATCH
  const sourceStaggered = isStaggeredSetup(sourceWheels);
  const targetStaggered = isStaggeredSetup(targetWheels);
  
  if (sourceWheels.length > 0 && targetWheels.length > 0) {
    if (sourceStaggered === targetStaggered) {
      matchedSpecs.push(`stagger: ${sourceStaggered ? "staggered" : "square"}`);
    } else {
      mismatchedSpecs.push(`stagger: ${sourceStaggered ? "staggered" : "square"} vs ${targetStaggered ? "staggered" : "square"}`);
    }
  }
  
  // 7. Performance Class - MUST MATCH if either is performance
  const sourcePerf = getPerformanceClass(source.displayTrim);
  const targetPerf = getPerformanceClass(target.displayTrim);
  
  if (sourcePerf || targetPerf) {
    if (sourcePerf === targetPerf) {
      matchedSpecs.push(`performance_class: ${sourcePerf || "standard"}`);
    } else {
      mismatchedSpecs.push(`performance_class: ${sourcePerf || "standard"} vs ${targetPerf || "standard"}`);
    }
  }
  
  // Determine confidence level
  let confidence: FallbackConfidence;
  
  if (mismatchedSpecs.length > 0) {
    // Any critical mismatch = not equivalent
    confidence = "needs_manual_verification";
  } else if (matchedSpecs.length >= 3 && warnings.length === 0) {
    // Strong match with no warnings
    confidence = "equivalent_certified";
  } else if (matchedSpecs.includes(`bolt_pattern: ${sourceBolt}`) && sourceBore && targetBore) {
    // Bolt + bore match = wheel safe
    confidence = "wheel_safe_only";
  } else {
    confidence = "needs_manual_verification";
  }
  
  return {
    isEquivalent: mismatchedSpecs.length === 0 && matchedSpecs.length >= 2,
    confidence,
    matchedSpecs,
    mismatchedSpecs,
    warnings,
  };
}

// ============================================================================
// Find Best Equivalent Fallback
// ============================================================================

/**
 * Find the best equivalent fallback from a list of certified candidates.
 * 
 * Priority:
 * 1. Exact certified match (same trim)
 * 2. Equivalent certified (all specs match)
 * 3. Wheel-safe only (bolt/bore/thread match)
 * 4. No fallback (blocked)
 */
export function findBestFallback(
  sourceNeedsReview: VehicleFitment,
  certifiedCandidates: VehicleFitment[]
): FallbackResult {
  if (certifiedCandidates.length === 0) {
    return {
      allowed: false,
      confidence: "blocked",
      fallbackTrim: null,
      reasons: ["No certified trims available for this vehicle"],
      warnings: [],
    };
  }
  
  let bestEquivalent: VehicleFitment | null = null;
  let bestEquivalentCheck: EquivalenceCheck | null = null;
  
  let bestWheelSafe: VehicleFitment | null = null;
  let bestWheelSafeCheck: EquivalenceCheck | null = null;
  
  for (const candidate of certifiedCandidates) {
    const check = checkFitmentEquivalence(sourceNeedsReview, candidate);
    
    if (check.isEquivalent && check.confidence === "equivalent_certified") {
      // Found equivalent - use first one
      if (!bestEquivalent) {
        bestEquivalent = candidate;
        bestEquivalentCheck = check;
      }
    } else if (check.confidence === "wheel_safe_only") {
      // Wheel safe candidate
      if (!bestWheelSafe) {
        bestWheelSafe = candidate;
        bestWheelSafeCheck = check;
      }
    }
  }
  
  // Return best match
  if (bestEquivalent && bestEquivalentCheck) {
    return {
      allowed: true,
      confidence: "equivalent_certified",
      fallbackTrim: bestEquivalent,
      reasons: [
        `Using equivalent certified trim: ${bestEquivalent.displayTrim}`,
        ...bestEquivalentCheck.matchedSpecs.map(s => `Matched: ${s}`),
      ],
      warnings: bestEquivalentCheck.warnings,
    };
  }
  
  if (bestWheelSafe && bestWheelSafeCheck) {
    return {
      allowed: true,
      confidence: "wheel_safe_only",
      fallbackTrim: bestWheelSafe,
      reasons: [
        `Wheel fitment verified using: ${bestWheelSafe.displayTrim}`,
        ...bestWheelSafeCheck.matchedSpecs.map(s => `Matched: ${s}`),
      ],
      warnings: [
        "Tire and package fitment requires confirmation",
        ...bestWheelSafeCheck.warnings,
        ...bestWheelSafeCheck.mismatchedSpecs.map(s => `Differs: ${s}`),
      ],
    };
  }
  
  // No safe fallback found
  return {
    allowed: false,
    confidence: "needs_manual_verification",
    fallbackTrim: null,
    reasons: ["No equivalent certified trim found"],
    warnings: [
      "This trim has unique fitment specs that differ from available certified trims",
      `Requested: ${sourceNeedsReview.displayTrim}`,
      `Available certified: ${certifiedCandidates.map(c => c.displayTrim).join(", ")}`,
    ],
  };
}

// ============================================================================
// UI Messaging
// ============================================================================

export function getConfidenceMessage(confidence: FallbackConfidence): {
  badge: string;
  message: string;
  showGuaranteedFit: boolean;
  color: "green" | "yellow" | "orange" | "red";
} {
  switch (confidence) {
    case "exact_certified":
      return {
        badge: "Guaranteed Fit",
        message: "Verified fitment for your exact vehicle configuration.",
        showGuaranteedFit: true,
        color: "green",
      };
    
    case "equivalent_certified":
      return {
        badge: "Verified Fit",
        message: "Verified using matching fitment group with identical specs.",
        showGuaranteedFit: true,
        color: "green",
      };
    
    case "wheel_safe_only":
      return {
        badge: "Wheel Verified",
        message: "Wheel fitment verified by bolt pattern and hub bore. Tire and package fitment requires confirmation.",
        showGuaranteedFit: false,
        color: "yellow",
      };
    
    case "needs_manual_verification":
      return {
        badge: "Verification Required",
        message: "This trim needs manual fitment verification. Contact us for assistance.",
        showGuaranteedFit: false,
        color: "orange",
      };
    
    case "blocked":
      return {
        badge: "Fitment Unavailable",
        message: "We don't have verified fitment data for this configuration yet.",
        showGuaranteedFit: false,
        color: "red",
      };
    
    default:
      return {
        badge: "Unknown",
        message: "Fitment status unknown.",
        showGuaranteedFit: false,
        color: "red",
      };
  }
}
