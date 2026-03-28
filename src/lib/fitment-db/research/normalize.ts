/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * FITMENT RESEARCH NORMALIZATION
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Converts raw research findings into normalized candidate records.
 * Handles format variations, unit conversions, and data extraction.
 * 
 * @created 2026-03-28
 */

import type {
  RawFitmentFinding,
  FitmentFieldType,
  NormalizedFitmentCandidate,
  OEMWheelSizeCandidate,
  FitmentException,
  FitmentResearchInput,
  FieldConfidence,
} from "./types";
import { normalizeMake, normalizeModel } from "../normalization";

// ═══════════════════════════════════════════════════════════════════════════════
// BOLT PATTERN NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Common bolt pattern conversions (imperial to metric)
 */
const BOLT_PATTERN_CONVERSIONS: Record<string, string> = {
  "4x4.5": "4x114.3",
  "4x4.25": "4x108",
  "5x4.5": "5x114.3",
  "5x4.75": "5x120.65",
  "5x5": "5x127",
  "5x5.5": "5x139.7",
  "6x4.5": "6x114.3",
  "6x5.5": "6x139.7",
  "8x6.5": "8x165.1",
  "8x170": "8x170",
};

/**
 * Normalize bolt pattern to metric format
 */
export function normalizeBoltPattern(value: string): { 
  metric: string; 
  imperial?: string;
} | null {
  if (!value) return null;
  
  const cleaned = value.toLowerCase().replace(/\s/g, "").replace(/×/g, "x");
  
  // Already metric (e.g., "6x139.7")
  const metricMatch = cleaned.match(/^(\d)x(\d{2,3}(?:\.\d+)?)$/);
  if (metricMatch) {
    const [, lugs, pcd] = metricMatch;
    const pcdNum = parseFloat(pcd);
    
    // Check if it's actually imperial that looks metric
    if (pcdNum <= 10) {
      // This is imperial (e.g., "5x5.5")
      const imperial = `${lugs}x${pcd}`;
      const metric = BOLT_PATTERN_CONVERSIONS[imperial];
      return metric ? { metric, imperial } : null;
    }
    
    // Find imperial equivalent
    let imperial: string | undefined;
    for (const [imp, met] of Object.entries(BOLT_PATTERN_CONVERSIONS)) {
      if (met === `${lugs}x${pcd}` || Math.abs(parseFloat(met.split("x")[1]) - pcdNum) < 0.5) {
        imperial = imp;
        break;
      }
    }
    
    return { metric: `${lugs}x${pcd}`, imperial };
  }
  
  // Imperial format (e.g., "6x5.5")
  const imperialMatch = cleaned.match(/^(\d)x(\d+(?:\.\d+)?)"?$/);
  if (imperialMatch) {
    const [, lugs, pcd] = imperialMatch;
    const imperial = `${lugs}x${pcd}`;
    const metric = BOLT_PATTERN_CONVERSIONS[imperial];
    return metric ? { metric, imperial } : null;
  }
  
  // Try other formats
  const altMatch = value.match(/(\d)\s*(?:lug|bolt|x|on)\s*(\d+(?:\.\d+)?)/i);
  if (altMatch) {
    const [, lugs, pcd] = altMatch;
    const pcdNum = parseFloat(pcd);
    if (pcdNum > 50) {
      return { metric: `${lugs}x${pcd}` };
    } else {
      const imperial = `${lugs}x${pcd}`;
      const metric = BOLT_PATTERN_CONVERSIONS[imperial];
      return metric ? { metric, imperial } : null;
    }
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CENTER BORE NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize center bore to mm
 */
export function normalizeCenterBore(value: string): number | null {
  if (!value) return null;
  
  const cleaned = value.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  
  if (isNaN(num)) return null;
  
  // Common center bores are typically 54-110mm
  // If the value is clearly in a different unit, convert
  if (num >= 50 && num <= 120) {
    return Math.round(num * 10) / 10;
  }
  
  // Might be in inches if very small
  if (num >= 2 && num <= 5) {
    return Math.round(num * 25.4 * 10) / 10;
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// OFFSET NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize offset value to mm
 */
export function normalizeOffset(value: string): number | null {
  if (!value) return null;
  
  // Handle ET notation (ET20, ET+20, ET-15)
  const etMatch = value.match(/ET\s*([+-]?\d+)/i);
  if (etMatch) {
    return parseInt(etMatch[1], 10);
  }
  
  // Handle mm notation (20mm, +20mm, -15mm)
  const mmMatch = value.match(/([+-]?\d+)\s*mm/i);
  if (mmMatch) {
    return parseInt(mmMatch[1], 10);
  }
  
  // Plain number
  const num = parseInt(value.replace(/[^0-9+-]/g, ""), 10);
  if (!isNaN(num) && num >= -50 && num <= 100) {
    return num;
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// THREAD SIZE NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize thread size format
 */
export function normalizeThreadSize(value: string): string | null {
  if (!value) return null;
  
  const cleaned = value.trim().toUpperCase();
  
  // Metric format (M12x1.5, 14x1.5, M14X1.5)
  const metricMatch = cleaned.match(/M?(\d{1,2})\s*[Xx]\s*(\d+(?:\.\d+)?)/);
  if (metricMatch) {
    return `${metricMatch[1]}x${metricMatch[2]}`;
  }
  
  // Imperial format (1/2-20, 9/16-18)
  const imperialMatch = cleaned.match(/(\d+)\/(\d+)\s*-\s*(\d+)/);
  if (imperialMatch) {
    return `${imperialMatch[1]}/${imperialMatch[2]}-${imperialMatch[3]}`;
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// OEM WHEEL SIZE PARSING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse OEM wheel size from various formats
 * e.g., "18x8", "18x8 ET20", "18x8 +20", "18 x 8.5 inch"
 */
export function parseOEMWheelSize(value: string, sourceName: string): OEMWheelSizeCandidate | null {
  if (!value) return null;
  
  // Match diameter x width with optional offset
  const match = value.match(/(\d{2})\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(?:inch|"|in)?\s*(?:ET|offset|\+|-)?\s*([+-]?\d+)?/i);
  
  if (!match) return null;
  
  const diameter = parseInt(match[1], 10);
  const width = parseFloat(match[2]);
  const offset = match[3] ? parseInt(match[3], 10) : undefined;
  
  // Validate reasonable ranges
  if (diameter < 14 || diameter > 26) return null;
  if (width < 5 || width > 14) return null;
  if (offset !== undefined && (offset < -50 || offset > 100)) return null;
  
  return {
    diameter,
    width,
    offset,
    axle: "both",
    isStock: true,
    source: sourceName,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// OEM TIRE SIZE PARSING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize OEM tire size format
 * e.g., "275/60R20", "P275/60R20", "35x12.50R17LT"
 */
export function normalizeOEMTireSize(value: string): string | null {
  if (!value) return null;
  
  const cleaned = value.toUpperCase().replace(/\s/g, "");
  
  // Standard format: P275/60R20
  const stdMatch = cleaned.match(/P?(\d{3})\/(\d{2,3})R(\d{2})/);
  if (stdMatch) {
    return `${stdMatch[1]}/${stdMatch[2]}R${stdMatch[3]}`;
  }
  
  // LT format: LT275/70R17
  const ltMatch = cleaned.match(/LT(\d{3})\/(\d{2,3})R(\d{2})/);
  if (ltMatch) {
    return `LT${ltMatch[1]}/${ltMatch[2]}R${ltMatch[3]}`;
  }
  
  // Flotation format: 35x12.50R17
  const flotMatch = cleaned.match(/(\d{2,3})[Xx](\d{1,2}(?:\.\d{2})?)[Rr](\d{2})/);
  if (flotMatch) {
    return `${flotMatch[1]}x${flotMatch[2]}R${flotMatch[3]}`;
  }
  
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATION EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract generation info from findings
 */
export function extractGenerationInfo(findings: RawFitmentFinding[]): {
  generation?: string;
  yearRange?: { start: number; end: number };
} {
  const genFindings = findings.filter(f => f.field === "generation");
  const yearFindings = findings.filter(f => f.field === "yearRange");
  
  let generation: string | undefined;
  let yearRange: { start: number; end: number } | undefined;
  
  if (genFindings.length > 0) {
    // Take highest confidence generation finding
    const sorted = genFindings.sort((a, b) => b.confidence - a.confidence);
    generation = sorted[0].value;
  }
  
  if (yearFindings.length > 0) {
    const sorted = yearFindings.sort((a, b) => b.confidence - a.confidence);
    const rangeMatch = sorted[0].value.match(/(\d{4})\s*[-–]\s*(\d{4})/);
    if (rangeMatch) {
      yearRange = {
        start: parseInt(rangeMatch[1], 10),
        end: parseInt(rangeMatch[2], 10),
      };
    }
  }
  
  return { generation, yearRange };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXCEPTION EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract exceptions from findings
 */
export function extractExceptions(findings: RawFitmentFinding[]): FitmentException[] {
  const exceptionFindings = findings.filter(f => f.field === "exception");
  const exceptions: FitmentException[] = [];
  
  for (const f of exceptionFindings) {
    // Try to parse structured exception info
    const value = f.value;
    
    // Check for variant exception (e.g., "Classic uses 5x139.7")
    if (value.toLowerCase().includes("classic")) {
      const bpMatch = value.match(/(\d)x(\d+(?:\.\d+)?)/);
      if (bpMatch) {
        exceptions.push({
          type: "variant",
          description: "RAM 1500 Classic uses different bolt pattern than 5th gen",
          differs: {
            boltPattern: `${bpMatch[1]}x${bpMatch[2]}`,
          },
          appliesTo: ["Classic", "1500 Classic"],
        });
      }
    }
    
    // Check for trim/engine exception
    if (value.toLowerCase().includes("trim") || value.toLowerCase().includes("engine")) {
      exceptions.push({
        type: "trim",
        description: value,
        differs: {},
      });
    }
  }
  
  return exceptions;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANT DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect if input is a variant model
 */
export function detectVariant(input: FitmentResearchInput): {
  isVariant: boolean;
  qualifier?: string;
} {
  const modelLower = input.model.toLowerCase();
  const rawModelLower = (input.rawModel || input.model).toLowerCase();
  const trimLower = (input.trim || "").toLowerCase();
  
  // Check for "Classic" variant
  if (
    rawModelLower.includes("classic") ||
    trimLower.includes("classic") ||
    modelLower.includes("classic")
  ) {
    return { isVariant: true, qualifier: "classic" };
  }
  
  // Check for "Hybrid" variant
  if (
    rawModelLower.includes("hybrid") ||
    trimLower.includes("hybrid")
  ) {
    return { isVariant: true, qualifier: "hybrid" };
  }
  
  // Check for "EV" variant
  if (
    rawModelLower.includes(" ev") ||
    rawModelLower.endsWith("ev") ||
    trimLower.includes("electric")
  ) {
    return { isVariant: true, qualifier: "ev" };
  }
  
  return { isVariant: false };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN NORMALIZATION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize raw findings into a candidate record
 */
export function normalizeFindings(
  input: FitmentResearchInput,
  findings: RawFitmentFinding[],
  fieldConfidence: FieldConfidence[]
): NormalizedFitmentCandidate | null {
  // Extract consensus values from field confidence
  const getValue = (field: FitmentFieldType): string | undefined => {
    const fc = fieldConfidence.find(f => f.field === field);
    return fc ? String(fc.value) : undefined;
  };
  
  // Normalize make/model
  const make = normalizeMake(input.make);
  const model = normalizeModel(input.make, input.model);
  
  // Detect variant
  const { isVariant, qualifier } = detectVariant(input);
  
  // Normalize bolt pattern
  const bpRaw = getValue("boltPattern");
  const bpNormalized = bpRaw ? normalizeBoltPattern(bpRaw) : null;
  
  if (!bpNormalized) {
    console.warn("[normalize] Missing or invalid bolt pattern");
    return null;
  }
  
  // Normalize center bore
  const cbRaw = getValue("centerBore");
  const centerBoreMm = cbRaw ? normalizeCenterBore(cbRaw) : null;
  
  if (!centerBoreMm) {
    console.warn("[normalize] Missing or invalid center bore");
    return null;
  }
  
  // Normalize offsets
  const offsetMinMm = normalizeOffset(getValue("offsetMin") || "");
  const offsetMaxMm = normalizeOffset(getValue("offsetMax") || "");
  const offsetTypicalMm = normalizeOffset(getValue("offsetTypical") || "");
  
  // Normalize thread size
  const threadSize = normalizeThreadSize(getValue("threadSize") || "") || undefined;
  
  // Normalize seat type
  const seatTypeRaw = getValue("seatType");
  const seatType = seatTypeRaw?.toLowerCase().includes("ball") ? "ball" 
    : seatTypeRaw?.toLowerCase().includes("flat") ? "flat"
    : seatTypeRaw?.toLowerCase().includes("conic") ? "conical"
    : undefined;
  
  // Extract OEM wheel sizes
  const oemWheelSizes: OEMWheelSizeCandidate[] = [];
  const wheelFindings = findings.filter(f => f.field === "oemWheelSize");
  for (const wf of wheelFindings) {
    const parsed = parseOEMWheelSize(wf.value, wf.source.name);
    if (parsed) {
      oemWheelSizes.push(parsed);
    }
  }
  
  // Dedupe wheel sizes
  const uniqueWheels = dedupeWheelSizes(oemWheelSizes);
  
  // Extract OEM tire sizes
  const oemTireSizes: string[] = [];
  const tireFindings = findings.filter(f => f.field === "oemTireSize");
  for (const tf of tireFindings) {
    const normalized = normalizeOEMTireSize(tf.value);
    if (normalized && !oemTireSizes.includes(normalized)) {
      oemTireSizes.push(normalized);
    }
  }
  
  // Must have OEM tire sizes
  if (oemTireSizes.length === 0) {
    console.warn("[normalize] Missing OEM tire sizes");
    return null;
  }
  
  // Extract generation info
  const { generation, yearRange } = extractGenerationInfo(findings);
  
  // Extract exceptions
  const exceptions = extractExceptions(findings);
  
  // Build notes
  const notes: string[] = [];
  const notesFindings = findings.filter(f => f.notes);
  for (const nf of notesFindings) {
    if (nf.notes && !notes.includes(nf.notes)) {
      notes.push(nf.notes);
    }
  }
  
  // Build display label
  const trimPart = input.trim ? ` ${input.trim}` : "";
  const vehicleLabel = `${input.year} ${input.make} ${input.rawModel || input.model}${trimPart}`;
  
  return {
    make,
    model,
    year: input.year,
    trim: input.trim,
    vehicleLabel,
    
    generation,
    generationYearRange: yearRange,
    isVariant,
    variantQualifier: qualifier,
    
    boltPattern: bpNormalized.metric,
    boltPatternImperial: bpNormalized.imperial,
    centerBoreMm,
    
    offsetMinMm: offsetMinMm ?? undefined,
    offsetMaxMm: offsetMaxMm ?? undefined,
    offsetTypicalMm: offsetTypicalMm ?? undefined,
    
    threadSize,
    seatType,
    
    oemWheelSizes: uniqueWheels,
    oemTireSizes,
    
    exceptions,
    notes,
  };
}

/**
 * Dedupe wheel sizes by diameter/width
 */
function dedupeWheelSizes(sizes: OEMWheelSizeCandidate[]): OEMWheelSizeCandidate[] {
  const seen = new Map<string, OEMWheelSizeCandidate>();
  
  for (const s of sizes) {
    const key = `${s.diameter}x${s.width}`;
    if (!seen.has(key)) {
      seen.set(key, s);
    }
  }
  
  return Array.from(seen.values());
}
