/**
 * Tire Plus-Sizing Engine
 * 
 * Uses the real tire-sizes.json database as the source of truth.
 * Calculates valid plus-size candidates based on overall diameter matching.
 * 
 * Rules:
 * 1. Parse OEM metric size
 * 2. Compute OEM overall diameter
 * 3. Filter real metric sizes by selected wheel rim diameter
 * 4. Score candidates by overall diameter difference
 * 5. Keep only sizes within ±3%, with ±2% marked as primary
 * 6. Optionally filter by selected wheel width
 * 7. Never show a tire whose rim does not equal the selected wheel diameter
 * 8. Never fall back to OEM sizes when a non-OEM wheel diameter is selected
 * 9. Return ranked plus-size candidates before inventory lookup
 */

import tireSizesData from "@/data/tire-sizes.json";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ParsedMetricSize = {
  width: number;      // Section width in mm (e.g., 225)
  aspect: number;     // Aspect ratio (e.g., 65)
  rim: number;        // Rim diameter in inches (e.g., 17)
  raw: string;        // Original string
};

export type ParsedFlotationSize = {
  diameter: number;   // Overall diameter in inches (e.g., 33)
  width: number;      // Section width in inches (e.g., 12.5)
  rim: number;        // Rim diameter in inches (e.g., 17)
  raw: string;        // Original string (e.g., "33x12.50R17")
};

export type PlusSizeCandidate = {
  size: string;           // Tire size string (e.g., "235/55R18")
  rimDiameter: number;    // Rim diameter (must match selected wheel)
  overallDiameter: number; // Calculated OD in inches
  odDiffPercent: number;  // % difference from OEM OD (negative = smaller, positive = larger)
  odDiffInches: number;   // Absolute difference in inches
  isPrimary: boolean;     // true if within ±2% (preferred)
  isAcceptable: boolean;  // true if within ±3% (acceptable)
  widthMm: number;        // Section width in mm
  aspectRatio: number;    // Aspect ratio
};

export type PlusSizeResult = {
  oemSize: string;
  oemParsed: ParsedMetricSize | null;
  oemOverallDiameter: number | null;
  targetRimDiameter: number;
  candidates: PlusSizeCandidate[];
  primaryCandidates: PlusSizeCandidate[];   // ±2% OD
  acceptableCandidates: PlusSizeCandidate[]; // ±3% OD (includes primary)
  debug?: {
    totalSizesInDb: number;
    sizesMatchingRim: number;
    sizesWithin3Percent: number;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// TIRE SIZE PARSING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a metric tire size string (e.g., "225/65R17", "LT265/70R17", "P215/55R17")
 */
export function parseMetricSize(size: string): ParsedMetricSize | null {
  if (!size) return null;
  
  // Normalize: uppercase, remove common prefixes
  const s = String(size).trim().toUpperCase()
    .replace(/^(LT|P|T)\s*/, "")  // Remove LT/P/T prefixes
    .replace(/\s+/g, "");
  
  // Match standard metric format: 225/65R17 or 225/65ZR17
  const match = s.match(/^(\d{3})\/(\d{2,3})(?:ZR|R)(\d{2})$/);
  if (!match) return null;
  
  return {
    width: parseInt(match[1], 10),
    aspect: parseInt(match[2], 10),
    rim: parseInt(match[3], 10),
    raw: size.trim(),
  };
}

/**
 * Parse a flotation tire size string (e.g., "33x12.50R17")
 */
export function parseFlotationSize(size: string): ParsedFlotationSize | null {
  if (!size) return null;
  
  const s = String(size).trim().toUpperCase().replace(/\s+/g, "");
  
  // Match flotation format: 33x12.50R17 or 35x12.5R20
  const match = s.match(/^(\d{2})X([\d.]+)R(\d{2}(?:\.\d)?)$/);
  if (!match) return null;
  
  return {
    diameter: parseInt(match[1], 10),
    width: parseFloat(match[2]),
    rim: parseFloat(match[3]),
    raw: size.trim(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERALL DIAMETER CALCULATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate overall tire diameter in inches from metric size components.
 * 
 * Formula: OD = (width × aspect/100 × 2 / 25.4) + rim
 * 
 * - Sidewall height = width × (aspect / 100)
 * - Total sidewall contribution = sidewall × 2 (top + bottom)
 * - Convert mm to inches: / 25.4
 * - Add rim diameter
 */
export function calculateOverallDiameter(width: number, aspect: number, rim: number): number {
  const sidewallHeightMm = width * (aspect / 100);
  const totalSidewallInches = (sidewallHeightMm * 2) / 25.4;
  return totalSidewallInches + rim;
}

/**
 * Calculate overall diameter from a parsed metric size
 */
export function calculateOdFromParsed(parsed: ParsedMetricSize): number {
  return calculateOverallDiameter(parsed.width, parsed.aspect, parsed.rim);
}

// ─────────────────────────────────────────────────────────────────────────────
// WIDTH COMPATIBILITY (OPTIONAL FILTER)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a tire width (mm) is compatible with a wheel width (inches).
 * 
 * General rule: tire width should be ~1.5-2.5× the wheel width.
 * More precisely: (tire width mm) / 25.4 ≈ wheel width × 0.7 to 1.1
 * 
 * This is a loose guideline - manufacturers publish specific ranges.
 */
export function isWidthCompatible(tireWidthMm: number, wheelWidthInches: number): boolean {
  if (!wheelWidthInches || wheelWidthInches <= 0) return true; // No wheel width specified
  
  // Convert tire width to inches
  const tireWidthInches = tireWidthMm / 25.4;
  
  // Typical ratio: tire width is 0.85 to 1.15 times the wheel width × 10
  // Or more simply: wheel width should be tire width (in) × 0.7 to 1.0
  const minRatio = 0.65;
  const maxRatio = 1.05;
  
  const ratio = wheelWidthInches / tireWidthInches;
  return ratio >= minRatio && ratio <= maxRatio;
}

/**
 * Recommended wheel width range for a tire (returns [min, max] in inches)
 */
export function recommendedWheelWidthRange(tireWidthMm: number): [number, number] {
  // Industry standard: wheel width = tire section width / 25.4 × 0.7 to 0.85
  const tireWidthInches = tireWidthMm / 25.4;
  return [
    Math.round((tireWidthInches * 0.7) * 2) / 2,  // Round to nearest 0.5
    Math.round((tireWidthInches * 0.95) * 2) / 2,
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// PLUS-SIZING ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate plus-size tire candidates for a given OEM size and target wheel diameter.
 * 
 * @param oemSize - The original OEM tire size (e.g., "225/65R17")
 * @param targetRimDiameter - The wheel diameter to find tires for (e.g., 20)
 * @param options - Optional filters
 */
export function generatePlusSizeCandidates(
  oemSize: string,
  targetRimDiameter: number,
  options: {
    wheelWidth?: number;        // Optional wheel width filter (inches)
    maxOdDiffPercent?: number;  // Max OD difference (default: 3%)
    primaryOdDiffPercent?: number; // Primary threshold (default: 2%)
  } = {}
): PlusSizeResult {
  const {
    wheelWidth,
    maxOdDiffPercent = 3,
    primaryOdDiffPercent = 2,
  } = options;

  // Parse OEM size
  const oemParsed = parseMetricSize(oemSize);
  
  if (!oemParsed) {
    // Can't parse OEM size - return empty result
    return {
      oemSize,
      oemParsed: null,
      oemOverallDiameter: null,
      targetRimDiameter,
      candidates: [],
      primaryCandidates: [],
      acceptableCandidates: [],
      debug: {
        totalSizesInDb: tireSizesData.metric.length,
        sizesMatchingRim: 0,
        sizesWithin3Percent: 0,
      },
    };
  }

  // Calculate OEM overall diameter
  const oemOd = calculateOdFromParsed(oemParsed);

  // Filter tire database to only sizes matching target rim diameter
  const sizesMatchingRim = tireSizesData.metric.filter((size) => {
    const parsed = parseMetricSize(size);
    return parsed && parsed.rim === targetRimDiameter;
  });

  // Score each candidate by OD difference
  const scoredCandidates: PlusSizeCandidate[] = [];

  for (const size of sizesMatchingRim) {
    const parsed = parseMetricSize(size);
    if (!parsed) continue;

    // Calculate candidate's overall diameter
    const candidateOd = calculateOdFromParsed(parsed);
    
    // Calculate OD difference
    const odDiffInches = candidateOd - oemOd;
    const odDiffPercent = (odDiffInches / oemOd) * 100;
    const absOdDiffPercent = Math.abs(odDiffPercent);

    // Skip if outside acceptable range
    if (absOdDiffPercent > maxOdDiffPercent) continue;

    // Optional: filter by wheel width compatibility
    if (wheelWidth && !isWidthCompatible(parsed.width, wheelWidth)) continue;

    const isPrimary = absOdDiffPercent <= primaryOdDiffPercent;
    const isAcceptable = absOdDiffPercent <= maxOdDiffPercent;

    scoredCandidates.push({
      size,
      rimDiameter: parsed.rim,
      overallDiameter: Math.round(candidateOd * 100) / 100,
      odDiffPercent: Math.round(odDiffPercent * 100) / 100,
      odDiffInches: Math.round(odDiffInches * 100) / 100,
      isPrimary,
      isAcceptable,
      widthMm: parsed.width,
      aspectRatio: parsed.aspect,
    });
  }

  // Sort by absolute OD difference (closest to OEM first)
  scoredCandidates.sort((a, b) => Math.abs(a.odDiffPercent) - Math.abs(b.odDiffPercent));

  // Split into primary and acceptable
  const primaryCandidates = scoredCandidates.filter((c) => c.isPrimary);
  const acceptableCandidates = scoredCandidates.filter((c) => c.isAcceptable);

  return {
    oemSize,
    oemParsed,
    oemOverallDiameter: Math.round(oemOd * 100) / 100,
    targetRimDiameter,
    candidates: scoredCandidates,
    primaryCandidates,
    acceptableCandidates,
    debug: {
      totalSizesInDb: tireSizesData.metric.length,
      sizesMatchingRim: sizesMatchingRim.length,
      sizesWithin3Percent: scoredCandidates.length,
    },
  };
}

/**
 * Get plus-size candidates for multiple OEM sizes (e.g., front and rear on staggered fitment).
 * Returns the intersection of valid sizes that work for all OEM sizes.
 */
export function generatePlusSizeCandidatesMulti(
  oemSizes: string[],
  targetRimDiameter: number,
  options: {
    wheelWidth?: number;
    maxOdDiffPercent?: number;
    primaryOdDiffPercent?: number;
  } = {}
): PlusSizeCandidate[] {
  if (oemSizes.length === 0) return [];
  
  // For single OEM size, use standard function
  if (oemSizes.length === 1) {
    return generatePlusSizeCandidates(oemSizes[0], targetRimDiameter, options).acceptableCandidates;
  }

  // For multiple sizes, find candidates that work for all
  const allResults = oemSizes.map((size) =>
    generatePlusSizeCandidates(size, targetRimDiameter, options)
  );

  // Find intersection of acceptable sizes
  const sizeSetMap = new Map<string, PlusSizeCandidate[]>();
  
  for (const result of allResults) {
    for (const candidate of result.acceptableCandidates) {
      const existing = sizeSetMap.get(candidate.size) || [];
      existing.push(candidate);
      sizeSetMap.set(candidate.size, existing);
    }
  }

  // Only include sizes that appear in ALL results
  const intersection: PlusSizeCandidate[] = [];
  for (const [size, candidates] of sizeSetMap) {
    if (candidates.length === oemSizes.length) {
      // Use average OD diff for sorting
      const avgOdDiff = candidates.reduce((sum, c) => sum + Math.abs(c.odDiffPercent), 0) / candidates.length;
      const representative = { ...candidates[0], odDiffPercent: avgOdDiff };
      intersection.push(representative);
    }
  }

  // Sort by OD difference
  intersection.sort((a, b) => Math.abs(a.odDiffPercent) - Math.abs(b.odDiffPercent));
  return intersection;
}

/**
 * Quick utility to get just the plus-size strings for a given scenario.
 */
export function getPlusSizesForWheel(
  oemSize: string,
  wheelDiameter: number,
  wheelWidth?: number
): string[] {
  const result = generatePlusSizeCandidates(oemSize, wheelDiameter, { wheelWidth });
  return result.acceptableCandidates.map((c) => c.size);
}

/**
 * Format a candidate for display (e.g., "245/40R20 (+1.2%)")
 */
export function formatCandidateLabel(candidate: PlusSizeCandidate): string {
  const sign = candidate.odDiffPercent >= 0 ? "+" : "";
  return `${candidate.size} (${sign}${candidate.odDiffPercent.toFixed(1)}%)`;
}

// ─────────────────────────────────────────────────────────────────────────────
// AFTERMARKET TIRE SIZING (NO OEM REFERENCE)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate tire size candidates when NO OEM reference is available.
 * Used for aftermarket wheels on vehicles without fitment data.
 * 
 * Uses wheel diameter and width to suggest appropriate tire sizes
 * from the tire database, based on industry-standard fitment rules.
 * 
 * @param wheelDiameter - Wheel rim diameter in inches (e.g., 18)
 * @param wheelWidth - Wheel width in inches (e.g., 9.0)
 * @param vehicleClass - Optional hint: 'truck', 'suv', 'car' for better suggestions
 */
export function generateAftermarketTireSizes(
  wheelDiameter: number,
  wheelWidth?: number,
  vehicleClass?: 'truck' | 'suv' | 'car'
): {
  sizes: string[];
  candidates: PlusSizeCandidate[];
  method: 'aftermarket-fallback';
  debug: {
    wheelDiameter: number;
    wheelWidth: number | null;
    vehicleClass: string | null;
    sizesMatchingRim: number;
    sizesMatchingWidth: number;
  };
} {
  // Get all tire sizes matching the wheel diameter
  const sizesMatchingRim = tireSizesData.metric.filter((size) => {
    const parsed = parseMetricSize(size);
    return parsed && parsed.rim === wheelDiameter;
  });

  // If wheel width provided, filter to compatible widths
  // Standard rule: tire width (mm) / 25.4 × 0.7 to 1.0 = wheel width
  // Inverted: tire width (mm) = wheel width × 25.4 × 1.0 to 1.43
  let candidates: PlusSizeCandidate[] = [];
  
  for (const size of sizesMatchingRim) {
    const parsed = parseMetricSize(size);
    if (!parsed) continue;
    
    // Width compatibility check
    if (wheelWidth && wheelWidth > 0) {
      const minTireWidth = Math.floor(wheelWidth * 25.4 * 0.95);  // Wheel width × ~24mm per inch (min)
      const maxTireWidth = Math.ceil(wheelWidth * 25.4 * 1.35);   // Wheel width × ~34mm per inch (max)
      
      if (parsed.width < minTireWidth || parsed.width > maxTireWidth) {
        continue;
      }
    }
    
    // Calculate overall diameter for reference
    const od = calculateOdFromParsed(parsed);
    
    // For trucks/SUVs, prefer larger aspect ratios (60-75) for comfort
    // For cars, prefer lower aspect ratios (30-45) for performance
    let aspectScore = 0;
    if (vehicleClass === 'truck' || vehicleClass === 'suv') {
      if (parsed.aspect >= 60 && parsed.aspect <= 75) aspectScore = 2;
      else if (parsed.aspect >= 50 && parsed.aspect <= 80) aspectScore = 1;
    } else if (vehicleClass === 'car') {
      // Performance cars: 30-40 is primary (sports cars), 25-50 is acceptable
      if (parsed.aspect >= 30 && parsed.aspect <= 40) aspectScore = 2;
      else if (parsed.aspect >= 25 && parsed.aspect <= 55) aspectScore = 1;
    } else {
      // Default: prefer middle-of-road aspect ratios
      if (parsed.aspect >= 45 && parsed.aspect <= 70) aspectScore = 1;
    }
    
    candidates.push({
      size,
      rimDiameter: parsed.rim,
      overallDiameter: Math.round(od * 100) / 100,
      odDiffPercent: 0, // No reference, so no diff
      odDiffInches: 0,
      isPrimary: aspectScore >= 2,
      isAcceptable: aspectScore >= 1,
      widthMm: parsed.width,
      aspectRatio: parsed.aspect,
    });
  }
  
  // Sort: primary first, then by width
  // For cars: prefer wider tires (performance vehicles run wider)
  // For trucks/SUVs: prefer narrower tires (better off-road)
  candidates.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    // Prefer common widths (divisible by 5)
    const aCommon = a.widthMm % 5 === 0 ? 0 : 1;
    const bCommon = b.widthMm % 5 === 0 ? 0 : 1;
    if (aCommon !== bCommon) return aCommon - bCommon;
    // For cars: wider is better (descending), for trucks: narrower (ascending)
    return vehicleClass === 'car' 
      ? b.widthMm - a.widthMm  // Cars: wider first
      : a.widthMm - b.widthMm; // Trucks/SUVs: narrower first
  });
  
  // Limit to reasonable number of suggestions
  const limitedCandidates = candidates.slice(0, 20);
  
  return {
    sizes: limitedCandidates.map(c => c.size),
    candidates: limitedCandidates,
    method: 'aftermarket-fallback',
    debug: {
      wheelDiameter,
      wheelWidth: wheelWidth ?? null,
      vehicleClass: vehicleClass ?? null,
      sizesMatchingRim: sizesMatchingRim.length,
      sizesMatchingWidth: candidates.length,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE STATS (for debugging)
// ─────────────────────────────────────────────────────────────────────────────

export function getTireDatabaseStats(): {
  totalMetric: number;
  totalFlotation: number;
  rimDiametersAvailable: number[];
  widthsAvailable: number[];
} {
  const metricSizes = tireSizesData.metric;
  const flotationSizes = tireSizesData.flotation;
  
  const rims = new Set<number>();
  const widths = new Set<number>();
  
  for (const size of metricSizes) {
    const parsed = parseMetricSize(size);
    if (parsed) {
      rims.add(parsed.rim);
      widths.add(parsed.width);
    }
  }
  
  return {
    totalMetric: metricSizes.length,
    totalFlotation: flotationSizes.length,
    rimDiametersAvailable: Array.from(rims).sort((a, b) => a - b),
    widthsAvailable: Array.from(widths).sort((a, b) => a - b),
  };
}
