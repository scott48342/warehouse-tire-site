/**
 * HD Fitment Resolver
 * 
 * Resolves SRW vs DRW fitment for HD trucks using template data.
 * Used by profileService to override base fitment when rearWheelConfig is specified.
 * 
 * KEY RULES:
 * - SRW and DRW have different bolt patterns, offsets, and wheel sizes
 * - Never mix SRW and DRW results
 * - When rearWheelConfig is required but missing, return null (caller should gate)
 */

import {
  HD_TEMPLATES,
  getHdPlatform as getHdPlatformBase,
  applyHdTemplate as applyHdTemplateBase,
  type HdTemplate,
  type PlatformMatch,
  type AppliedFitment,
  type WheelSpec,
} from "./hd-templates";

export type RearWheelConfig = "srw" | "drw";

// ═══════════════════════════════════════════════════════════════════════════
// DRW-CAPABLE MODEL DETECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Models that can have DRW (Dual Rear Wheel) configuration.
 * Only 3500-class trucks and F-350 support dual rear wheels.
 */
const DRW_CAPABLE_PATTERNS = [
  { make: "chevrolet", pattern: /silverado.*3500/i },
  { make: "gmc", pattern: /sierra.*3500/i },
  { make: "ford", pattern: /f-?350/i },
  { make: "ram", pattern: /3500/i },
  { make: "dodge", pattern: /ram.*3500/i },
];

/**
 * Check if a model is DRW-capable
 */
export function isDRWCapable(make: string, model: string): boolean {
  const makeLower = make.toLowerCase();
  return DRW_CAPABLE_PATTERNS.some(
    (p) => p.make === makeLower && p.pattern.test(model)
  );
}

/**
 * DRW trim indicators (explicit in trim name)
 */
const DRW_TRIM_PATTERNS = [
  /\bDRW\b/i,
  /\bDually\b/i,
  /\bDual.?Rear.?Wheel/i,
  /\bChassis.?Cab\b/i,
];

/**
 * SRW trim indicators (explicit in trim name)
 */
const SRW_TRIM_PATTERNS = [/\bSRW\b/i, /\bSingle.?Rear.?Wheel/i];

/**
 * Infer rear wheel config from trim string
 */
export function inferRearWheelConfigFromTrim(
  trim: string | null | undefined
): RearWheelConfig | null {
  if (!trim) return null;

  if (DRW_TRIM_PATTERNS.some((p) => p.test(trim))) return "drw";
  if (SRW_TRIM_PATTERNS.some((p) => p.test(trim))) return "srw";

  return null;
}

/**
 * Check if a DRW-capable vehicle needs explicit rear wheel config selection
 */
export function needsRearWheelConfigSelection(
  make: string,
  model: string,
  trim?: string | null
): boolean {
  if (!isDRWCapable(make, model)) return false;

  // If trim specifies SRW or DRW, no selection needed
  if (trim) {
    const inferred = inferRearWheelConfigFromTrim(trim);
    if (inferred) return false;
  }

  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// HD PLATFORM RESOLUTION WITH REAR WHEEL CONFIG
// ═══════════════════════════════════════════════════════════════════════════

export interface HdFitmentResult {
  boltPattern: string;
  centerBoreMm: number;
  threadSize: string;
  seatType: string;
  offsetMinMm: number;
  offsetMaxMm: number;
  diameterMin: number;
  diameterMax: number;
  widthMin: number;
  widthMax: number;
  oemWheelSizes: WheelSpec[];
  templateId: string;
  wheelType: RearWheelConfig;
  platformName: string;
}

/**
 * Get HD platform fitment with explicit rearWheelConfig.
 *
 * @param year - Vehicle year
 * @param make - Vehicle make
 * @param model - Vehicle model
 * @param rearWheelConfig - Explicit SRW or DRW selection
 * @param trim - Optional trim for additional context
 * @returns HD fitment data or null if not an HD vehicle
 */
export function getHdPlatform(
  year: number,
  make: string,
  model: string,
  rearWheelConfig: RearWheelConfig,
  trim?: string | null
): HdFitmentResult | null {
  // Get base platform match (uses trim for auto-detection if no explicit config)
  const match = getHdPlatformBase(year, make, model, trim || undefined);
  if (!match) return null;

  // Override wheel type with explicit rearWheelConfig
  const effectiveMatch: PlatformMatch = {
    ...match,
    wheelType: rearWheelConfig,
  };

  // Check if template supports this wheel type
  if (rearWheelConfig === "drw" && !match.template.drw) {
    console.warn(
      `[hdFitmentResolver] Template ${match.platformId} does not support DRW for ${year} ${make} ${model}`
    );
    return null;
  }

  // Apply template for the specified wheel type
  const applied = applyHdTemplateBase(effectiveMatch);

  return {
    boltPattern: applied.boltPattern,
    centerBoreMm: applied.centerBoreMm,
    threadSize: applied.threadSize,
    seatType: applied.seatType,
    offsetMinMm: applied.offsetMinMm,
    offsetMaxMm: applied.offsetMaxMm,
    diameterMin: applied.diameterMin,
    diameterMax: applied.diameterMax,
    widthMin: applied.widthMin,
    widthMax: applied.widthMax,
    oemWheelSizes: applied.oemWheelSizes,
    templateId: applied.templateId,
    wheelType: rearWheelConfig,
    platformName: match.template.name,
  };
}

/**
 * Apply HD template to a fitment profile, overriding specs for SRW/DRW.
 * Call this after resolving base profile to apply HD-specific constraints.
 */
export function applyHdTemplate(
  year: number,
  make: string,
  model: string,
  rearWheelConfig: RearWheelConfig,
  trim?: string | null
): HdFitmentResult | null {
  return getHdPlatform(year, make, model, rearWheelConfig, trim);
}

/**
 * Get OEM tire sizes for HD truck based on rear wheel config.
 * DRW typically uses LT-rated tires in specific sizes.
 */
export function getHdOemTireSizes(
  year: number,
  make: string,
  model: string,
  rearWheelConfig: RearWheelConfig
): string[] {
  const hdFitment = getHdPlatform(year, make, model, rearWheelConfig);
  if (!hdFitment) return [];

  // Generate tire sizes from OEM wheel specs
  // DRW uses narrower wheels (6-8.25") and specific tire sizes
  // SRW uses wider wheels (7.5-14") with different tire sizes
  const tireSizes: string[] = [];

  for (const ws of hdFitment.oemWheelSizes) {
    // Common HD tire size patterns based on wheel diameter
    if (rearWheelConfig === "drw") {
      // DRW tires are typically narrower, higher load rating
      switch (ws.diameter) {
        case 17:
          tireSizes.push("LT245/75R17");
          break;
        case 19:
        case 20:
          tireSizes.push("LT275/65R20");
          break;
        default:
          tireSizes.push(`LT245/75R${ws.diameter}`);
      }
    } else {
      // SRW tires can be wider
      switch (ws.diameter) {
        case 17:
          tireSizes.push("LT265/70R17", "LT285/70R17");
          break;
        case 18:
          tireSizes.push("LT275/70R18", "LT285/65R18");
          break;
        case 20:
          tireSizes.push("LT275/65R20", "LT285/60R20", "LT305/55R20");
          break;
        case 22:
          tireSizes.push("LT285/55R22", "LT305/45R22");
          break;
        default:
          tireSizes.push(`LT275/65R${ws.diameter}`);
      }
    }
  }

  return [...new Set(tireSizes)]; // Dedupe
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export {
  HD_TEMPLATES,
  type HdTemplate,
  type PlatformMatch,
  type AppliedFitment,
  type WheelSpec,
};

export default {
  isDRWCapable,
  needsRearWheelConfigSelection,
  inferRearWheelConfigFromTrim,
  getHdPlatform,
  applyHdTemplate,
  getHdOemTireSizes,
};
