import { NextResponse } from "next/server";
import {
  PREMIUM_FINISHES,
  SCORE_WEIGHTS,
  computeFitmentClassScore,
  computeCustomerValueScore,
  applySupplierNeutralMerchandising,
  type ScoreBreakdownV2,
} from "./rankingEngine";
import { 
  getPool, 
  // DEPRECATED: buildFitmentProfile - use resolveUniversalFitment instead
  // buildFitmentProfile,
  // DEPRECATED: buildFitmentProfileFromNewTable - use resolveUniversalFitment instead
  // buildFitmentProfileFromNewTable,
  ensureFitmentTables,
} from "@/lib/vehicleFitment";
// Wheel-1 supplier
import { getWheel1CandidatesByBoltPattern, computeWheel1SellPrice, type Wheel1Candidate } from "@/lib/wheel1/catalog";
// WSI Wholesale supplier
import { getWSICandidatesByBoltPattern, computeWSISellPrice, type WSICandidate } from "@/lib/wsi/catalog";
// DEPRECATED: getModelVariants - now encapsulated in resolveUniversalFitment
// import { getModelVariants } from "@/lib/fitment-db/modelAliases";

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// UNIVERSAL FITMENT RESOLVER (2026-06-13)
// Single source of truth for ALL fitment lookups. Replaces:
// - buildFitmentProfile / buildFitmentProfileFromNewTable
// - getModelVariants / MODEL_ALIASES
// - canonicalResolver / resolveVehicleFitment
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
import { 
  resolveUniversalFitment, 
  type UniversalFitmentResult 
} from "@/lib/fitment/universalFitmentResolver";
// DB-FIRST: External API imports blocked. Use admin/fitment for manual import.
// import { importVehicleFitment } from "@/lib/fitmentImport";
import { 
  getFitmentProfile,
  getFitmentProfileWithHdSupport,
  type FitmentProfile as DBFitmentProfile,
  type ProfileResolutionPath,
  type ProfileLookupResult,
} from "@/lib/fitment-db/profileService";
import {
  type RearWheelConfig,
  isDRWCapable,
  needsRearWheelConfigSelection,
} from "@/lib/fitment/hdFitmentResolver";
import { listLocalFitments, listFitmentsWithTierFilter } from "@/lib/fitment-db/getFitment";
import { canDetectStaggered, isStaggeredCapableVehicle, analyzeStaggeredData, isConfirmedSquareSetup, type QualityTier } from "@/lib/fitment-db/qualityTier";
import { getFitmentFromRules } from "@/lib/fitment-db/vehicleFitmentRules";
import {
  buildFitmentEnvelope,
  validateWheel,
  // summarizeValidations,
  autoDetectFitmentMode,
  applyClassicEnvelopeOverride,
  type FitmentMode,
  type WheelSpec,
  type OEMSpecs,
  type FitmentValidation,
  type ClassicFitmentRange,
  EXPANSION_PRESETS,
} from "@/lib/aftermarketFitment";

import {
  calculateFitmentGuidance,
  type FitmentGuidance,
  type FitmentLevel,
  type BuildRequirement,
} from "@/lib/fitment/guidance";

import {
  isClassicVehicle,
  getClassicFitment,
} from "@/lib/classic-fitment/classicLookup";

import { isPremiumTrimUxEnabled } from "@/lib/features/premiumTrimUx";

import {
  getTechfeedCandidatesByBoltPattern,
  getTechfeedIndexBuiltAt,
} from "@/lib/techfeed/wheels";

// NOTE: getSupplierCredentials removed from search (DB-first architecture)
// Inventory data now comes from SFTP feed (synced every 2 hours)
// No more live API calls during search!

import {
  getInventoryBulk,
  type CachedInventory,
  type InventoryBulkResult,
} from "@/lib/inventoryCache";

import {
  calculateConfidence,
  buildConfidenceResponse,
  getConfidenceUIMetadata,
  formatConfidenceForLog,
  type FitmentConfidence,
  type ConfidenceResult,
} from "@/lib/fitmentConfidence";

import { matchesBrandFilter } from "@/lib/brandCodes";
import {
  resolveOemOffset,
  computeWheelGeometry,
  mapModeToProfile,
  type OemOffsetResult,
  type VehicleClass,
} from "@/lib/fitment/geometryValidator";

import { logUnresolvedFitment } from "@/lib/fitment-db/unresolvedFitmentTracker";

import { calculateWheelSellPrice, resolveWheelMsrp } from "@/lib/pricing";

// 2026-05-04: CANONICAL IDENTITY - Use same resolver as tire-sizes API
// This ensures grouped trim fallbacks are blocked consistently across all endpoints
// TODO: Migrate canonical check to use resolveUniversalFitment in Phase 5
// For now, keep the old resolver for the trim-blocking check at STEP 0
import { resolveVehicleFitment, type ResolutionMethod } from "@/lib/fitment/canonicalResolver";

import {
  shouldApplyPackagePriority,
  getPackagePriorityTier,
  type PackagePriorityTier,
} from "@/lib/packagePrioritization";

import {
  normalizeFinish,
  sortFinishes,
} from "@/lib/finishNormalization";

import { normalizeToStringArray, isStaggeredObject, getFrontTireSizes, getRearTireSizes } from "@/lib/tires/tireSizeUtils";

import {
  filterOutUTVProducts,
  logUTVFilterAnalytics,
  type UTVFilterInput,
} from "@/lib/filters/utvFilter";

export const runtime = "nodejs";
export const maxDuration = 60;

// NOTE: convertToDBFitmentProfile was removed - legacy path now builds its own format directly

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PRICING HELPER - DATA QUALITY FIX (2025-07-18)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// The techfeed/SFTP has corrupted MSRP values when MAP is empty.
// Wheels WITH MAP have correct MSRP (~$450-490).
// Wheels WITHOUT MAP have garbage MSRP (~$210-280, likely dealer cost).
// 
// FIX: Only trust MSRP if MAP is also present as a data quality signal.
// This prevents selling wheels at ~50% off due to bad data.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface TechfeedPricingInput {
  map_price?: string | number | null;
  msrp?: string | number | null;
  // identity fields (present on the real techfeed/candidate objects) used by
  // the data-quality guard to detect corrupt MSRPs
  sku?: string | null;
  brand_cd?: string | null;
  brand_desc?: string | null;
  diameter?: string | number | null;
}

interface InventoryPricingInput {
  mapPrice?: number | null;
  msrp?: number | null;
}

/**
 * Calculate wheel sell price with data quality validation.
 * 
 * UPDATED (April 2026): Trust MSRP from inventory cache even without MAP.
 * The inventory SFTP feed has reliable MSRP data for all products.
 * The old "MAP required" rule filtered out budget brands like Petrol.
 */
interface WheelPriceIdentity {
  sku?: string | null;
  brandCd?: string | null;
  diameter?: number | string | null;
}

function getSafeWheelPrice(
  techfeed: TechfeedPricingInput,
  inventory?: InventoryPricingInput | null,
  identity?: WheelPriceIdentity | null
): number {
  // Prefer inventory cache (SFTP feed, 2hr sync) over techfeed (stale CSV)
  const mapValue = inventory?.mapPrice ?? (Number(techfeed.map_price) || null);
  const msrpValue = inventory?.msrp ?? (Number(techfeed.msrp) || null);
  
  // DATA QUALITY UPDATE (April 2026):
  // - If MAP exists, use it (most reliable)
  // - If no MAP but inventory MSRP exists, trust it (SFTP feed is reliable)
  // - If only techfeed MSRP (no inventory), trust if > $100 (filters out $0 garbage)
  // This allows budget brands like Petrol that don't have MAP pricing
  let trustedMsrp = null;
  if (mapValue) {
    // MAP exists - MSRP is trustworthy
    trustedMsrp = msrpValue;
  } else if (inventory?.msrp && inventory.msrp > 0) {
    // No MAP, but inventory cache has MSRP - trust it (SFTP is reliable)
    trustedMsrp = inventory.msrp;
  } else if (msrpValue && msrpValue > 100) {
    // Fallback: techfeed-only MSRP, trust if reasonable (> $100)
    trustedMsrp = msrpValue;
  }

  // DATA QUALITY GUARD (2026-06-18): correct corrupt feed MSRPs (dealer cost
  // mislabeled as MSRP) via manual override + sibling-outlier guard before the
  // markup math, so we never sell a wheel at ~cost. No-op for normal wheels.
  // Identity comes from the explicit arg or, failing that, the techfeed object
  // itself (the candidate objects carry sku/brand_cd/diameter).
  const idSku = identity?.sku ?? techfeed.sku ?? null;
  const idBrand = identity?.brandCd ?? techfeed.brand_cd ?? techfeed.brand_desc ?? null;
  const idDia = identity?.diameter ?? techfeed.diameter ?? null;
  if (!mapValue && trustedMsrp) {
    const corrected = resolveWheelMsrp({
      sku: idSku,
      brandCd: idBrand,
      diameter: idDia,
      msrp: trustedMsrp,
    });
    if (corrected !== null) trustedMsrp = corrected;
  }

  return calculateWheelSellPrice({ sku: idSku ?? undefined, map: mapValue, msrp: trustedMsrp });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// WHEEL SIZE STRING PARSER
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Parses wheel size strings like "8.5Jx18" or "10Jx20" into {width, diameter}
// Also handles object-based formats for backward compatibility
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface ParsedWheelSize {
  diameter: number;
  width: number;
  offset: number | null;
  tireSize: string | null;
  axle: "front" | "rear" | "both";
  isStock: boolean;
}

interface StaggeredInfo {
  isStaggered: boolean;
  reason: string;
  frontSpec?: {
    diameter: number;
    width: number;
    offset: number | null;
    tireSize: string | null;
  };
  rearSpec?: {
    diameter: number;
    width: number;
    offset: number | null;
    tireSize: string | null;
  };
}

/**
 * Detect staggered fitment from parsed wheel sizes.
 * Returns true if front and rear specs differ.
 */
function detectStaggeredFromParsed(wheelSizes: ParsedWheelSize[]): StaggeredInfo {
  let frontSpecs = wheelSizes.filter(s => s.axle === "front");
  let rearSpecs = wheelSizes.filter(s => s.axle === "rear");
  const bothSpecs = wheelSizes.filter(s => s.axle === "both");

  // SPECIAL CASE: If we have "both" + "rear" but no "front", treat "both" as front
  // This handles DB entries like: { 19x8.5 (no flag), 20x11 rear: true }
  // where only rear is explicitly marked
  if (frontSpecs.length === 0 && rearSpecs.length > 0 && bothSpecs.length > 0) {
    console.log(`[detectStaggeredFromParsed] Treating ${bothSpecs.length} "both" specs as front (only rear is marked)`);
    frontSpecs = bothSpecs.map(s => ({ ...s, axle: "front" as const }));
  }
  
  // SPECIAL CASE: If we have "both" + "front" but no "rear", treat "both" as rear
  if (rearSpecs.length === 0 && frontSpecs.length > 0 && bothSpecs.length > 0) {
    console.log(`[detectStaggeredFromParsed] Treating ${bothSpecs.length} "both" specs as rear (only front is marked)`);
    rearSpecs = bothSpecs.map(s => ({ ...s, axle: "rear" as const }));
  }

  // If we have explicit front AND rear specs, compare them
  if (frontSpecs.length > 0 && rearSpecs.length > 0) {
    const front = frontSpecs.find(s => s.isStock) || frontSpecs[0];
    const rear = rearSpecs.find(s => s.isStock) || rearSpecs[0];

    const diameterDiff = rear.diameter !== front.diameter;
    const widthDiff = rear.width !== front.width;
    const offsetDiff = rear.offset !== null && front.offset !== null && rear.offset !== front.offset;
    const tireSizeDiff = rear.tireSize && front.tireSize && rear.tireSize !== front.tireSize;

    if (diameterDiff || widthDiff || offsetDiff || tireSizeDiff) {
      const reasons: string[] = [];
      if (diameterDiff) reasons.push(`diameter (F:${front.diameter}" R:${rear.diameter}")`);
      if (widthDiff) reasons.push(`width (F:${front.width}" R:${rear.width}")`);
      if (offsetDiff) reasons.push(`offset (F:${front.offset}mm R:${rear.offset}mm)`);
      if (tireSizeDiff) reasons.push(`tire size (F:${front.tireSize} R:${rear.tireSize})`);

      return {
        isStaggered: true,
        reason: `Different front/rear: ${reasons.join(", ")}`,
        frontSpec: {
          diameter: front.diameter,
          width: front.width,
          offset: front.offset,
          tireSize: front.tireSize,
        },
        rearSpec: {
          diameter: rear.diameter,
          width: rear.width,
          offset: rear.offset,
          tireSize: rear.tireSize,
        },
      };
    }

    // Front and rear are identical
    return {
      isStaggered: false,
      reason: "Front and rear specs are identical",
      frontSpec: {
        diameter: front.diameter,
        width: front.width,
        offset: front.offset,
        tireSize: front.tireSize,
      },
      rearSpec: {
        diameter: rear.diameter,
        width: rear.width,
        offset: rear.offset,
        tireSize: rear.tireSize,
      },
    };
  }

  // If all specs are "both", check for implicit staggered fitment
  // Multiple wheel sizes with axle="both" could be:
  // 1. Different trim OPTIONS (Camry: 16", 17", 18", 19" - all square, same width)
  // 2. Mislabeled staggered (Corvette C8: 19x8.5 front + 20x11 rear marked as "both")
  //
  // HEURISTIC: Only infer staggered if WIDTHS differ by 2"+.
  // Different diameters alone are OEM options, NOT staggered.
  // True staggered (Corvette, Mustang GT, Camaro ZL1) ALWAYS has different widths.
  //
  // IMPORTANT FIX (2026-04-06): Removed diameterDiff check that was causing false positives
  // on trucks like Silverado 2500HD where 17"/18" are just trim options with same 8" width.
  //
  // IMPORTANT FIX (2026-05-06): LOWERED threshold from 2" to 0.5" to catch real staggered vehicles
  // Real staggered vehicles with smaller width differences:
  // - Mustang GT Performance Pack: 9" vs 9.5" (0.5" diff)
  // - Camaro SS: 10" vs 11" (1" diff)
  // - Shelby GT500: 11" vs 11.5" (0.5" diff)
  //
  // False positive prevention:
  // - Detection is gated by canDetectStaggered() which checks quality tier
  // - Trucks/SUVs rarely have multiple widths in OEM data (they have diff diameters for trim options)
  // - True square sedans have same width across all options (Camry: 8" for 16/17/18/19" wheels)
  // - Different DIAMETERS alone are NOT staggered (they're OEM trim options)
  if (bothSpecs.length > 0 && frontSpecs.length === 0 && rearSpecs.length === 0) {
    // Check for implicit staggered: WIDTH difference indicates staggered
    // We check all pairs to catch cases where >2 specs exist but 2 of them are staggered
    const sortedByWidth = [...bothSpecs].sort((a, b) => a.width - b.width);
    const narrowest = sortedByWidth[0];
    const widest = sortedByWidth[sortedByWidth.length - 1];
    const widthDelta = Math.abs(widest.width - narrowest.width);
    const widthDiff = widthDelta >= 0.5; // v2: 0.5" threshold to catch Mustang/Camaro/Challenger
    
    if (widthDiff) {
      // Width difference indicates staggered - narrower = front, wider = rear
      const frontInferred = narrowest;
      const rearInferred = widest;
      
      console.log(`[detectStaggeredFromParsed] INFERRED STAGGERED: width ${narrowest.width}" vs ${widest.width}" (delta=${widthDelta.toFixed(1)}", axles marked as "both")`);
      
      return {
        isStaggered: true,
        reason: `Different front/rear (inferred from width): width (F:${frontInferred.width}" R:${rearInferred.width}")`,
        frontSpec: {
          diameter: frontInferred.diameter,
          width: frontInferred.width,
          offset: frontInferred.offset,
          tireSize: frontInferred.tireSize,
        },
        rearSpec: {
          diameter: rearInferred.diameter,
          width: rearInferred.width,
          offset: rearInferred.offset,
          tireSize: rearInferred.tireSize,
        },
      };
    }
    
    // True square fitment: all specs are "both" and no significant differences
    const sample = bothSpecs.find(s => s.isStock) || bothSpecs[0];
    return {
      isStaggered: false,
      reason: "All wheel specs apply to both axles (square fitment)",
      frontSpec: {
        diameter: sample.diameter,
        width: sample.width,
        offset: sample.offset,
        tireSize: sample.tireSize,
      },
    };
  }

  // Fallback: not enough data to determine
  return {
    isStaggered: false,
    reason: "Insufficient axle-specific data (defaulting to square fitment)",
  };
}

/**
 * Infer staggered fitment from OEM tire sizes when wheel specs are incomplete.
 * 
 * Many performance vehicles (BMW M3, Audi RS, etc.) have staggered tire widths
 * (e.g., 255/40R18 front, 275/40R18 rear) even if the wheel width data is incomplete.
 * 
 * This function checks if tire sizes indicate staggered (significant width difference).
 */
function inferStaggeredFromTireSizes(tireSizes: string[]): StaggeredInfo | null {
  if (!tireSizes || tireSizes.length < 2) return null;
  
  // Parse tire widths (e.g., "255/40R18" â†’ 255)
  const parsedTires = tireSizes.map(size => {
    const match = size.match(/^P?(\d{3})\//);
    const diamMatch = size.match(/R(\d+)/i);
    return match && diamMatch ? {
      width: parseInt(match[1]),
      diameter: parseInt(diamMatch[1]),
      size,
    } : null;
  }).filter(Boolean) as { width: number; diameter: number; size: string }[];
  
  if (parsedTires.length < 2) return null;
  
  // Group by diameter to find pairs
  const byDiameter = new Map<number, typeof parsedTires>();
  for (const t of parsedTires) {
    const existing = byDiameter.get(t.diameter) || [];
    existing.push(t);
    byDiameter.set(t.diameter, existing);
  }
  
  // Check each diameter group for width variation
  for (const [diameter, tires] of byDiameter) {
    if (tires.length < 2) continue;
    
    const widths = tires.map(t => t.width).sort((a, b) => a - b);
    const narrowest = widths[0];
    const widest = widths[widths.length - 1];
    const widthDiff = widest - narrowest;
    
    // 20mm+ width difference indicates staggered (e.g., 255 vs 275 = 20mm)
    if (widthDiff >= 20) {
      const frontTire = tires.find(t => t.width === narrowest)!;
      const rearTire = tires.find(t => t.width === widest)!;
      
      console.log(`[inferStaggeredFromTireSizes] INFERRED STAGGERED from tire widths: ${narrowest}mm vs ${widest}mm on R${diameter}`);
      
      return {
        isStaggered: true,
        reason: `Different front/rear (inferred from tire widths): ${frontTire.size} / ${rearTire.size}`,
        frontSpec: {
          diameter,
          width: narrowest / 25.4, // Approximate wheel width from tire width
          offset: null,
          tireSize: frontTire.size,
        },
        rearSpec: {
          diameter,
          width: widest / 25.4, // Approximate wheel width from tire width  
          offset: null,
          tireSize: rearTire.size,
        },
      };
    }
  }
  
  return null;
}

/**
 * Parse a wheel size from various formats:
 * - String: "8.5Jx18", "10Jx20", "8.5x18", "18x8.5"
 * - Object: {diameter: 18, width: 8.5, ...}
 * 
 * Returns null if parsing fails completely.
 */
function parseWheelSize(input: unknown): ParsedWheelSize | null {
  // Handle string format (e.g., "8.5Jx18", "10Jx20")
  if (typeof input === "string") {
    const str = input.trim();
    
    // Pattern 1: "8.5Jx18" or "10Jx20" (width-J-x-diameter)
    const jxMatch = str.match(/^(\d+(?:\.\d+)?)\s*[Jj]?\s*[xX]\s*(\d+(?:\.\d+)?)$/);
    if (jxMatch) {
      const width = parseFloat(jxMatch[1]);
      const diameter = parseFloat(jxMatch[2]);
      if (!isNaN(width) && !isNaN(diameter) && diameter >= 13 && diameter <= 30) {
        return {
          diameter,
          width,
          offset: null,
          tireSize: null,
          axle: "both",
          isStock: true,
        };
      }
    }
    
    // Pattern 2: "18x8.5" (diameter-x-width, reversed)
    const reverseMatch = str.match(/^(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)$/);
    if (reverseMatch) {
      const first = parseFloat(reverseMatch[1]);
      const second = parseFloat(reverseMatch[2]);
      // If first number is typical diameter range (14-26) and second is width range (4-14)
      if (!isNaN(first) && !isNaN(second)) {
        if (first >= 14 && first <= 26 && second >= 4 && second <= 14) {
          return {
            diameter: first,
            width: second,
            offset: null,
            tireSize: null,
            axle: "both",
            isStock: true,
          };
        }
        // Assume width-x-diameter if width < diameter
        if (second > first && second >= 14 && second <= 26) {
          return {
            diameter: second,
            width: first,
            offset: null,
            tireSize: null,
            axle: "both",
            isStock: true,
          };
        }
      }
    }
    
    console.warn(`[parseWheelSize] Failed to parse string: "${str}"`);
    return null;
  }
  
  // Handle object format (e.g., {diameter: 18, width: 8.5})
  if (input && typeof input === "object") {
    const obj = input as Record<string, unknown>;
    const diameter = Number(obj.diameter || obj.rimDiameter || 0);
    const width = Number(obj.width || obj.rimWidth || 0);
    
    // Validate: diameter should be 13-30, width should be 4-14
    if (diameter >= 13 && diameter <= 30 && width >= 4 && width <= 14) {
      return {
        diameter,
        width,
        offset: obj.offset != null ? Number(obj.offset) : null,
        tireSize: typeof obj.tireSize === "string" ? obj.tireSize : null,
        // Handle multiple DB formats: "axle", "position", or "rear: true"
        axle: (obj.axle === "front" || obj.axle === "rear") ? obj.axle 
            : (obj.position === "front" || obj.position === "rear") ? (obj.position as "front" | "rear")
            : obj.rear === true ? "rear"  // Handle { rear: true } format from some imports
            : obj.front === true ? "front"  // Handle { front: true } format
            : "both",
        isStock: obj.isStock !== false,
      };
    }
    
    // REMOVED: Silent fallback that would fabricate width=8 or diameter=17
    // If object has partial data, log and reject rather than guessing
    if (diameter > 0 || width > 0) {
      console.warn(`[parseWheelSize] REJECTED partial object: diameter=${diameter}, width=${width} (both required)`);
    }
    
    console.warn(`[parseWheelSize] Failed to parse object:`, JSON.stringify(obj));
    return null;
  }
  
  console.warn(`[parseWheelSize] Unknown input type: ${typeof input}`);
  return null;
}

/**
 * Parse an array of wheel sizes from various formats.
 * Filters out any entries that fail to parse.
 */
function parseWheelSizes(input: unknown): ParsedWheelSize[] {
  if (!Array.isArray(input)) {
    return [];
  }
  
  const results: ParsedWheelSize[] = [];
  for (const item of input) {
    const parsed = parseWheelSize(item);
    if (parsed) {
      results.push(parsed);
    }
  }
  
  if (results.length !== input.length) {
    console.log(`[parseWheelSizes] Parsed ${results.length}/${input.length} wheel sizes successfully`);
  }
  
  return results;
}

/**
 * Resolution paths for fitment profile lookup:
 * - directCanonical: Found directly in vehicle_fitments by modificationId
 * - canonicalAlias: Found via alias mapping to different canonical ID
 * - importedAlias: Fetched from API, imported with different ID, alias stored
 * - legacyFallback: Used legacy system (trim-based lookup)
 * - invalid: Could not resolve fitment profile
 */
type FitmentResolutionPath = ProfileResolutionPath | "legacyFallback" | "invalid";

/**
 * GET /api/wheels/fitment-search
 * 
 * ModificationId-First Wheel Search
 * 
 * Resolution Flow:
 * 1. Try DB-first profile lookup by modificationId
 * 2. If found â†’ use it directly (no legacy system needed)
 * 3. If not found â†’ fall back to legacy system (with logging)
 * 4. Return wheels with fitment validation
 * 
 * Query params:
 * - year, make, model: Vehicle selection (required)
 * - modification: Canonical modificationId (preferred)
 * - trim: Legacy param, treated as modificationId if modification not provided
 * - mode: "oem" | "aftermarket_safe" | "aggressive" | "truck" | "auto"
 * - page, pageSize: Pagination
 * - brand_cd, finish, diameter, width: Additional filters
 * - debug: Include validation details
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";
  const t0 = Date.now();

  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");
  
  // ModificationId is the PRIMARY identifier
  const modification = url.searchParams.get("modification") || undefined;
  const trimParam = url.searchParams.get("trim") || undefined;
  
  // Canonical fitment identity: prefer modification, fall back to trim
  const modificationId = modification || trimParam || undefined;
  
  // Log deprecation warning if using trim as modificationId
  if (!modification && trimParam) {
    console.warn(`[fitment-search] DEPRECATION: Using 'trim' param as modificationId. Migrate to 'modification=${trimParam}'`);
  }
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // REAR WHEEL CONFIG (SRW/DRW) - For HD Trucks (3500-class)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const rearWheelConfigParam = url.searchParams.get("rearWheelConfig");
  const rearWheelConfig: RearWheelConfig | undefined = 
    rearWheelConfigParam === "srw" || rearWheelConfigParam === "drw" 
      ? rearWheelConfigParam 
      : undefined;
  
  // Check if this vehicle needs rear wheel config but doesn't have it
  const vehicleIsDRWCapable = make && model ? isDRWCapable(make, model) : false;
  const vehicleNeedsRearWheelConfig = make && model ? needsRearWheelConfigSelection(make, model, trimParam) : false;
  
  if (vehicleIsDRWCapable) {
    console.log(`[fitment-search] ðŸ›» HD TRUCK DETECTED: ${year} ${make} ${model}`, {
      isDRWCapable: vehicleIsDRWCapable,
      needsSelection: vehicleNeedsRearWheelConfig,
      rearWheelConfig: rearWheelConfig || "(not specified)",
    });
  }
  
  const modeParam = url.searchParams.get("mode");

  if (!year || !make || !model) {
    return NextResponse.json(
      { error: "Missing required params: year, make, model" },
      { status: 400 }
    );
  }

  if (modeParam && !["oem", "aftermarket_safe", "aggressive", "truck", "auto"].includes(modeParam)) {
    return NextResponse.json(
      { error: `Invalid mode: ${modeParam}. Must be oem, aftermarket_safe, aggressive, truck, or auto` },
      { status: 400 }
    );
  }

  try {
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // STEP 0: CANONICAL IDENTITY CHECK (2026-05-04)
    // Use the same resolver as tire-sizes API to ensure consistent trim resolution.
    // This prevents grouped trim fallbacks that could show wheels for wrong trim.
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    if (modificationId || trimParam) {
      const canonicalCheck = await resolveVehicleFitment({
        year: Number(year),
        make,
        model,
        trim: trimParam || undefined,
        modificationId: modificationId || undefined,
      });
      
      // If canonical resolver says BLOCKED, respect it - don't allow profileService fallback
      if (canonicalCheck.matchedBy === "blocked") {
        console.warn(`[fitment-search] ðŸš« CANONICAL BLOCKED: ${year} ${make} ${model} â†’ ${canonicalCheck.debug.fallbackBlockedReason}`);
        
        return NextResponse.json({
          results: [],
          totalCount: 0,
          blocked: true,
          blockReason: "Different trims have different wheel fitment specs. Please select your exact trim.",
          trimResolutionRequired: true,
          trimNotFound: modificationId || trimParam,
          availableTrims: canonicalCheck.debug.candidateTrims.map(c => ({
            modificationId: c.modificationId,
            displayTrim: c.atomicTrims[0],
            tireSizes: c.tireSizes,
          })),
          fitment: {
            mode: "blocked",
            vehicle: { year: Number(year), make, model, trim: modificationId || trimParam || null },
            resolutionPath: "blocked" as FitmentResolutionPath,
            canonicalMatchedBy: canonicalCheck.matchedBy,
          },
          suggestions: [
            "Select your specific trim from the options above",
            "Different trims may have different bolt patterns and wheel sizes",
            "Contact us at (248) 332-4120 if you need help identifying your trim",
          ],
          timing: { totalMs: Date.now() - t0 },
        });
      }
      
      // Log canonical resolution for debugging
      if (canonicalCheck.matchedBy !== "not_found") {
        console.log(`[fitment-search] âœ… CANONICAL RESOLVED: ${year} ${make} ${model} â†’ method=${canonicalCheck.matchedBy}, confidence=${canonicalCheck.confidence}, trim="${canonicalCheck.displayTrim}"`);
      }
    }
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // STEP 1: ModificationId-First Profile Resolution (with Alias Support)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    let dbProfile: DBFitmentProfile | null = null;
    let resolutionPath: FitmentResolutionPath = "invalid";
    let profileResult: ProfileLookupResult | null = null;
    let canonicalModificationId: string | null = null;
    let aliasUsed = false;
    
    // Primary path: Use modificationId-first lookup (DB â†’ Alias â†’ API)
    // For HD trucks with rearWheelConfig, use the HD-aware function
    if (modificationId) {
      try {
        profileResult = await getFitmentProfileWithHdSupport(Number(year), make, model, modificationId, {
          rearWheelConfig,
        });
        
        if (profileResult.profile) {
          dbProfile = profileResult.profile;
          resolutionPath = profileResult.resolutionPath;
          canonicalModificationId = profileResult.canonicalModificationId;
          aliasUsed = profileResult.aliasUsed;
          
          console.log(`[fitment-search] RESOLVED (${resolutionPath}): ${year} ${make} ${model} mod=${modificationId}${aliasUsed ? ` â†’ ${canonicalModificationId}` : ''}`, {
            boltPattern: dbProfile.boltPattern,
            oemWheelSizes: dbProfile.oemWheelSizes.length,
            oemTireSizes: dbProfile.oemTireSizes.length,
            aliasUsed,
            fallbackConfidence: profileResult.fallbackConfidence,
            timing: profileResult.timing,
          });
        } else {
          console.log(`[fitment-search] PROFILE NOT FOUND: ${year} ${make} ${model} mod=${modificationId}`);
          
          // Check if blocked due to needs_manual_verification
          if (profileResult.fallbackConfidence === "needs_manual_verification" || 
              profileResult.fallbackConfidence === "blocked") {
            console.log(`[fitment-search] BLOCKED (${profileResult.fallbackConfidence}): No safe fallback available`);
            console.log(`  Warnings: ${profileResult.fallbackWarnings?.join(", ") || "none"}`);
            
            // Return blocked response with verification messaging
            return NextResponse.json({
              results: [],
              totalCount: 0,
              blocked: true,
              blockReason: "This trim requires manual fitment verification",
              fitment: {
                mode: "blocked",
                vehicle: { year: Number(year), make, model, trim: modificationId || null },
                resolutionPath: "invalid",
                fallbackConfidence: profileResult.fallbackConfidence,
                fallbackWarnings: profileResult.fallbackWarnings,
                confidenceUI: {
                  badge: profileResult.fallbackConfidence === "needs_manual_verification" 
                    ? "Verification Required" 
                    : "Fitment Unavailable",
                  message: "This trim has unique fitment specs that need manual verification.",
                  showGuaranteedFit: false,
                  color: "orange",
                },
              },
              suggestions: [
                "Contact us at (248) 332-4120 for manual fitment verification",
                "Our experts can verify the exact specs for your vehicle",
              ],
              timing: { totalMs: Date.now() - t0 },
            });
          }
        }
      } catch (profileErr: any) {
        console.error(`[fitment-search] ModificationId-first lookup failed:`, profileErr?.message || profileErr);
        dbProfile = null;
      }
    }
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // STEP 2: Use dbProfile if Available (ModificationId-First Path)
    // Check confidence and potentially block ONLY if we have a profile to evaluate
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    if (dbProfile) {
      const confidenceResult = calculateConfidence(dbProfile);
      console.log(`[fitment-search] DB-FIRST CONFIDENCE:`, formatConfidenceForLog(confidenceResult));
      
      // Block if profile exists but has insufficient data
      if (!confidenceResult.canShowWheels) {
        console.warn(`[fitment-search] BLOCKED (${confidenceResult.confidence}): ${year} ${make} ${model} mod=${modificationId || "(none)"} - DB profile has insufficient data`);
        
        // Log as unresolved due to low confidence (data quality gap)
        logUnresolvedFitment({
          year,
          make,
          model,
          trim: dbProfile.displayTrim || undefined,
          searchType: "wheel",
          source: "api",
          path: url.pathname + url.search,
          modificationId: modificationId || undefined,
          resolutionAttempts: [`blocked:${confidenceResult.confidence}`],
        }).catch(() => {}); // Fire and forget
        
        return NextResponse.json({
          results: [],
          totalCount: 0,
          blocked: true,
          blockReason: "Cannot safely show wheel results without verified fitment data",
          fitment: {
            ...buildConfidenceResponse(confidenceResult),
            vehicle: {
              year: Number(year),
              make,
              model,
              trim: dbProfile.displayTrim || modificationId || null,
            },
            resolutionPath,
            profileFound: true,
          },
          suggestions: [
            "Try a different trim level if available",
            "Contact us at (248) 332-4120 for manual fitment lookup",
            "Check your owner's manual for wheel specifications",
          ],
          timing: {
            totalMs: Date.now() - t0,
          },
        });
      }
      
      // Profile has good confidence - proceed with wheel search
      if (dbProfile.boltPattern) {
        return await handleDbProfilePath(
          url, dbProfile, resolutionPath, canonicalModificationId, aliasUsed, modeParam, debug, t0, confidenceResult,
          profileResult?.fallbackConfidence, profileResult?.fallbackWarnings
        );
      }
    }
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // STEP 3.5: Direct Local DB Fallback (bypass profileService)
    // This handles cases where profileService fails but we have local fitment data
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    if (!dbProfile) {
      try {
        console.log(`[fitment-search] TRYING LOCAL DB FALLBACK: ${year} ${make} ${model}`);
        const localFitments = await listLocalFitments(Number(year), make, model);
        
        if (localFitments.length > 0) {
          // Pick best fitment (one with bolt pattern and tire sizes)
          // Supports string arrays and {front, rear} staggered format
          const bestFitment = localFitments.find(f => f.boltPattern && normalizeToStringArray(f.oemTireSizes).length > 0) || localFitments[0];
          
          if (bestFitment && bestFitment.boltPattern) {
            console.log(`[fitment-search] LOCAL DB HIT: ${year} ${make} ${model} â†’ ${bestFitment.modificationId} (boltPattern: ${bestFitment.boltPattern})`);
            
            // Convert to DBFitmentProfile format
            dbProfile = {
              modificationId: bestFitment.modificationId,
              year: bestFitment.year,
              make: bestFitment.make,
              model: bestFitment.model,
              displayTrim: bestFitment.displayTrim,
              rawTrim: bestFitment.rawTrim,
              boltPattern: bestFitment.boltPattern,
              centerBoreMm: bestFitment.centerBoreMm ? Number(bestFitment.centerBoreMm) : null,
              threadSize: bestFitment.threadSize,
              seatType: bestFitment.seatType,
              // CRITICAL: Use != null - offset can legitimately be 0!
              offsetMinMm: bestFitment.offsetMinMm != null ? Number(bestFitment.offsetMinMm) : null,
              offsetMaxMm: bestFitment.offsetMaxMm != null ? Number(bestFitment.offsetMaxMm) : null,
              oemWheelSizes: parseWheelSizes(bestFitment.oemWheelSizes),
              oemTireSizes: normalizeToStringArray(bestFitment.oemTireSizes),
              source: "db",
              apiCalled: false,
              overridesApplied: false,
            };
            resolutionPath = "directCanonical";
            canonicalModificationId = bestFitment.modificationId;
            
            // Now proceed with wheel search
            const confidenceResult = calculateConfidence(dbProfile);
            if (confidenceResult.canShowWheels && dbProfile.boltPattern) {
              // Local DB fallback always returns certified records (CERTIFIED_FILTER applied in listLocalFitments)
              return await handleDbProfilePath(url, dbProfile, resolutionPath, canonicalModificationId, false, modeParam, debug, t0, confidenceResult, "exact_certified");
            }
          }
        }
      } catch (localErr: any) {
        console.error(`[fitment-search] Local DB fallback failed:`, localErr?.message || localErr);
      }
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // STEP 3.7: Classic Fitment Fallback (No vehicle_fitments, but has classic_fitments)
    // For classic vehicles without vehicle_fitments records, construct profile from classic_fitments
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    if (!dbProfile && isClassicVehicle(Number(year), make)) {
      console.log(`[fitment-search] TRYING CLASSIC FALLBACK: ${year} ${make} ${model}`);
      
      try {
        const classicResult = await getClassicFitment(Number(year), make, model);
        
        if (classicResult.isClassicVehicle && classicResult.fitmentMode === "classic") {
          console.log(`[fitment-search] CLASSIC FALLBACK HIT: ${year} ${make} ${model} â†’ platform=${classicResult.platform.code}`);
          
          // Construct a minimal DB profile from classic fitment
          const classicModificationId = `classic_${classicResult.platform.code}_${year}`;
          
          // When premium UX is enabled, don't use "Base" - use null to hide trim
          const premiumUx = isPremiumTrimUxEnabled();
          
          dbProfile = {
            modificationId: classicModificationId,
            year: Number(year),
            make: make.toLowerCase(),
            model: model.toLowerCase(),
            displayTrim: premiumUx ? "" : "Base",
            rawTrim: null,
            boltPattern: classicResult.specs.boltPattern,
            centerBoreMm: classicResult.specs.centerBore,
            threadSize: classicResult.specs.threadSize,
            seatType: classicResult.specs.seatType,
            offsetMinMm: classicResult.recommendedRange.offset.min,
            offsetMaxMm: classicResult.recommendedRange.offset.max,
            // Use classic stock reference for OEM wheel sizes
            // NOTE: width || 6 is a valid historical default for classic cars (1950s-1980s)
            // which commonly used 14x6 or 15x6 steel wheels. This is NOT the same as
            // the fake 17x8 fallback for modern vehicles.
            oemWheelSizes: classicResult.stockReference.wheelDiameter ? [{
              diameter: classicResult.stockReference.wheelDiameter,
              width: classicResult.stockReference.wheelWidth || 6,
              offset: null,
              tireSize: classicResult.stockReference.tireSize,
              axle: "both" as const,
              isStock: true,
            }] : [],
            oemTireSizes: classicResult.stockReference.tireSize ? [classicResult.stockReference.tireSize] : [],
            source: "db",  // classic fitment stored in our DB
            apiCalled: false,
            overridesApplied: false,
          };
          
          resolutionPath = "directCanonical";
          canonicalModificationId = classicModificationId;
          
          // Classic fitment always has high confidence
          const confidenceResult: ConfidenceResult = {
            confidence: "high",
            canShowWheels: true,
            canFilterByBoltPattern: true,
            canFilterByHubBore: !!classicResult.specs.centerBore,
            reasons: [`Classic fitment: ${classicResult.platform.name}`, `Bolt pattern: ${classicResult.specs.boltPattern} (verified)`],
            parsed: {
              boltPattern: { raw: classicResult.specs.boltPattern, normalized: classicResult.specs.boltPattern, lugCount: parseInt(classicResult.specs.boltPattern.split('x')[0]) || 5, pcd: parseFloat(classicResult.specs.boltPattern.split('x')[1]) || 114.3, isDualDrill: false, patterns: [] },
              centerBoreMm: classicResult.specs.centerBore || null,
              hasWheelSizes: true,
              hasTireSizes: !!classicResult.stockReference.tireSize,
            },
          };
          
          console.log(`[fitment-search] Classic profile constructed:`, {
            boltPattern: dbProfile.boltPattern,
            recommendedDiameter: [classicResult.recommendedRange.diameter.min, classicResult.recommendedRange.diameter.max],
          });
          
          // Now go through handleDbProfilePath which will apply the classic override
          // Classic vehicles use platform-based fitment, not trim-specific, so treat as exact
          return await handleDbProfilePath(url, dbProfile, resolutionPath, canonicalModificationId, false, modeParam, debug, t0, confidenceResult, "exact_certified");
        }
      } catch (classicErr: any) {
        console.error(`[fitment-search] Classic fallback failed:`, classicErr?.message || classicErr);
      }
    }

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // STEP 4: Legacy Fallback (Only When ModificationId-First Fails)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    console.warn(`[fitment-search] LEGACY FALLBACK: ${year} ${make} ${model} mod=${modificationId || "(none)"} - dbProfile unavailable`);
    resolutionPath = "legacyFallback";
    
    return await handleLegacyPath(url, year, make, model, modificationId, trimParam, modeParam, debug, t0);

  } catch (err: any) {
    console.error("[wheels/fitment-search] Error:", err);
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}

// ============================================================================
// ModificationId-First Path Handler
// ============================================================================

async function handleDbProfilePath(
  url: URL,
  dbProfile: DBFitmentProfile,
  resolutionPath: FitmentResolutionPath,
  canonicalModificationId: string | null,
  aliasUsed: boolean,
  modeParam: string | null,
  debug: boolean,
  t0: number,
  confidenceResult?: ConfidenceResult,
  fallbackConfidence?: import("@/lib/fitment-db/fallbackEquivalence").FallbackConfidence,
  fallbackWarnings?: string[]
): Promise<NextResponse> {
  const year = url.searchParams.get("year")!;
  const make = url.searchParams.get("make")!;
  const model = url.searchParams.get("model")!;

  const requestedPage = Math.max(1, Number(url.searchParams.get("page") || "1") || 1);
  // Allow larger page sizes to show all inventory (up to 3000)
  // Note: 3000 covers most vehicles. For F-150 with ~3000 wheels, this shows all.
  const requestedPageSize = Math.max(1, Math.min(3000, Number(url.searchParams.get("pageSize") || "24") || 24));

  const brandCd = url.searchParams.get("brand_cd");
  const finish = url.searchParams.get("finish");
  const diameter = url.searchParams.get("diameter");
  const width = url.searchParams.get("width");
  const styleFilter = url.searchParams.get("style"); // Wheel model/style filter (e.g., "KM235")
  
  // Sort parameter: "price_asc" (low to high), "price_desc" (high to low), or default (relevance/score)
  const sortParam = url.searchParams.get("sort") || url.searchParams.get("sortBy");

  // Hard requirement for "in stock only" live validation
  const minQty = Math.max(1, Number(url.searchParams.get("min_qty") || url.searchParams.get("minQty") || "4") || 4);

  // HD Truck SRW/DRW configuration
  const rearWheelConfigParam = url.searchParams.get("rearWheelConfig");
  const rearWheelConfig: RearWheelConfig | undefined = 
    rearWheelConfigParam === "srw" || rearWheelConfigParam === "drw" 
      ? rearWheelConfigParam 
      : undefined;
  const vehicleIsDRWCapable = make && model ? isDRWCapable(make, model) : false;

  // Build OEM specs from dbProfile (wheel-size based)
  // Parse wheel sizes to handle both string formats ("8.5Jx18") and object formats
  const parsedWheelSizes = parseWheelSizes(dbProfile.oemWheelSizes);
  const wheelSpecs = parsedWheelSizes.map((ws) => ({
    rimDiameter: ws.diameter,
    rimWidth: ws.width,
    offset: ws.offset,
  }));
  
  // PHASE 3: Quality tier check for staggered detection
  // Only detect staggered if we have "complete" quality tier with explicit position data
  const qualityTier = (dbProfile as any).qualityTier as QualityTier | undefined;
  const staggeredCheck = canDetectStaggered(qualityTier || "unknown", dbProfile.oemWheelSizes, make, model);
  
  // Log staggered detection analysis for debugging
  if (staggeredCheck.debug) {
    console.log(`[fitment-search] Staggered analysis: ${make} ${model}`, {
      canDetect: staggeredCheck.canDetect,
      isStaggeredCapable: staggeredCheck.isStaggeredCapable,
      widthDelta: staggeredCheck.debug.widthDelta,
      widths: staggeredCheck.debug.widths,
      reason: staggeredCheck.reason,
    });
  }
  
  // CRITICAL FIX (2026-05-06): Block staggered detection for trucks/SUVs
  // Trucks often have multiple wheel width OPTIONS (not staggered setups).
  // Only allow staggered detection for known staggered-capable vehicles.
  const vehicleIsStaggeredCapable = isStaggeredCapableVehicle(make, model);
  
  let staggeredInfo: StaggeredInfo;
  
  // Logic:
  // 1. Trucks/SUVs (NOT staggered-capable): ALWAYS return isStaggered: false
  // 2. Sports cars (staggered-capable): Detect staggered from data, regardless of quality tier
  //    - Quality tier check is for data confidence, but sports cars should still try
  if (!vehicleIsStaggeredCapable) {
    // BLOCK: Trucks and SUVs should NEVER show as staggered
    staggeredInfo = {
      isStaggered: false,
      reason: `Vehicle ${make} ${model} is not in staggered-capable list (trucks/SUVs use width OPTIONS, not staggered setups)`,
    };
    if (parsedWheelSizes.length > 0) {
      const sample = parsedWheelSizes[0];
      staggeredInfo.frontSpec = {
        diameter: sample.diameter,
        width: sample.width,
        offset: sample.offset,
        tireSize: sample.tireSize,
      };
    }
    console.log(`[fitment-search] Staggered detection BLOCKED: not staggered-capable vehicle`);
  } else {
    // ALLOW: Sports cars - try to detect staggered from data
    // Even without "complete" quality tier, if the data has front/rear markers or width differences, detect it
    const dataAnalysis = analyzeStaggeredData(dbProfile.oemWheelSizes);
    if (dataAnalysis.hasStaggeredData) {
      staggeredInfo = detectStaggeredFromParsed(parsedWheelSizes);
      console.log(`[fitment-search] Staggered detection ALLOWED for ${make} ${model}: ${staggeredInfo.reason}`);
    } else {
      // No staggered data found - treat as square
      staggeredInfo = {
        isStaggered: false,
        reason: dataAnalysis.reason,
      };
      if (parsedWheelSizes.length > 0) {
        const sample = parsedWheelSizes[0];
        staggeredInfo.frontSpec = {
          diameter: sample.diameter,
          width: sample.width,
          offset: sample.offset,
          tireSize: sample.tireSize,
        };
      }
      console.log(`[fitment-search] Staggered detection: ${make} ${model} has no staggered data`);
    }
  }
  
  // NOTE: Tire-size-based staggered inference DISABLED (2025-07-27)
  // Problem: Multiple tire widths (e.g., 225/65R17 + 245/65R17) are often just OPTIONS
  // for different trims/packages, NOT actual staggered fitment (front/rear difference).
  // This was causing false positives on vehicles like Cherokee that have tire OPTIONS.
  // 
  // If a vehicle is truly staggered (Corvette, Mustang GT, BMW M cars), the wheel specs
  // should have explicit front/rear axle assignments in oemWheelSizes.
  // 
  // Keeping inferStaggeredFromTireSizes() for reference but not calling it.
  // if (!staggeredInfo.isStaggered && staggeredInfo.reason.includes("Insufficient")) {
  //   const tireSizeInference = inferStaggeredFromTireSizes(dbProfile.oemTireSizes || []);
  //   if (tireSizeInference) {
  //     staggeredInfo = tireSizeInference;
  //     console.log(`[fitment-search] STAGGERED FITMENT (tire size inference): ${staggeredInfo.reason}`);
  //   }
  // }
  
  // Populate missing tireSize in staggered specs from OEM tire sizes
  // This handles cases like Corvette where wheel specs exist but tireSize is null
  // Try dbProfile first, then fetch from tire-sizes API if needed
  // Supports string arrays and {front, rear} staggered format
  let tireSizesForStagger = normalizeToStringArray(dbProfile.oemTireSizes);

  // EXPLICIT front/rear mapping (preferred over diameter/width guessing).
  // When the DB stores staggered tire data as { front, rear }, use that mapping
  // directly so the rear tire isn't mis-assigned the front size (e.g. Camaro SS
  // rear should be 275/35R20, not 245/40R20). Falls back to the heuristic below
  // when no explicit mapping is available.
  let explicitFrontTire: string | undefined;
  let explicitRearTire: string | undefined;
  if (isStaggeredObject(dbProfile.oemTireSizes)) {
    explicitFrontTire = getFrontTireSizes(dbProfile.oemTireSizes)[0];
    explicitRearTire = getRearTireSizes(dbProfile.oemTireSizes)[0];
  }
  
  // Direct DB lookup of the raw oem_tire_sizes when staggered. We do this even
  // if tireSizesForStagger already has values, because dbProfile.oemTireSizes is
  // a flattened string[] that loses the front/rear mapping needed to assign the
  // correct rear tire (e.g. Camaro SS rear 275/35R20). Skip only when we already
  // have an explicit mapping.
  // (Avoids HTTP self-call which can timeout in dev)
  if (staggeredInfo.isStaggered && (tireSizesForStagger.length === 0 || (!explicitFrontTire && !explicitRearTire))) {
    try {
      // Direct DB query to get tire sizes for this vehicle
      const db = getPool();
      const modificationParam = url.searchParams.get("modification") || url.searchParams.get("trim") || "";
      const tireSizesQuery = modificationParam
        ? `SELECT oem_tire_sizes FROM vehicle_fitments 
           WHERE year = $1 AND LOWER(make) = LOWER($2) AND LOWER(model) = LOWER($3) 
           AND (LOWER(modification_id) = LOWER($4) OR LOWER(display_trim) = LOWER($4))
           AND certification_status = 'certified'
           LIMIT 1`
        : `SELECT oem_tire_sizes FROM vehicle_fitments 
           WHERE year = $1 AND LOWER(make) = LOWER($2) AND LOWER(model) = LOWER($3) 
           AND certification_status = 'certified'
           LIMIT 10`;
      const params = modificationParam 
        ? [year, make, model, modificationParam]
        : [year, make, model];
      const tireSizesResult = await db.query(tireSizesQuery, params);
      
      // Collect all tire sizes from matching records
      // Supports string arrays and {front, rear} staggered format
      const allTireSizes = new Set<string>();
      for (const row of tireSizesResult.rows) {
        const sizes = normalizeToStringArray(row.oem_tire_sizes);
        sizes.forEach(s => allTireSizes.add(s));
        // Capture explicit front/rear mapping if present (prefer the trim-matched
        // record, which is the first/only row when modificationParam is set).
        if (!explicitFrontTire && !explicitRearTire && isStaggeredObject(row.oem_tire_sizes)) {
          explicitFrontTire = getFrontTireSizes(row.oem_tire_sizes)[0];
          explicitRearTire = getRearTireSizes(row.oem_tire_sizes)[0];
        }
      }
      
      if (allTireSizes.size > 0) {
        tireSizesForStagger = Array.from(allTireSizes);
        console.log(`[fitment-search] Found ${tireSizesForStagger.length} tire sizes from DB for staggered spec: ${tireSizesForStagger.slice(0, 4).join(", ")}`);
      }
    } catch (e) {
      console.log(`[fitment-search] Could not fetch tire sizes for staggered spec: ${e}`);
    }
  }
  
  if (staggeredInfo.isStaggered && tireSizesForStagger.length > 0) {
    const tireSizes = tireSizesForStagger;
    
    // Helper to find best matching tire size for a wheel diameter
    const findTireSizeForDiameter = (diameter: number, preferredWidth: number | null): string | null => {
      // Find tires that match this wheel diameter
      const matching = tireSizes.filter(size => {
        const match = size.match(/R(\d+)/i);
        return match && parseInt(match[1]) === diameter;
      });
      
      if (matching.length === 0) return null;
      if (matching.length === 1) return matching[0];
      
      // If multiple matches, prefer one closest to wheel width
      if (preferredWidth) {
        const widthMm = preferredWidth * 25.4; // Convert wheel width to mm
        const sorted = matching.sort((a, b) => {
          const widthA = parseInt(a.match(/^P?(\d{3})\//)?.[1] || "0");
          const widthB = parseInt(b.match(/^P?(\d{3})\//)?.[1] || "0");
          return Math.abs(widthA - widthMm) - Math.abs(widthB - widthMm);
        });
        return sorted[0];
      }
      
      return matching[0];
    };
    
    // Front tire: prefer explicit DB front/rear mapping, else heuristic by
    // diameter/width. Explicit mapping OVERRIDES any earlier value because the
    // wheel-spec-derived guess can mis-assign sizes on staggered setups.
    if (staggeredInfo.frontSpec) {
      const frontTire = explicitFrontTire
        || (!staggeredInfo.frontSpec.tireSize
            ? findTireSizeForDiameter(staggeredInfo.frontSpec.diameter, staggeredInfo.frontSpec.width)
            : undefined);
      if (frontTire) {
        staggeredInfo.frontSpec.tireSize = frontTire;
        console.log(`[fitment-search] front tireSize=${frontTire}${explicitFrontTire ? " (explicit)" : ""}`);
      }
    }
    
    // Rear tire: prefer explicit DB front/rear mapping, else heuristic.
    if (staggeredInfo.rearSpec) {
      const rearTire = explicitRearTire
        || (!staggeredInfo.rearSpec.tireSize
            ? findTireSizeForDiameter(staggeredInfo.rearSpec.diameter, staggeredInfo.rearSpec.width)
            : undefined);
      if (rearTire) {
        staggeredInfo.rearSpec.tireSize = rearTire;
        console.log(`[fitment-search] rear tireSize=${rearTire}${explicitRearTire ? " (explicit)" : ""}`);
      }
    }
  }
  
  if (staggeredInfo.isStaggered) {
    console.log(`[fitment-search] STAGGERED FITMENT detected: ${staggeredInfo.reason}`);
  }

  // Auto-detect fitment mode
  let mode: FitmentMode = "aftermarket_safe";
  let vehicleType: "truck" | "suv" | "car" | undefined;
  let modeAutoDetected = false;

  // (for auto detect) approximate OEM range
  const oemDiameters = wheelSpecs.map((s) => s.rimDiameter).filter((d) => d > 0);
  const oemWidths = wheelSpecs.map((s) => s.rimWidth).filter((w) => w > 0);
  const oemMinDiameter = oemDiameters.length ? Math.min(...oemDiameters) : 15;
  const oemMaxWidth = oemWidths.length ? Math.max(...oemWidths) : 10;

  if (modeParam && modeParam !== "auto") {
    mode = modeParam as FitmentMode;
  } else {
    const autoResult = autoDetectFitmentMode(model!, {
      boltPattern: dbProfile.boltPattern || undefined,
      minDiameter: oemMinDiameter,
      maxWidth: oemMaxWidth,
    });
    mode = autoResult.recommendedMode;
    vehicleType = autoResult.vehicleType;
    modeAutoDetected = true;
  }

  const oem: OEMSpecs = {
    boltPattern: dbProfile.boltPattern!,
    centerBore: Number(dbProfile.centerBoreMm || 0) || 0,
    wheelSpecs,
  };

  let envelope = buildFitmentEnvelope(oem, mode);
  let isClassic = false;
  let classicFitmentUsed = false;

  // ========================================================================
  // CLASSIC VEHICLE OVERRIDE
  // For classic vehicles, the classic_fitments table is the source of truth
  // for diameter/width/offset ranges - NOT the legacy oemWheelSizes data
  // ========================================================================
  if (isClassicVehicle(Number(year), make)) {
    isClassic = true;
    console.log(`[fitment-search] CLASSIC VEHICLE detected: ${year} ${make} ${model}`);
    
    try {
      const classicResult = await getClassicFitment(Number(year), make, model);
      
      if (classicResult.isClassicVehicle && classicResult.fitmentMode === "classic") {
        const classicRange: ClassicFitmentRange = classicResult.recommendedRange;
        
        console.log(`[fitment-search] Classic fitment found:`, {
          platform: classicResult.platform.code,
          stockDiameter: classicResult.stockReference.wheelDiameter,
          range: classicRange,
        });
        
        // Apply classic override - classic ranges become the source of truth
        envelope = applyClassicEnvelopeOverride(envelope, classicRange);
        classicFitmentUsed = true;
        
        // CRITICAL: Also update dbProfile offset range for resolveOemOffset check
        // Without this, the OEM offset validation uses vehicle_fitments data (often null)
        // instead of the classic_fitments recommended range
        if (classicRange.offset) {
          dbProfile.offsetMinMm = classicRange.offset.min;
          dbProfile.offsetMaxMm = classicRange.offset.max;
          console.log(`[fitment-search] Updated dbProfile offset range from classic_fitments: [${classicRange.offset.min}, ${classicRange.offset.max}]`);
        }
        
        console.log(`[fitment-search] Envelope after classic override:`, {
          diameter: [envelope.allowedMinDiameter, envelope.allowedMaxDiameter],
          width: [envelope.allowedMinWidth, envelope.allowedMaxWidth],
          offset: [envelope.allowedMinOffset, envelope.allowedMaxOffset],
        });
      } else {
        console.log(`[fitment-search] No classic fitment record for ${year} ${make} ${model}, using modern envelope`);
      }
    } catch (classicErr: any) {
      console.error(`[fitment-search] Classic fitment lookup failed:`, classicErr?.message || classicErr);
      // Fall back to modern envelope
    }
  }

  // ========================================================================
  // HD TRUCK OFFSET OVERRIDE
  // For HD trucks with explicit rearWheelConfig (SRW/DRW), the profile's
  // offsetMinMm/offsetMaxMm come from HD templates. However, DRW templates
  // have VERY wide ranges (-270 to +240) to cover all 3 wheel positions.
  // 
  // SRW: -44mm to +60mm (standard single rear wheel)
  // DRW: Two distinct ranges (NOT one continuous range):
  //   - Front/Inner positions: +75mm to +165mm (high positive offset)
  //   - Outer positions: -270mm to -150mm (extreme negative offset)
  // 
  // IMPORTANT: The wide DRW template range (-270 to +240) INCLUDES SRW offsets!
  // The actual filtering to exclude SRW-style offsets happens in the wheel
  // validation loop via the "DRW dead zone" exclusion logic.
  // ========================================================================
  if (rearWheelConfig && vehicleIsDRWCapable && 
      dbProfile.offsetMinMm !== null && dbProfile.offsetMaxMm !== null) {
    const hdOffsetMin = Number(dbProfile.offsetMinMm);
    const hdOffsetMax = Number(dbProfile.offsetMaxMm);
    
    console.log(`[fitment-search] HD TRUCK OFFSET OVERRIDE: ${rearWheelConfig.toUpperCase()}`);
    console.log(`  Before: offset [${envelope.allowedMinOffset}, ${envelope.allowedMaxOffset}]`);
    
    // Override envelope with HD-specific offset range
    // Don't apply mode expansion - HD offset ranges are already tuned
    envelope = {
      ...envelope,
      oemMinOffset: hdOffsetMin,
      oemMaxOffset: hdOffsetMax,
      allowedMinOffset: hdOffsetMin,
      allowedMaxOffset: hdOffsetMax,
    };
    
    console.log(`  After: offset [${envelope.allowedMinOffset}, ${envelope.allowedMaxOffset}]`);
  }

  // ========================================================================
  // STAGGERED-CAPABLE VEHICLE: AXLE CONFIRMATION (2026-06-30)
  // For vehicles in the staggered-capable list (BMW M3, Corvette, Mustang PP,
  // R8, GT-R, Viper, etc.), "axle unknown" must fail closed.
  // Only two outcomes allowed:
  //   a) isStaggered=true  → validated per-axle with requireAxleSpecific
  //   b) isStaggered=false AND confirmed square reason → use DB midpoint (safe)
  // Any other "axle unknown" state → hard fail.
  // ========================================================================
  if (isStaggeredCapableVehicle(make, model) && !staggeredInfo?.isStaggered) {
    const reason = staggeredInfo?.reason ?? "";
    if (!isConfirmedSquareSetup(reason)) {
      console.warn(
        `[fitment-search] UNKNOWN AXLE (staggered-capable): ${year} ${make} ${model} ` +
        `reason="${reason}" — failing closed`
      );
      logUnresolvedFitment({
        year, make, model,
        trim: dbProfile.displayTrim || undefined,
        searchType: "wheel", source: "api",
        path: url.pathname + url.search,
        modificationId: canonicalModificationId || undefined,
        resolutionAttempts: ["unknown_axle_configuration"],
      }).catch(() => {});
      return NextResponse.json({
        results: [], totalCount: 0,
        fitment: {
          unknownAxleConfiguration: true,
          message: `This vehicle is known to have staggered wheel configurations. ` +
            `Per-axle fitment data is required before we can safely show wheel recommendations. ` +
            `Please contact us for assistance.`,
          axleReason: reason || "insufficient wheel specification data",
          vehicle: { year: Number(year), make, model, trim: dbProfile.displayTrim || null },
          resolutionPath,
        },
        timing: { totalMs: Date.now() - t0 },
      });
    }
  }

  // ========================================================================
  // GEOMETRY VALIDATION SETUP (2026-06-30)
  // Resolve OEM offset for position-delta geometry validation.
  // Missing OEM offset = no customer-facing recommendations.
  // ========================================================================

  const geoVehicleClass: VehicleClass =
    vehicleType === "truck" ? "truck" :
    vehicleType === "suv"   ? "suv"   :
    (dbProfile.boltPattern?.startsWith("6x") || dbProfile.boltPattern?.startsWith("8x")) ? "truck" :
    "car";
  const geoProfile = mapModeToProfile(mode);

  // Primary OEM offset (all vehicles)
  const oemOffsetResult = resolveOemOffset({
    offsetMinMm: dbProfile.offsetMinMm,
    offsetMaxMm: dbProfile.offsetMaxMm,
    oemWheelSizes: parsedWheelSizes,
  });

  // Per-axle OEM offset for staggered vehicles (front/rear validated independently)
  // For staggered-capable vehicles, require per-axle offset data (fail closed if missing).
  // Non-staggered vehicles fall back to DB midpoint (axle not specified).
  const isKnownStaggered = staggeredInfo?.isStaggered && isStaggeredCapableVehicle(make, model);

  const frontOemOffsetResult: OemOffsetResult = isKnownStaggered && staggeredInfo?.frontSpec
    ? resolveOemOffset({
        offsetMinMm: dbProfile.offsetMinMm,
        offsetMaxMm: dbProfile.offsetMaxMm,
        oemWheelSizes: parsedWheelSizes,
        axle: "front",
        requireAxleSpecific: true,   // staggered: must have per-axle data
      })
    : oemOffsetResult;

  const rearOemOffsetResult: OemOffsetResult = isKnownStaggered && staggeredInfo?.rearSpec
    ? resolveOemOffset({
        offsetMinMm: dbProfile.offsetMinMm,
        offsetMaxMm: dbProfile.offsetMaxMm,
        oemWheelSizes: parsedWheelSizes,
        axle: "rear",
        requireAxleSpecific: true,   // staggered: must have per-axle data
      })
    : oemOffsetResult;

  // ========================================================================
  // CENTER BORE NULL CHECK (2026-06-30)
  // Null centerbore must not default to 0 — 0 passes every wheel's bore check.
  // Fail closed with a clear missing-data response.
  // ========================================================================
  if (!dbProfile.centerBoreMm || Number(dbProfile.centerBoreMm) <= 0) {
    console.warn(`[fitment-search] MISSING CENTER BORE: ${year} ${make} ${model} mod=${canonicalModificationId || "(none)"}`);
    logUnresolvedFitment({
      year, make, model,
      trim: dbProfile.displayTrim || undefined,
      searchType: "wheel", source: "api",
      path: url.pathname + url.search,
      modificationId: canonicalModificationId || undefined,
      resolutionAttempts: ["missing_center_bore"],
    }).catch(() => {});
    return NextResponse.json({
      results: [], totalCount: 0,
      fitment: {
        missingCenterBore: true,
        message: "Wheel recommendations require verified hub bore data for this vehicle.",
        vehicle: { year: Number(year), make, model, trim: dbProfile.displayTrim || null },
        resolutionPath,
      },
      timing: { totalMs: Date.now() - t0 },
    });
  }

  // Missing OEM offset → no customer-facing wheel recommendations
  if (oemOffsetResult.missing) {
    console.warn(`[fitment-search] MISSING OEM OFFSET: ${year} ${make} ${model} mod=${canonicalModificationId || "(none)"} — ${oemOffsetResult.reason}`);
    logUnresolvedFitment({
      year, make, model,
      trim: dbProfile.displayTrim || undefined,
      searchType: "wheel",
      source: "api",
      path: url.pathname + url.search,
      modificationId: canonicalModificationId || undefined,
      resolutionAttempts: ["missing_oem_offset"],
    }).catch(() => {});
    return NextResponse.json({
      results: [],
      totalCount: 0,
      fitment: {
        missingOemOffset: true,
        message: "Wheel recommendations require verified OEM offset data for this vehicle. Our team has been notified.",
        vehicle: { year: Number(year), make, model, trim: dbProfile.displayTrim || null },
        resolutionPath,
      },
      timing: { totalMs: Date.now() - t0 },
    });
  }

  // ========================================================================
  // Production path: DB-first candidate filtering + live availability validation
  // - No multi-page WheelPros scans
  // - Always enforces orderable + qty >= minQty
  // ========================================================================

  const requestedModificationId = url.searchParams.get("modification") || url.searchParams.get("trim") || null;

  return await handleDbFirstWheelResults({
    url,
    year,
    make,
    model,
    displayTrim: dbProfile.displayTrim,
    boltPattern: dbProfile.boltPattern!,
    envelope,
    mode,
    modeAutoDetected,
    vehicleType,
    resolutionPath,
    fitmentSource: "dbFirst",
    aliasUsed,
    canonicalModificationId,
    requestedModificationId,
    debug,
    t0,
    // Confidence result for response
    confidenceResult,
    // Staggered fitment info
    staggeredInfo,
    // Classic vehicle info
    isClassicVehicle: isClassic,
    classicFitmentUsed,
    // HD truck SRW/DRW configuration
    rearWheelConfig,
    isDRWCapable: vehicleIsDRWCapable,
    // Include dbProfile in response for accessory fitment calculation
    dbProfileForResponse: {
      modificationId: dbProfile.modificationId,
      displayTrim: dbProfile.displayTrim,
      boltPattern: dbProfile.boltPattern,
      centerBoreMm: dbProfile.centerBoreMm,
      threadSize: dbProfile.threadSize,
      seatType: dbProfile.seatType,
      offsetRange: {
        min: dbProfile.offsetMinMm,
        max: dbProfile.offsetMaxMm,
      },
      oemWheelSizes: dbProfile.oemWheelSizes,
      oemTireSizes: dbProfile.oemTireSizes,
      source: dbProfile.source,
    },
    // Fallback confidence (2026-04-26)
    fallbackConfidence,
    fallbackWarnings,
    // Geometry validation (2026-06-30)
    oemOffsetResult,
    frontOemOffsetResult,
    rearOemOffsetResult,
    geoVehicleClass,
    geoProfile,
  });
}

// ============================================================================
// Shared wheel results: DB-first candidates + live availability validation
// ============================================================================

/**
 * Diversifies candidate list by round-robin across brands.
 * Prevents getting stuck on one brand cluster.
 */
function diversifyCandidatesByBrand<T extends { brand_cd?: string }>(candidates: T[]): T[] {
  // Group by brand
  const byBrand = new Map<string, T[]>();
  for (const c of candidates) {
    const brand = c.brand_cd || "__unknown__";
    if (!byBrand.has(brand)) byBrand.set(brand, []);
    byBrand.get(brand)!.push(c);
  }

  // Round-robin interleave
  const brandQueues = Array.from(byBrand.values());
  const result: T[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const queue of brandQueues) {
      if (queue.length > 0) {
        result.push(queue.shift()!);
        added = true;
      }
    }
  }
  return result;
}

/**
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * DB-FIRST WHEEL SEARCH (March 2026 Architecture)
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 * 
 * This function returns ALL fitment-valid wheels from the local Techfeed database.
 * NO live WheelPros API calls are made during search.
 * 
 * Availability is shown as:
 * - "In Stock" / "Limited" - if cached value exists
 * - "Check Availability" - if no cached value (default)
 * 
 * Live availability checks happen ONLY at cart/checkout via:
 * POST /api/cart/validate-availability
 * 
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 */
async function handleDbFirstWheelResults(opts: {
  url: URL;
  year: string;
  make: string;
  model: string;
  displayTrim: string;
  boltPattern: string;
  envelope: ReturnType<typeof buildFitmentEnvelope>;
  mode: FitmentMode;
  modeAutoDetected: boolean;
  vehicleType: "truck" | "suv" | "car" | undefined;
  resolutionPath: FitmentResolutionPath;
  fitmentSource: string;
  aliasUsed?: boolean;
  canonicalModificationId?: string | null;
  requestedModificationId?: string | null;
  debug: boolean;
  t0: number;
  // Confidence result from safety check
  confidenceResult?: ConfidenceResult;
  // Staggered fitment info
  staggeredInfo?: StaggeredInfo;
  // Classic vehicle info
  isClassicVehicle?: boolean;
  classicFitmentUsed?: boolean;
  // HD truck SRW/DRW configuration
  rearWheelConfig?: RearWheelConfig;
  isDRWCapable?: boolean;
  // DB profile for accessory fitment calculation (threadSize, seatType, centerBoreMm)
  dbProfileForResponse?: {
    modificationId: string;
    displayTrim: string;
    boltPattern: string | null;
    centerBoreMm: number | null;
    threadSize: string | null;
    seatType: string | null;
    offsetRange: { min: number | null; max: number | null };
    oemWheelSizes: any[];
    oemTireSizes: string[];
    source: string;
  } | null;
  // Fallback confidence (2026-04-26)
  fallbackConfidence?: import("@/lib/fitment-db/fallbackEquivalence").FallbackConfidence;
  fallbackWarnings?: string[];
  // Geometry validation (2026-06-30)
  oemOffsetResult?: OemOffsetResult;
  frontOemOffsetResult?: OemOffsetResult;
  rearOemOffsetResult?: OemOffsetResult;
  geoVehicleClass?: VehicleClass;
  geoProfile?: "conservative" | "daily_driver" | "aggressive";
}): Promise<NextResponse> {
  const { url, envelope, debug, t0 } = opts;
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // TIMING INSTRUMENTATION
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const timing: Record<string, number | string | null> = {};

  const requestedPage = Math.max(1, Number(url.searchParams.get("page") || "1") || 1);
  // Allow larger page sizes to show all inventory (up to 3000)
  const requestedPageSize = Math.max(1, Math.min(3000, Number(url.searchParams.get("pageSize") || "24") || 24));

  const brandCd = url.searchParams.get("brand_cd");
  const finish = url.searchParams.get("finish");
  const diameter = url.searchParams.get("diameter");
  const width = url.searchParams.get("width");
  const styleFilter = url.searchParams.get("style"); // Wheel model/style filter (e.g., "KM235")
  
  // Sort parameter: "price_asc" (low to high), "price_desc" (high to low), or default (relevance/score)
  const sortParam = url.searchParams.get("sort") || url.searchParams.get("sortBy");
  
  // User-provided offset range (e.g., from lifted page: offsetMin=-18, offsetMax=0)
  // When provided, this HARD filters results to only show wheels within the specified range
  // This is critical for lifted trucks to avoid showing OEM +35mm offset wheels
  const offsetMinParam = url.searchParams.get("offsetMin");
  const offsetMaxParam = url.searchParams.get("offsetMax");
  const userOffsetMin = offsetMinParam ? Number(offsetMinParam) : null;
  const userOffsetMax = offsetMaxParam ? Number(offsetMaxParam) : null;
  const hasUserOffsetFilter = Number.isFinite(userOffsetMin) || Number.isFinite(userOffsetMax);

  // minQty for cached availability label (not used for filtering in DB-first mode)
  const minQty = Math.max(1, Number(url.searchParams.get("min_qty") || url.searchParams.get("minQty") || "4") || 4);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PHASE 1: Get candidates from Techfeed DB (local, fast)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const tCandidates0 = Date.now();
  
  // Log the bolt pattern being searched (critical for debugging DRW issues)
  console.log(`[fitment-search] ðŸ” SEARCHING: boltPattern=${opts.boltPattern}, rearWheelConfig=${opts.rearWheelConfig || 'n/a'}`);

  // â”€â”€â”€ Wheel-1 supplier (live, no gate) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Wheel-1 is fully live. preview_suppliers param is no longer required.
  // Wheel-1 candidates compete equally with WheelPros via the v3 ranking engine.

  const [techfeedCandidates, wheel1Candidates, wsiCandidates] = await Promise.all([
    getTechfeedCandidatesByBoltPattern(opts.boltPattern),
    getWheel1CandidatesByBoltPattern(opts.boltPattern),
    getWSICandidatesByBoltPattern(opts.boltPattern),
  ]);

  const candidates = [...techfeedCandidates, ...wheel1Candidates, ...wsiCandidates];

  if (wheel1Candidates.length > 0) {
    console.log(`[fitment-search] ðŸŸ¢ Wheel-1: ${wheel1Candidates.length} candidates (bp=${opts.boltPattern})`);
  }

  timing.candidatesDbMs = Date.now() - tCandidates0;
  
  console.log(`[fitment-search] ðŸ“¦ Found ${techfeedCandidates.length} WheelPros + ${wheel1Candidates.length} Wheel-1 candidates (bp=${opts.boltPattern})`);
  
  // Debug specific SKU tracing
  const debugSku = url.searchParams.get("debugSku");
  const debugTrace: string[] = [];
  if (debugSku) {
    const debugCandidate = candidates.find(c => c.sku === debugSku);
    debugTrace.push(`1. In initial candidates (bolt pattern ${opts.boltPattern}): ${!!debugCandidate}`);
    if (debugCandidate) {
      debugTrace.push(`   - diameter=${debugCandidate.diameter}, offset=${debugCandidate.offset}, msrp=${debugCandidate.msrp}`);
    }
  }

  // Apply basic DB-level filters (cheap, no I/O)
  const filteredCandidates = candidates.filter((c) => {
    // Brand filter: supports both codes (FC) and names (Fuel)
    if (brandCd && !matchesBrandFilter(c.brand_cd || "", brandCd)) return false;
    // Finish filter: partial match (case-insensitive) on raw finish text
    // e.g., "bronze" matches "MATTE BRONZE W/ BLACK RING", "BRONZE", etc.
    if (finish) {
      const finishLower = finish.toLowerCase();
      const fancyLower = (c.fancy_finish_desc || "").toLowerCase();
      const abbrLower = (c.abbreviated_finish_desc || "").toLowerCase();
      // Match if either description contains the filter term
      if (!fancyLower.includes(finishLower) && !abbrLower.includes(finishLower)) return false;
    }
    if (diameter && c.diameter && Number(c.diameter) !== Number(diameter)) return false;
    if (width && c.width && Number(c.width) !== Number(width)) return false;
    // Style filter - match wheel model name (e.g., "KM235", "ARCHER")
    if (styleFilter) {
      const wheelStyle = (c.style || c.display_style_no || "").toUpperCase();
      const filterUpper = styleFilter.toUpperCase();
      // Match if style contains filter or vice versa (handles "KM235" matching "KM235 GRENADE")
      if (!wheelStyle.includes(filterUpper) && !filterUpper.includes(wheelStyle)) return false;
    }

    // valid pricing fields (required) - use safe pricing with data quality fix
    const p = getSafeWheelPrice(c);
    if (p <= 0) return false;

    // best-effort: skip obviously discontinued items if present in text
    const desc = (c.product_desc || "").toLowerCase();
    if (desc.includes("discontinued")) return false;

    return true;
  });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // P0 FIX: UTV/POWERSPORTS FILTER (2026-05-20)
  // CRITICAL: Filter out UTV/ATV/SxS wheels from automotive searches
  // These share 5x4.5 bolt pattern with classic muscle but are NOT automotive wheels
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const tUtvFilter0 = Date.now();
  const utvFilterInput = filteredCandidates.map(c => ({
    ...c,
    productDesc: c.product_desc,
    brandCode: c.brand_cd,
    brandDesc: c.brand_desc,
  }));
  
  const utvFilterResult = filterOutUTVProducts(utvFilterInput, {
    logRejections: debug,
    vehicleType: 'automotive', // Always automotive for this endpoint
  });
  
  // Replace filteredCandidates with UTV-filtered results
  const utvFilteredCandidates = utvFilterResult.filtered as typeof filteredCandidates;
  timing.utvFilterMs = Date.now() - tUtvFilter0;
  timing.utvRejectedCount = utvFilterResult.analytics.totalRejected;
  
  // Log UTV filter analytics if any were rejected
  if (utvFilterResult.analytics.totalRejected > 0) {
    logUTVFilterAnalytics(utvFilterResult.analytics, {
      vehicle: opts.displayTrim || "Unknown Vehicle",
      boltPattern: opts.boltPattern,
    });
  }

  // Diversify by brand (round-robin) to avoid brand clustering
  const tDiversify0 = Date.now();
  const diversifiedCandidates = diversifyCandidatesByBrand(utvFilteredCandidates);
  timing.diversifyMs = Date.now() - tDiversify0;
  timing.candidatesAfterFilter = utvFilteredCandidates.length;
  timing.candidatesAfterUtvFilter = utvFilteredCandidates.length;
  
  // Debug SKU tracing - after basic filter
  if (debugSku) {
    const afterFilter = filteredCandidates.find(c => c.sku === debugSku);
    debugTrace.push(`2. After basic filter: ${!!afterFilter}`);
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PHASE 2: Fitment validation (fast, no I/O)
  // NO AVAILABILITY FILTERING - return ALL fitment-valid wheels
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const tFitment0 = Date.now();
  type FitmentValidCandidate = {
    candidate: typeof diversifiedCandidates[0];
    validation: FitmentValidation;
  };
  let fitmentValidCandidates: FitmentValidCandidate[] = [];
  
  // DRW dead-zone tracking (for logging)
  let drwDeadZoneExcluded = 0;

  for (const c of diversifiedCandidates) {
    const wheelSpec: WheelSpec = {
      sku: c.sku,
      boltPattern: c.bolt_pattern_metric || c.bolt_pattern_standard || envelope.boltPattern,
      centerBore: c.centerbore != null ? Number(c.centerbore) : undefined,
      diameter: c.diameter != null ? Number(c.diameter) : undefined,
      width: c.width != null ? Number(c.width) : undefined,
      offset: c.offset != null ? Number(c.offset) : undefined,
    };

    const v = validateWheel(wheelSpec, envelope);
    if (v.fitmentClass === "excluded") continue;
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // DIAMETER HANDLING (April 2026 Update)
    // 
    // Diameter is now a RANKING SIGNAL with a SAFETY FLOOR, not a hard filter.
    // validateWheel() classifies wheels as surefit/specfit/extended based on
    // how close they are to OEM, but does NOT exclude based on diameter alone.
    // 
    // SAFETY FLOOR: We enforce a minimum based on vehicle type to prevent
    // brake clearance issues. Importantly, we allow DOWNSIZING from high-trim
    // OEM wheels (e.g., F-150 Limited with 22" can run 17" for off-road).
    // 
    // - Trucks (6-lug): 17" absolute floor (all full-size trucks clear 17")
    // - SUVs: 17" absolute floor
    // - Cars: 15" absolute floor (smaller brakes)
    // 
    // MAXIMUM: We allow generous upsizing (OEM + 8) but cap at 28" sanity check
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    if (wheelSpec.diameter !== undefined) {
      const wheelDia = Number(wheelSpec.diameter);
      
      // Sanity check: reject obviously invalid diameters (data errors)
      if (wheelDia < 14 || wheelDia > 30) {
        continue;
      }
      
      // SAFETY FLOOR: Based on vehicle type, NOT trim-specific OEM diameter
      // This allows customers to downsize from high-trim wheels (e.g., 22" Limited â†’ 17" off-road)
      // while still preventing brake clearance issues
      let safetyFloor: number;
      if (opts.vehicleType === "truck") {
        // Full-size trucks: 17" minimum (all clear 17" regardless of stock wheel size)
        safetyFloor = 17;
      } else if (opts.vehicleType === "suv") {
        // SUVs: 17" minimum (most modern SUVs have large brakes)
        safetyFloor = 17;
      } else {
        // Cars: 15" minimum (smaller brakes, but still need clearance)
        safetyFloor = 15;
      }
      
      // Safety ceiling: OEM + 8" or 28", whichever is smaller
      const safetyCeiling = Math.min(28, envelope.oemMaxDiameter + 8);
      
      if (wheelDia < safetyFloor || wheelDia > safetyCeiling) {
        continue;
      }
    }
    
    // User-provided offset range filter (HARD filter - user explicitly requested)
    if (hasUserOffsetFilter && wheelSpec.offset !== undefined) {
      const wheelOffset = Number(wheelSpec.offset);
      if (Number.isFinite(wheelOffset)) {
        if (Number.isFinite(userOffsetMin) && wheelOffset < userOffsetMin!) continue;
        if (Number.isFinite(userOffsetMax) && wheelOffset > userOffsetMax!) continue;
      }
    }
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // ENVELOPE OFFSET FILTER (HD SRW/DRW Critical)
    // 
    // The envelope's allowedMinOffset/allowedMaxOffset define the SAFE offset
    // range for this specific vehicle configuration. This is especially
    // critical for HD trucks where:
    //   - SRW: -44mm to +60mm (standard single rear wheel)
    //   - DRW: Two distinct ranges (NOT one big range):
    //       - Front/Inner positions: +65mm to +165mm (high positive)
    //       - Outer positions: -270mm to -65mm (negative)
    // 
    // DRW wheels are a completely different category - they're designed for
    // multi-wheel positions and have offsets that SRW wheels NEVER have.
    // The SRW "dead zone" (-65mm to +65mm) should be EXCLUDED from DRW results.
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    // DRW REQUIRES valid offset data - reject wheels with NULL/undefined offset
    // because we can't verify they're actually DRW wheels without it
    if (opts.rearWheelConfig === "drw" && (wheelSpec.offset === undefined || wheelSpec.offset === null)) {
      drwDeadZoneExcluded++;
      continue; // Skip - can't verify DRW compatibility without offset data
    }
    
    if (!hasUserOffsetFilter && wheelSpec.offset !== undefined) {
      const wheelOffset = Number(wheelSpec.offset);
      if (Number.isFinite(wheelOffset)) {
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // DRW SPECIAL CASE: Exclude SRW "dead zone" offsets
        // 
        // DRW templates have wide offset ranges (-270 to +240) to cover all
        // wheel positions. But this incorrectly includes SRW wheels.
        // 
        // True DRW wheels have either:
        //   - High positive offset (â‰¥+75mm) for front/inner positions
        //   - Extreme negative offset (â‰¤-150mm) for outer positions
        // 
        // Wheels with offset between -75 and +75 are SRW-style and should
        // NOT appear in DRW results. This is the "dead zone" exclusion.
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        if (opts.rearWheelConfig === "drw") {
          // DRW wheels have TWO valid offset ranges (NOT one continuous range):
          //   - Front/Inner positions: typically +76mm to +145mm
          //   - Outer positions: typically -76mm to -140mm (aftermarket) or -220mm (OEM)
          //
          // SRW wheels typically: -44mm to +60mm
          //
          // Dead zone (SRW territory to exclude): -65mm to +65mm
          // Using -65/+65 gives a buffer zone to avoid edge cases
          const DRW_INNER_MIN_OFFSET = 65;   // Front/inner wheels start around here
          const DRW_OUTER_MAX_OFFSET = -65;  // Outer wheels end around here
          
          // Reject if offset falls in the SRW "dead zone"
          // Valid DRW offsets are: offset >= +65 OR offset <= -65
          const isValidDrwOffset = wheelOffset >= DRW_INNER_MIN_OFFSET || wheelOffset <= DRW_OUTER_MAX_OFFSET;
          if (!isValidDrwOffset) {
            drwDeadZoneExcluded++;
            continue; // Skip - this is an SRW-style offset, not a true DRW wheel
          }
        } else {
          // ═══════════════════════════════════════════════════════════════
          // GEOMETRY-BASED OFFSET VALIDATION (2026-06-30)
          // OEM-relative position delta check replaces flat range check.
          // delta_backspacing = how far wheel moves inboard vs OEM (dangerous).
          // delta_outboard    = how far wheel face moves outboard vs OEM.
          // Missing OEM offset was caught before the loop; won't be null here.
          // ═══════════════════════════════════════════════════════════════
          const activeGeoPrimary   = opts.oemOffsetResult;
          const activeGeoFront     = opts.frontOemOffsetResult ?? activeGeoPrimary;
          const activeGeoRear      = opts.rearOemOffsetResult  ?? activeGeoPrimary;
          const geoVehicleClass    = opts.geoVehicleClass ?? "car";
          const geoProfile         = opts.geoProfile      ?? "daily_driver";
          const staggeredInfo      = opts.staggeredInfo;

          // For staggered vehicles: assign to whichever axle this wheel width fits best
          let activeOemGeo = activeGeoPrimary;
          if (staggeredInfo?.isStaggered) {
            const cw = Number(c.width) || 0;
            const fw = staggeredInfo.frontSpec?.width ?? 0;
            const rw = staggeredInfo.rearSpec?.width  ?? 0;
            activeOemGeo = Math.abs(cw - fw) <= Math.abs(cw - rw)
              ? activeGeoFront
              : activeGeoRear;
          }

          if (activeOemGeo && !activeOemGeo.missing) {
            const candidateWidth = Number(c.width) || activeOemGeo.width_in;
            const geo = computeWheelGeometry(
              { width_in: candidateWidth,          offset_mm: wheelOffset },
              { width_in: activeOemGeo.width_in,   offset_mm: activeOemGeo.offset_mm },
              geoVehicleClass,
            );

            if (geo.exceedsSafetyCeiling) {
              // Hard safety ceiling — always excluded in every profile
              if (debug) console.log(`[fitment-search] GEO EXCLUDED (safety ceiling) ${c.sku}: delta_bs=${geo.delta_backspacing_mm.toFixed(1)}mm`);
              continue;
            }

            const passesProfile =
              geoProfile === "conservative" ? geo.passesConservative :
              geoProfile === "aggressive"   ? geo.passesAggressive   :
              geo.passesDailyDriver;  // daily_driver default

            if (!passesProfile) {
              if (geoProfile === "conservative") {
                // Conservative mode: reject anything outside conservative thresholds
                if (debug) console.log(`[fitment-search] GEO EXCLUDED (conservative) ${c.sku}: delta_bs=${geo.delta_backspacing_mm.toFixed(1)}mm`);
                continue;
              }
              // daily_driver / aggressive: reject only if beyond aggressive thresholds
              if (!geo.passesAggressive) {
                if (debug) console.log(`[fitment-search] GEO EXCLUDED (beyond aggressive) ${c.sku}: delta_bs=${geo.delta_backspacing_mm.toFixed(1)}mm delta_out=${geo.delta_outboard_mm.toFixed(1)}mm`);
                continue;
              }
              // Falls into "extended" — passes but will be labeled as such by fitment guidance
            }
          }
        }
      }
    }

    fitmentValidCandidates.push({ candidate: c, validation: v });
  }

  timing.fitmentValidationMs = Date.now() - tFitment0;
  timing.fitmentValidCount = fitmentValidCandidates.length;
  
  // Debug SKU tracing - after fitment validation
  if (debugSku) {
    const afterFitment = fitmentValidCandidates.find(c => c.candidate.sku === debugSku);
    debugTrace.push(`3. After fitment validation: ${!!afterFitment}`);
  }
  
  // Log DRW dead-zone exclusions if any
  if (opts.rearWheelConfig === "drw" && drwDeadZoneExcluded > 0) {
    console.log(`[fitment-search] ðŸš› DRW FILTER: Excluded ${drwDeadZoneExcluded} wheels with SRW-style offsets (-65 to +65mm)`);
    timing.drwDeadZoneExcluded = drwDeadZoneExcluded;
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PHASE 3: Inventory lookup from SFTP feed (synced every 2 hours)
  // FILTER: Only show SKUs that exist in inventory (removes discontinued products)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const tAvail0 = Date.now();
  const allSkus = fitmentValidCandidates.map(item => item.candidate.sku);
  const inventoryResult = await getInventoryBulk(allSkus);
  const inventoryData = inventoryResult.data;
  const redisError = inventoryResult.redisError;
  timing.cachedAvailabilityMs = Date.now() - tAvail0;

  // Log Redis errors but continue gracefully
  if (redisError) {
    console.warn(`[fitment-search] ⚠️ Redis error - bypassing inventory filter: ${inventoryResult.errorMessage}`);
  }

  // â”€â”€â”€ Wheel-1: inject synthetic inventory records (always) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Wheel-1 SKUs are not in the WheelPros SFTP feed so getInventoryBulk returns
  // nothing for them. Without this injection they are killed at the inventory
  // filter (NOT in cache â†’ EXCLUDED). Real feed replaces this in Phase 3.
  if (wheel1Candidates.length > 0) {
    for (const c of wheel1Candidates) {
      if (!inventoryData.has(c.sku)) {
        // Use inventoryType="ST" (stocking) so the ORDERABLE_TYPES filter passes.
        // qty=4 = minimum set-of-four threshold.
        // Real inventory replaces this when the Wheel-1 SFTP feed is wired.
        inventoryData.set(c.sku, {
          sku:           c.sku,
          inventoryType: "ST",   // passes ORDERABLE_TYPES filter
          totalQty:      20,     // in_stock tier (+40 pts) to compete with WheelPros
          mapPrice:      c._mapNum ?? null,
          msrp:          c._msrpNum ?? null,
          cachedAt:      Date.now(),
        } as CachedInventory);
      }
    }
  }

  // ── WSI Wholesale: inject inventory so SKUs pass the ORDERABLE_TYPES filter ──
  if (wsiCandidates.length > 0) {
    for (const c of wsiCandidates) {
      if (!inventoryData.has(c.sku)) {
        // WSI has real stock counts from nightly FTP sync.
        // Use totalQty from wsi_wheels; fall back to 4 (enough for a set) if 0.
        const qty = c._inventoryQty > 0 ? c._inventoryQty : 4;
        inventoryData.set(c.sku, {
          sku:           c.sku,
          inventoryType: "ST",
          totalQty:      qty,
          mapPrice:      null,   // WSI has no MAP
          msrp:          c._catalogPrice ?? null,
          cachedAt:      Date.now(),
        } as CachedInventory);
      }
    }
  }

  timing.cachedAvailabilityHits = inventoryData.size;
  timing.totalFitmentValid = fitmentValidCandidates.length;
  
  // INVENTORY FILTER: Soft filter - use inventory cache for labeling, not hard filtering
  // 
  // Why soft filter? The SFTP inventory feed may lag behind Dealerline or be incomplete.
  // If a wheel exists in wp_wheels (techfeed), it's a current WheelPros product.
  // We trust the techfeed for product availability, use SFTP feed for stock levels.
  //
  // Orderable types from WheelPros:
  // - ST = Stocking (warehouse stock)
  // - BW = Buy When Sold (can order from other locations)
  // - NW = Non-Stocking Wheel (available from other warehouses)
  // - SO = Special Order
  // - CS = Custom/Special
  //
  // Filter logic (2026-07-19 FIX):
  // - MUST have at least 4 units total (customers buy sets of 4)
  // - If in inventory cache with qty >= 4 â†’ include
  // - If in inventory cache with qty < 4 â†’ exclude (can't fulfill a set)
  // - If NOT in inventory cache â†’ exclude (can't verify availability)
  //
  // Previous bug: orderable types were included regardless of qty,
  // which showed wheels with only 1-3 units nationally as "in stock"
  const ORDERABLE_TYPES = new Set(["ST", "BW", "NW", "SO", "CS"]);
  const MIN_INVENTORY_QTY = 4; // Minimum for a set of wheels
  const preFilterCount = fitmentValidCandidates.length;
  
  // REDIS RESILIENCE: If Redis failed, bypass inventory filtering entirely.
  // Better to show potentially unavailable wheels than show nothing.
  // Customers can still add to cart; stock is verified at checkout.
  if (redisError) {
    console.warn(`[fitment-search] Bypassing inventory filter due to Redis error - showing all ${preFilterCount} fitment-valid wheels`);
    timing.inventoryFilteredOut = 0;
    timing.redisError = true;
  } else {
  fitmentValidCandidates = fitmentValidCandidates.filter(item => {
    const inv = inventoryData.get(item.candidate.sku);
    
    // Not in inventory cache? Exclude - can't verify we have enough stock
    if (!inv) {
      if (debugSku && item.candidate.sku === debugSku) {
        debugTrace.push(`4. Inventory filter: NOT in cache â†’ EXCLUDED (can't verify stock)`);
      }
      return false;
    }
    
    const isOrderable = ORDERABLE_TYPES.has(inv.inventoryType);
    const hasSufficientQty = inv.totalQty >= MIN_INVENTORY_QTY;
    
    if (debugSku && item.candidate.sku === debugSku) {
      debugTrace.push(`4. Inventory filter: invType=${inv.inventoryType}, qty=${inv.totalQty}, orderable=${isOrderable}, sufficientQty=${hasSufficientQty}, result=${isOrderable && hasSufficientQty}`);
    }
    
    // Must be orderable type AND have at least 4 units to sell a set
    return isOrderable && hasSufficientQty;
  });
    timing.inventoryFilteredOut = preFilterCount - fitmentValidCandidates.length;
  }
  
  if (debug && timing.inventoryFilteredOut > 0) {
    console.log(`[fitment-search] ðŸ—‘ï¸ Inventory filter removed ${timing.inventoryFilteredOut} SKUs (not in feed or qty < ${MIN_INVENTORY_QTY})`);
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PHASE 4: RANKING & SCORING (v2 - Merchandising Refinement)
  // Score each wheel for quality-based ordering without removing any results
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const tRanking0 = Date.now();
  
  // v3 ranking: TIER_1_BRANDS/TIER_2_BRANDS removed â€” replaced by fitmentClassScore
  // (supplier-neutral: surefit=100, specfit=80, extended=55 from rankingEngine.ts)
  // PREMIUM_FINISHES imported from rankingEngine.ts
  
  // Calculate OEM midpoints for fitment quality scoring
  const oemMidDiameter = (envelope.oemMinDiameter + envelope.oemMaxDiameter) / 2;
  const oemMidOffset = (envelope.oemMinOffset + envelope.oemMaxOffset) / 2;
  
  // Calculate price statistics for tiered pricing (using safe pricing with data quality fix)
  const allPrices = fitmentValidCandidates
    .map(item => getSafeWheelPrice(item.candidate))
    .filter(p => p > 0)
    .sort((a, b) => a - b);
  const priceP25 = allPrices.length > 0 ? allPrices[Math.floor(allPrices.length * 0.25)] : 200;
  const priceP50 = allPrices.length > 0 ? allPrices[Math.floor(allPrices.length * 0.50)] : 350;
  const priceP75 = allPrices.length > 0 ? allPrices[Math.floor(allPrices.length * 0.75)] : 550;
  
  // Score each candidate
  type ScoredCandidate = {
    candidate: typeof fitmentValidCandidates[0]["candidate"];
    validation: typeof fitmentValidCandidates[0]["validation"];
    score: number;
    scoreBreakdown: ScoreBreakdownV2; // v3: fitmentClass replaces brandTier
    availabilityLabel: "in_stock" | "limited" | "check_availability";
    priceTier: "value" | "mid" | "premium";
    modelKey: string; // brand+style for deduping
  };
  
  // ORDERABLE_TYPES already defined above in inventory filter section
  
  const scoredCandidates: ScoredCandidate[] = fitmentValidCandidates.map(({ candidate: c, validation: v }) => {
    const inv = inventoryData.get(c.sku);
    const totalStock = inv?.totalQty || 0;
    const invType = inv?.inventoryType || "";
    const isOrderable = ORDERABLE_TYPES.has(invType);
    
    // Determine availability label based on inventory type and stock
    let availabilityLabel: "in_stock" | "limited" | "check_availability" = "check_availability";
    if (isOrderable && totalStock >= minQty * 2) {
      availabilityLabel = "in_stock";
    } else if (isOrderable && totalStock >= minQty) {
      availabilityLabel = "limited";
    } else if (isOrderable) {
      availabilityLabel = "limited"; // Orderable but low/no stock
    }
    
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // SCORING v2 (rebalanced weights, normalized availability)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    
    // â”€â”€ SCORING v3 (supplier-neutral, 2026-06-24) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Weights from SCORE_WEIGHTS in rankingEngine.ts:
    //   availability 25% | fitmentClass 20% | fitmentQuality 15%
    //   visualQuality 15% | priceRange 10% | customerValue 10% | finishBoost 5%

    // 1. Availability Score (0-100, weight: 25%)
    let availabilityScore = 50; // check_availability baseline
    if (availabilityLabel === "in_stock") availabilityScore = 100;
    else if (availabilityLabel === "limited") availabilityScore = 75;

    // 2. Fitment Class Score (0-100, weight: 20%)  â† replaces brandTierScore
    // Supplier-neutral: surefit=100, specfit=80, extended=55
    // A Wheel-1 surefit scores identically to a WheelPros surefit.
    const fitmentClassScore = computeFitmentClassScore(v.fitmentClass);

    // 3. Fitment Quality Score (0-100, weight: 15%)
    // UPDATED (April 2026): OEM sizes get explicit boost, but extended sizes still shown
    let fitmentQualityScore = 50;
    const wheelDiameter = Number(c.diameter) || 0;
    const wheelOffset = Number(c.offset) || 0;
    const wheelWidth = Number(c.width) || 0;

    // Check if wheel is within OEM ranges (for priority ranking)
    const isOemDiameter = wheelDiameter >= envelope.oemMinDiameter && wheelDiameter <= envelope.oemMaxDiameter;
    const isOemWidth = wheelWidth >= envelope.oemMinWidth && wheelWidth <= envelope.oemMaxWidth;
    const isOemOffset = wheelOffset >= envelope.oemMinOffset && wheelOffset <= envelope.oemMaxOffset;

    // Diameter scoring: OEM gets highest score, near-OEM is good, extended is acceptable
    if (wheelDiameter > 0) {
      if (isOemDiameter) {
        fitmentQualityScore = 100;
      } else {
        const distFromOem = wheelDiameter < envelope.oemMinDiameter
          ? envelope.oemMinDiameter - wheelDiameter
          : wheelDiameter - envelope.oemMaxDiameter;
        if (distFromOem <= 1)      fitmentQualityScore = 80;  // +1" from OEM = good
        else if (distFromOem <= 2) fitmentQualityScore = 65;  // +2" = acceptable
        else if (distFromOem <= 4) fitmentQualityScore = 50;  // +3-4" = standard
        else                       fitmentQualityScore = 35;  // >4" = lower priority
      }
    }
    // Width/Offset bonus: boost if within OEM ranges
    if (isOemWidth)  fitmentQualityScore = Math.min(100, fitmentQualityScore + 5);
    if (isOemOffset) fitmentQualityScore = Math.min(100, fitmentQualityScore + 5);
    // Offset bonus for near midpoint
    if (c.offset != null && !isOemOffset) {
      const offsetDiff = Math.abs(wheelOffset - oemMidOffset);
      if (offsetDiff <= 15) fitmentQualityScore = Math.min(100, fitmentQualityScore + 3);
    }

    // 4. Visual Quality Score (0-100, weight: 15%)
    let visualQualityScore = 35; // no images
    const images = c.images || [];
    if (images.length >= 3) visualQualityScore = 100;
    else if (images.length >= 1) visualQualityScore = 75;

    // 5. Price Range Score (0-100, weight: 10%)  â† reduced from 15%
    const price = getSafeWheelPrice(c);
    let priceRangeScore = 50;
    let priceTier: "value" | "mid" | "premium" = "mid";
    if (price > 0) {
      if (price < priceP25) {
        priceTier = "value";
        priceRangeScore = 80;
      } else if (price <= priceP75) {
        priceTier = "mid";
        priceRangeScore = 100;
      } else {
        priceTier = "premium";
        priceRangeScore = 85;
      }
    }

    // 6. Customer Value Score (0-100, weight: 10%)  â† NEW in v3
    // Supplier-neutral: checks _freeShipping and _inventoryQty properties
    const customerValueScore = computeCustomerValueScore(c as Record<string, unknown>);

    // 7. Finish Boost (0-10 bonus, weight: 5%)
    let finishBoost = 0;
    const finishDesc = (c.abbreviated_finish_desc || c.fancy_finish_desc || "").toUpperCase();
    const productDesc = (c.product_desc || "").toUpperCase();
    const combinedDesc = `${finishDesc} ${productDesc}`;
    for (const finish of PREMIUM_FINISHES) {
      if (combinedDesc.includes(finish)) { finishBoost = 10; break; }
    }

    // Weighted total (v3 formula â€” weights from SCORE_WEIGHTS)
    const score = (
      availabilityScore   * SCORE_WEIGHTS.availability   +
      fitmentClassScore   * SCORE_WEIGHTS.fitmentClass   +
      fitmentQualityScore * SCORE_WEIGHTS.fitmentQuality +
      visualQualityScore  * SCORE_WEIGHTS.visualQuality  +
      priceRangeScore     * SCORE_WEIGHTS.priceRange     +
      customerValueScore  * SCORE_WEIGHTS.customerValue  +
      finishBoost         * SCORE_WEIGHTS.finishBoost
    );

    // Model key for deduping (brand + style/display_style_no)
    const modelKey = `${c.brand_cd || ""}:${c.style || c.display_style_no || c.product_desc?.split(" ")[0] || ""}`.toLowerCase();

    return {
      candidate: c,
      validation: v,
      score,
      scoreBreakdown: {
        availability:   availabilityScore,
        fitmentClass:   fitmentClassScore,   // v3: was brandTier
        fitmentQuality: fitmentQualityScore,
        visualQuality:  visualQualityScore,
        priceRange:     priceRangeScore,
        customerValue:  customerValueScore,  // v3: new
        finishBoost,
      } satisfies ScoreBreakdownV2,
      availabilityLabel,
      priceTier,
      modelKey,
    };
  });
  
  // Sort by user-selected sort option, or default relevance scoring
  const availabilityTierOrder: Record<string, number> = {
    "in_stock": 0,
    "limited": 1,
    "check_availability": 2,
  };
  
  // Helper to get price from candidate (uses safe pricing with data quality fix)
  const getCandidatePrice = (c: ScoredCandidate) => getSafeWheelPrice(c.candidate);
  
  if (sortParam === "price_asc" || sortParam === "price-low-to-high") {
    // Price low to high - still respect availability tier
    scoredCandidates.sort((a, b) => {
      const tierA = availabilityTierOrder[a.availabilityLabel] ?? 2;
      const tierB = availabilityTierOrder[b.availabilityLabel] ?? 2;
      if (tierA !== tierB) return tierA - tierB;
      return getCandidatePrice(a) - getCandidatePrice(b);
    });
  } else if (sortParam === "price_desc" || sortParam === "price-high-to-low") {
    // Price high to low - still respect availability tier
    scoredCandidates.sort((a, b) => {
      const tierA = availabilityTierOrder[a.availabilityLabel] ?? 2;
      const tierB = availabilityTierOrder[b.availabilityLabel] ?? 2;
      if (tierA !== tierB) return tierA - tierB;
      return getCandidatePrice(b) - getCandidatePrice(a);
    });
  } else {
    // Default: availability tier first, then by relevance score
    scoredCandidates.sort((a, b) => {
      const tierA = availabilityTierOrder[a.availabilityLabel] ?? 2;
      const tierB = availabilityTierOrder[b.availabilityLabel] ?? 2;
      if (tierA !== tierB) return tierA - tierB;
      return b.score - a.score;
    });
  }
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PHASE 4b: MERCHANDISING POST-PROCESSING
  // 1. Model-level deduping for top slots
  // 2. Brand concentration control
  // 3. Price mix optimization
  // 4. Consecutive brand limit
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  // Skip merchandising rules when user explicitly sorts by price (preserve exact price order)
  const isPriceSorted = sortParam === "price_asc" || sortParam === "price-low-to-high" ||
                        sortParam === "price_desc" || sortParam === "price-high-to-low";
  // v3: replaced applyMerchandisingRules with supplier-neutral version from rankingEngine.ts
  // â†’ adds Rule 5 (supplier diversity cap) on top of existing rules 1-4
  let rankedCandidates = isPriceSorted
    ? scoredCandidates
    : applySupplierNeutralMerchandising(scoredCandidates);
  
  timing.rankingMs = Date.now() - tRanking0;

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PHASE 4c: PACKAGE PRIORITY SORTING (Optional Overlay)
  // Apply ONLY when: searchType === 'package' OR buildType === 'lifted'
  // Prioritizes: WheelPros + image + stock > image + stock > WheelPros + stock > rest
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const packageParam = url.searchParams.get("package");
  const buildTypeParam = url.searchParams.get("buildType");
  const searchTypeParam = url.searchParams.get("searchType");
  
  const applyPackagePriority = shouldApplyPackagePriority({
    searchType: searchTypeParam || undefined,
    buildType: buildTypeParam || undefined,
    package: packageParam || undefined,
  });
  
  let packagePriorityApplied = false;
  
  // Skip package priority when user explicitly sorts by price
  if (applyPackagePriority && !isPriceSorted) {
    const tPkgPriority0 = Date.now();
    
    // Re-sort by package priority tiers, then by price within each tier
    rankedCandidates = [...rankedCandidates].sort((a, b) => {
      // Extract fields for priority calculation
      const aHasImage = (a.candidate.images || []).length > 0;
      const bHasImage = (b.candidate.images || []).length > 0;
      const aStock = inventoryData.get(a.candidate.sku)?.totalQty || 0;
      const bStock = inventoryData.get(b.candidate.sku)?.totalQty || 0;
      const aPrice = getSafeWheelPrice(a.candidate) || Infinity;
      const bPrice = getSafeWheelPrice(b.candidate) || Infinity;
      
      // v3: package priority is supplier-neutral â€” image + stock matters, not supplier name
      // Tier 1: has image + has stock (any supplier)
      // Tier 2: has stock only (any supplier)
      // Tier 3: everything else
      const getTier = (hasImg: boolean, stock: number): PackagePriorityTier => {
        if (hasImg && stock > 0) return 1;
        if (stock > 0) return 2;
        if (hasImg) return 3;
        return 4;
      };

      const aTier = getTier(aHasImage, aStock);
      const bTier = getTier(bHasImage, bStock);
      
      // Sort by tier first (ascending: 1 â†’ 4)
      if (aTier !== bTier) {
        return aTier - bTier;
      }
      
      // Within same tier, sort by price ascending
      return aPrice - bPrice;
    });
    
    timing.packagePriorityMs = Date.now() - tPkgPriority0;
    packagePriorityApplied = true;
    
    console.log(`[fitment-search] ðŸ“¦ PACKAGE PRIORITY applied: reordered ${rankedCandidates.length} results`);
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PHASE 4d: STAGGERED PAIRING
  // For staggered fitments, find wheels that exist in BOTH front and rear widths
  // Mark them with pair.staggered = true so frontend can filter to complete sets
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const tStaggeredPairing0 = Date.now();
  let staggeredPairsFound = 0;
  
  // Only do pairing if vehicle is staggered
  if (opts.staggeredInfo?.isStaggered && opts.staggeredInfo.frontSpec && opts.staggeredInfo.rearSpec) {
    const frontWidth = opts.staggeredInfo.frontSpec.width;
    const rearWidth = opts.staggeredInfo.rearSpec.width;
    const frontDiameter = opts.staggeredInfo.frontSpec.diameter;
    const rearDiameter = opts.staggeredInfo.rearSpec.diameter;
    
    console.log(`[fitment-search] ðŸ”„ STAGGERED PAIRING: looking for front ${frontDiameter}"Ã—${frontWidth}" + rear ${rearDiameter}"Ã—${rearWidth}"`);
    
    // Group candidates by style (brand + model)
    const styleGroups = new Map<string, typeof rankedCandidates>();
    for (const c of rankedCandidates) {
      const brandCode = c.candidate.brand_cd || "";
      // Use style or model name for grouping
      const styleName = c.candidate.style || c.candidate.display_style_no || 
                       (c.candidate.product_desc?.split(" ")[0]) || "";
      const styleKey = `${brandCode}:${styleName}`.toLowerCase();
      
      if (!styleGroups.has(styleKey)) {
        styleGroups.set(styleKey, []);
      }
      styleGroups.get(styleKey)!.push(c);
    }
    
    // For each style, find wheels matching front and rear specs
    const pairedCandidateSkus = new Set<string>();
    const staggeredPairs: Array<{
      styleKey: string;
      frontSku: string;
      rearSku: string;
    }> = [];
    
    for (const [styleKey, candidates] of styleGroups) {
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      // FLEXIBLE STAGGERED PAIRING WITH PLUS-SIZING
      // Support plus-sizes: 20/20, 20/22, 22/22 setups in addition to OEM 19/20
      // Group by diameter first, then find width pairs at each diameter level
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      
      // Group candidates by diameter, then by width
      const byDiameterAndWidth = new Map<number, Map<number, typeof candidates[0][]>>();
      for (const c of candidates) {
        const w = Number(c.candidate.width) || 0;
        const d = Number(c.candidate.diameter) || 0;
        
        // Allow diameters from OEM up to +4" (e.g., 19" OEM -> up to 23")
        const minDia = Math.min(frontDiameter, rearDiameter);
        const maxDia = Math.max(frontDiameter, rearDiameter) + 4;
        if (d < minDia - 1 || d > maxDia) continue;
        
        const diaKey = Math.round(d);
        const widthKey = Math.round(w * 2) / 2; // Round to nearest 0.5"
        
        if (!byDiameterAndWidth.has(diaKey)) {
          byDiameterAndWidth.set(diaKey, new Map());
        }
        const widthMap = byDiameterAndWidth.get(diaKey)!;
        if (!widthMap.has(widthKey)) widthMap.set(widthKey, []);
        widthMap.get(widthKey)!.push(c);
      }
      
      // Get available diameters for this style
      const availableDiameters = Array.from(byDiameterAndWidth.keys()).sort((a, b) => a - b);
      if (availableDiameters.length === 0) continue;
      
      // Calculate OEM width ratio for scaling
      const oemWidthRatio = rearWidth / frontWidth; // e.g., 11/8.5 = 1.29
      
      // Find pairs at each diameter level (same diameter front/rear)
      // AND pairs with front diameter <= rear diameter
      const MIN_WIDTH_DIFF = 0.5;
      
      // Try same-diameter pairs first (most common plus-size: 20/20, 22/22)
      for (const dia of availableDiameters) {
        const widthMap = byDiameterAndWidth.get(dia)!;
        const availableWidths = Array.from(widthMap.keys()).sort((a, b) => a - b);
        
        if (availableWidths.length < 2) continue;
        
        // Find front (narrower) and rear (wider) widths
        // Scale target widths based on diameter difference from OEM
        const diaScale = dia / frontDiameter; // e.g., 22/19 = 1.16
        const targetFrontWidth = frontWidth * diaScale;
        const targetRearWidth = rearWidth * diaScale;
        
        let bestFront: number | null = null;
        let bestRear: number | null = null;
        let bestScore = -Infinity;
        
        for (const fw of availableWidths) {
          for (const rw of availableWidths) {
            if (rw - fw < MIN_WIDTH_DIFF) continue;
            
            // Score: prefer widths that maintain OEM ratio
            const frontScore = 10 - Math.abs(fw - targetFrontWidth);
            const rearScore = 10 - Math.abs(rw - targetRearWidth);
            const ratioScore = 5 - Math.abs((rw / fw) - oemWidthRatio) * 3;
            const totalScore = frontScore + rearScore + ratioScore;
            
            if (totalScore > bestScore) {
              bestScore = totalScore;
              bestFront = fw;
              bestRear = rw;
            }
          }
        }
        
        if (bestFront !== null && bestRear !== null) {
          const frontCandidates = widthMap.get(bestFront) || [];
          const rearCandidates = widthMap.get(bestRear) || [];
          
          if (frontCandidates.length > 0 && rearCandidates.length > 0) {
            const bestFrontCandidate = frontCandidates[0];
            const bestRearCandidate = rearCandidates[0];
            
            pairedCandidateSkus.add(bestFrontCandidate.candidate.sku);
            pairedCandidateSkus.add(bestRearCandidate.candidate.sku);
            
            staggeredPairs.push({
              styleKey: `${styleKey}:${dia}`,
              frontSku: bestFrontCandidate.candidate.sku,
              rearSku: bestRearCandidate.candidate.sku,
            });
            
            staggeredPairsFound++;
          }
        }
      }
      
      // Also allow different-diameter pairs (e.g., 18" front / 20" rear)
      // Some show cars and custom builds use this configuration
      for (let i = 0; i < availableDiameters.length; i++) {
        for (let j = i + 1; j < availableDiameters.length; j++) {
          const frontDia = availableDiameters[i];
          const rearDia = availableDiameters[j];
          
          // Skip if difference is too large (max 2" between front/rear)
          if (rearDia - frontDia > 2) continue;
          
          const frontWidthMap = byDiameterAndWidth.get(frontDia)!;
          const rearWidthMap = byDiameterAndWidth.get(rearDia)!;
          
          const frontWidths = Array.from(frontWidthMap.keys()).sort((a, b) => a - b);
          const rearWidths = Array.from(rearWidthMap.keys()).sort((a, b) => a - b);
          
          // Find narrowest front and widest rear
          let bestFront: number | null = null;
          let bestRear: number | null = null;
          let bestScore = -Infinity;
          
          for (const fw of frontWidths) {
            for (const rw of rearWidths) {
              if (rw - fw < MIN_WIDTH_DIFF) continue;
              
              const ratioScore = 5 - Math.abs((rw / fw) - oemWidthRatio) * 3;
              const totalScore = ratioScore;
              
              if (totalScore > bestScore) {
                bestScore = totalScore;
                bestFront = fw;
                bestRear = rw;
              }
            }
          }
          
          if (bestFront !== null && bestRear !== null) {
            const frontCandidates = frontWidthMap.get(bestFront) || [];
            const rearCandidates = rearWidthMap.get(bestRear) || [];
            
            if (frontCandidates.length > 0 && rearCandidates.length > 0) {
              const bestFrontCandidate = frontCandidates[0];
              const bestRearCandidate = rearCandidates[0];
              
              // Check if this pair already exists (same SKUs)
              const existingPair = staggeredPairs.find(p => 
                p.frontSku === bestFrontCandidate.candidate.sku && 
                p.rearSku === bestRearCandidate.candidate.sku
              );
              
              if (!existingPair) {
                pairedCandidateSkus.add(bestFrontCandidate.candidate.sku);
                pairedCandidateSkus.add(bestRearCandidate.candidate.sku);
                
                staggeredPairs.push({
                  styleKey: `${styleKey}:${frontDia}/${rearDia}`,
                  frontSku: bestFrontCandidate.candidate.sku,
                  rearSku: bestRearCandidate.candidate.sku,
                });
                
                staggeredPairsFound++;
              }
            }
          }
        }
      }
    }
    
    // Store pairing info for result building
    timing.staggeredPairingMs = Date.now() - tStaggeredPairing0;
    timing.staggeredStylesChecked = styleGroups.size;
    timing.staggeredPairsFound = staggeredPairsFound;
    
    console.log(`[fitment-search] âœ… STAGGERED PAIRING complete: ${staggeredPairsFound} pairs from ${styleGroups.size} styles`);
    
    // Attach pair info to ranked candidates (so it flows into results)
    for (const pair of staggeredPairs) {
      for (const c of rankedCandidates) {
        if (c.candidate.sku === pair.frontSku) {
          (c as any).staggeredPair = {
            staggered: true,
            role: "front",
            frontSku: pair.frontSku,
            rearSku: pair.rearSku,
            styleKey: pair.styleKey,
          };
        } else if (c.candidate.sku === pair.rearSku) {
          (c as any).staggeredPair = {
            staggered: true,
            role: "rear",
            frontSku: pair.frontSku,
            rearSku: pair.rearSku,
            styleKey: pair.styleKey,
          };
        }
      }
    }
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // PHASE 5: Build paginated results from ranked candidates
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const totalCount = rankedCandidates.length;
  const startIdx = (requestedPage - 1) * requestedPageSize;
  const pageItems = rankedCandidates.slice(startIdx, startIdx + requestedPageSize);
  
  // Debug SKU tracing - after scoring/ranking
  if (debugSku) {
    const idx = rankedCandidates.findIndex(c => c.candidate.sku === debugSku);
    debugTrace.push(`5. After scoring/ranking: position=${idx >= 0 ? idx + 1 : 'NOT FOUND'} of ${rankedCandidates.length}`);
    if (idx >= 0) {
      const item = rankedCandidates[idx];
      debugTrace.push(`   - score=${item.score.toFixed(2)}, availability=${item.availabilityLabel}, priceTier=${item.priceTier}`);
    }
    const inPage = pageItems.find(c => c.candidate.sku === debugSku);
    debugTrace.push(`6. In current page (${startIdx+1}-${startIdx+requestedPageSize}): ${!!inPage}`);
  }

  // Build a lookup map for staggered pair specs (SKU â†’ wheel specs)
  // This lets us populate BOTH front and rear specs on each paired wheel
  const wheelSpecsBySku = new Map<string, { diameter: number; width: number; offset: number }>();
  for (const item of rankedCandidates) {
    const c = item.candidate;
    wheelSpecsBySku.set(c.sku, {
      diameter: Number(c.diameter) || 0,
      width: Number(c.width) || 0,
      offset: Number(c.offset) || 0,
    });
  }

  const results = pageItems.map((item) => {
    const { candidate: c, validation: v, score, scoreBreakdown, availabilityLabel, priceTier, modelKey } = item;
    const staggeredPair = (item as any).staggeredPair;
    // Get inventory from SFTP feed (synced every 2 hours)
    const inv = inventoryData.get(c.sku);
    
    const availabilityData = inv ? {
      confirmed: true,
      inventoryType: inv.inventoryType,
      totalQty: inv.totalQty,
      cachedAt: inv.cachedAt,
    } : { confirmed: false };
    
    return {
      sku: c.sku,
      skuType: "WHEEL",
      title: c.product_desc || c.sku,
      brand: c.brand_cd ? { code: c.brand_cd, description: c.brand_desc || c.brand_cd } : undefined,
      // Inventory from SFTP feed
      inventory: inv ? {
        type: inv.inventoryType || "UNKNOWN",
        localStock: inv.totalQty || 0,  // Feed only has total, not per-warehouse
        globalStock: 0,
      } : {
        type: "UNKNOWN",
        localStock: 0,
        globalStock: 0,
      },
      prices: {
        msrp: [
          {
            // Wheel-1: shipping baked in ($1/inch), MAP floor enforced.
            // WheelPros: existing safe pricing (data-quality fix for corrupt MSRPs).
            currencyAmount: String(
              c._supplier === 'wheel1'
                ? computeWheel1SellPrice({
                    msrp:       (c as Wheel1Candidate)._msrpNum,
                    mapPrice:   (c as Wheel1Candidate)._mapNum,
                    dealerCost: (c as Wheel1Candidate)._dealerCost ?? null,
                    diameter:   Number(c.diameter) || 20,
                  })
                : c._supplier === 'wsi'
                ? computeWSISellPrice({
                    dealerCost:   (c as WSICandidate)._dealerCost,
                    catalogPrice: (c as WSICandidate)._catalogPrice,
                  })
                : getSafeWheelPrice(c, inv)
            ),
            currencyCode: "USD",
          },
        ],
      },
      images: (c.images || []).map((u: string) => ({
        imageUrlLarge: u,
        imageUrlMedium: u,
        imageUrlSmall: u,
        imageUrlThumbnail: u,
      })),
      properties: {
        brand_cd: c.brand_cd,
        brand_desc: c.brand_desc,
        // Use normalized finish for filtering/display, keep raw for reference
        abbreviated_finish_desc: normalizeFinish(c.fancy_finish_desc, c.abbreviated_finish_desc),
        fancy_finish_desc: c.fancy_finish_desc,
        diameter: c.diameter,
        width: c.width,
        offset: c.offset,
        centerbore: c.centerbore,
        boltPatternMetric: c.bolt_pattern_metric,
        boltPattern: c.bolt_pattern_standard,
      },
      fitmentValidation: {
        fitmentClass: v.fitmentClass,
        fitmentMode: v.fitmentMode,
        ...(debug
          ? {
              boltPatternPass: v.boltPatternPass,
              centerBorePass: v.centerBorePass,
              diameterPass: v.diameterPass,
              widthPass: v.widthPass,
              offsetPass: v.offsetPass,
              exclusionReasons: v.exclusionReasons,
            }
          : {}),
      },
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      // FITMENT GUIDANCE (2026-04-07)
      // Provides user-friendly labels without hiding/blocking results
      // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
      fitmentGuidance: (() => {
        const wheelDia = Number(c.diameter) || 0;
        const wheelWidth = Number(c.width) || 0;
        const wheelOffset = Number(c.offset) || 0;
        
        if (wheelDia > 0 && wheelWidth > 0) {
          const guidance = calculateFitmentGuidance(
            { diameter: wheelDia, width: wheelWidth, offset: wheelOffset },
            {
              minDiameter: envelope.oemMinDiameter,
              maxDiameter: envelope.oemMaxDiameter,
              minWidth: envelope.oemMinWidth,
              maxWidth: envelope.oemMaxWidth,
              minOffset: envelope.oemMinOffset,
              maxOffset: envelope.oemMaxOffset,
              vehicleType: opts.vehicleType,
            }
          );
          return {
            level: guidance.level,
            levelLabel: guidance.levelLabel,
            buildRequirement: guidance.buildRequirement,
            buildLabel: guidance.buildLabel,
            ...(debug ? { reasoning: guidance.reasoning } : {}),
          };
        }
        return null;
      })(),
      // Availability with label
      availability: {
        ...availabilityData,
        label: availabilityLabel,
        mode: "catalog",
        minQty,
      },
      // NEW: Ranking score
      ranking: {
        score: Math.round(score * 10) / 10, // Round to 1 decimal
        priceTier,
        modelKey: debug ? modelKey : undefined,
        breakdown: debug ? scoreBreakdown : undefined,
      },
      // Staggered pair info (for staggered fitments)
      // Look up BOTH front and rear specs from the SKU lookup map
      // VALIDATE: front should be narrower/smaller diameter than rear
      pair: staggeredPair ? (() => {
        let frontSpecs = wheelSpecsBySku.get(staggeredPair.frontSku);
        let rearSpecs = wheelSpecsBySku.get(staggeredPair.rearSku);
        let frontSku = staggeredPair.frontSku;
        let rearSku = staggeredPair.rearSku;
        
        // Swap if front is wider or has larger diameter than rear
        if (frontSpecs && rearSpecs) {
          const shouldSwap = 
            (frontSpecs.diameter > rearSpecs.diameter) || // Front has larger diameter
            (frontSpecs.diameter === rearSpecs.diameter && frontSpecs.width > rearSpecs.width); // Same dia but front wider
          
          if (shouldSwap) {
            [frontSpecs, rearSpecs] = [rearSpecs, frontSpecs];
            [frontSku, rearSku] = [rearSku, frontSku];
          }
        }
        
        return {
          staggered: true,
          front: {
            sku: frontSku,
            diameter: frontSpecs?.diameter,
            width: frontSpecs?.width,
            offset: frontSpecs?.offset,
          },
          rear: {
            sku: rearSku,
            diameter: rearSpecs?.diameter,
            width: rearSpecs?.width,
            offset: rearSpecs?.offset,
          },
        };
      })() : undefined,
      // â”€â”€â”€ Supplier tag (Wheel-1 preview) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      ...(c._supplier === 'wheel1' ? {
        supplier: 'wheel1',
        freeShipping: true,   // shipping baked into price; display on SRP card
        w1Details: (c as Wheel1Candidate)._w1,
      } : c._supplier === 'wsi' ? {
        supplier: 'wsi',
        freeShipping: false,
      } : {
        supplier: 'wheelpros',
        freeShipping: false,
      }),
    };
  });

  // Build facets from ALL ranked items (not just page)
  const facets = buildFacets(rankedCandidates.map((e) => ({
    ...e.candidate,
    properties: {
      brand_cd: e.candidate.brand_cd,
      brand_desc: e.candidate.brand_desc,
      // Use normalized finish for facets
      abbreviated_finish_desc: normalizeFinish(e.candidate.fancy_finish_desc, e.candidate.abbreviated_finish_desc),
      diameter: e.candidate.diameter,
      width: e.candidate.width,
      offset: e.candidate.offset,
      boltPatternMetric: e.candidate.bolt_pattern_metric,
      boltPattern: e.candidate.bolt_pattern_standard,
    },
  })));
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ADD FITMENT CATEGORIES TO SIZE FACETS (April 2026)
  // Categorize sizes as "recommended" (within safe envelope) or "extended"
  // This allows UI to show extended sizes in a separate section
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  // Calculate safe/recommended range for trucks vs cars
  const isTruckOrSuv = opts.vehicleType === "truck" || opts.vehicleType === "suv" ||
    envelope.boltPattern.startsWith("6x") || envelope.boltPattern.startsWith("8x");
  
  // Recommended diameter range (matches safety floor/ceiling logic)
  const recommendedMinDia = isTruckOrSuv 
    ? Math.max(17, envelope.oemMinDiameter - 3)
    : Math.max(15, envelope.oemMinDiameter - 2);
  const recommendedMaxDia = Math.min(28, envelope.oemMaxDiameter + 6);
  
  // Recommended width range
  const recommendedMinWidth = envelope.oemMinWidth - 1;
  const recommendedMaxWidth = envelope.oemMaxWidth + 3;
  
  if (facets.wheel_diameter?.buckets) {
    // Categorize each diameter bucket
    const categorized = facets.wheel_diameter.buckets.map((bucket: { value: string; count: number }) => {
      const diaNum = parseFloat(bucket.value);
      const isOem = !isNaN(diaNum) && diaNum >= envelope.oemMinDiameter && diaNum <= envelope.oemMaxDiameter;
      const isRecommended = !isNaN(diaNum) && diaNum >= recommendedMinDia && diaNum <= recommendedMaxDia;
      
      return {
        ...bucket,
        isOem,
        // "recommended" = within safe envelope, "extended" = outside but still compatible
        fitmentCategory: isRecommended ? "recommended" : "extended",
        label: isOem ? `${bucket.value}" â˜…` : `${bucket.value}"`,
      };
    });
    
    // Sort: recommended sizes first (by diameter), then extended sizes (by diameter)
    const recommended = categorized.filter((b: any) => b.fitmentCategory === "recommended")
      .sort((a: any, b: any) => parseFloat(a.value) - parseFloat(b.value));
    const extended = categorized.filter((b: any) => b.fitmentCategory === "extended")
      .sort((a: any, b: any) => parseFloat(a.value) - parseFloat(b.value));
    
    facets.wheel_diameter.buckets = [...recommended, ...extended];
    
    // Add metadata for UI to render section headers
    (facets.wheel_diameter as any).sections = {
      recommended: {
        label: "Recommended Fitment",
        count: recommended.length,
        totalResults: recommended.reduce((sum: number, b: any) => sum + b.count, 0),
      },
      extended: extended.length > 0 ? {
        label: "Extended Fitment",
        description: "Compatible sizes beyond factory specs",
        count: extended.length,
        totalResults: extended.reduce((sum: number, b: any) => sum + b.count, 0),
      } : null,
    };
  }
  
  // Also enhance width facet with categories
  if (facets.width?.buckets) {
    const categorized = facets.width.buckets.map((bucket: { value: string; count: number }) => {
      const widNum = parseFloat(bucket.value);
      const isOem = !isNaN(widNum) && widNum >= envelope.oemMinWidth && widNum <= envelope.oemMaxWidth;
      const isRecommended = !isNaN(widNum) && widNum >= recommendedMinWidth && widNum <= recommendedMaxWidth;
      
      return {
        ...bucket,
        isOem,
        fitmentCategory: isRecommended ? "recommended" : "extended",
      };
    });
    
    const recommended = categorized.filter((b: any) => b.fitmentCategory === "recommended")
      .sort((a: any, b: any) => parseFloat(a.value) - parseFloat(b.value));
    const extended = categorized.filter((b: any) => b.fitmentCategory === "extended")
      .sort((a: any, b: any) => parseFloat(a.value) - parseFloat(b.value));
    
    facets.width.buckets = [...recommended, ...extended];
    (facets.width as any).sections = {
      recommended: { label: "Recommended", count: recommended.length },
      extended: extended.length > 0 ? { label: "Extended Fitment", count: extended.length } : null,
    };
  }
  
  // Calculate ranking statistics for response
  const top20 = rankedCandidates.slice(0, 20);
  const top100 = rankedCandidates.slice(0, 100);
  
  const rankingStats = {
    // Availability distribution (all results)
    availabilityDistribution: {
      in_stock: rankedCandidates.filter(c => c.availabilityLabel === "in_stock").length,
      limited: rankedCandidates.filter(c => c.availabilityLabel === "limited").length,
      check_availability: rankedCandidates.filter(c => c.availabilityLabel === "check_availability").length,
    },
    // Top 20 stats
    top20: {
      availabilityDistribution: {
        in_stock: top20.filter(c => c.availabilityLabel === "in_stock").length,
        limited: top20.filter(c => c.availabilityLabel === "limited").length,
        check_availability: top20.filter(c => c.availabilityLabel === "check_availability").length,
      },
      priceTierDistribution: {
        value: top20.filter(c => c.priceTier === "value").length,
        mid: top20.filter(c => c.priceTier === "mid").length,
        premium: top20.filter(c => c.priceTier === "premium").length,
      },
      brandDistribution: (() => {
        const counts = new Map<string, number>();
        for (const c of top20) {
          const brand = c.candidate.brand_cd || "UNKNOWN";
          counts.set(brand, (counts.get(brand) || 0) + 1);
        }
        return Array.from(counts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([brand, count]) => ({ brand, count }));
      })(),
      uniqueModels: new Set(top20.map(c => c.modelKey)).size,
      duplicateModels: (() => {
        const modelCounts = new Map<string, number>();
        for (const c of top20) {
          modelCounts.set(c.modelKey, (modelCounts.get(c.modelKey) || 0) + 1);
        }
        return Array.from(modelCounts.entries())
          .filter(([, count]) => count > 1)
          .map(([model, count]) => ({ model, count }));
      })(),
    },
    // Brand distribution in top 100
    top100BrandDistribution: (() => {
      const brandCounts = new Map<string, number>();
      for (const c of top100) {
        const brand = c.candidate.brand_cd || "UNKNOWN";
        brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);
      }
      return Array.from(brandCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([brand, count]) => ({ brand, count, pct: Math.round(count / Math.max(1, top100.length) * 100) }));
    })(),
    // Score range
    scoreRange: {
      min: Math.round((rankedCandidates[rankedCandidates.length - 1]?.score || 0) * 10) / 10,
      max: Math.round((rankedCandidates[0]?.score || 0) * 10) / 10,
      median: Math.round((rankedCandidates[Math.floor(rankedCandidates.length / 2)]?.score || 0) * 10) / 10,
    },
  };

  // Build confidence UI metadata for response
  const confidenceUIMeta = opts.confidenceResult 
    ? getConfidenceUIMetadata(opts.confidenceResult.confidence)
    : null;

  return NextResponse.json({
    results,
    totalCount,
    page: requestedPage,
    pageSize: requestedPageSize,
    facets,
    fitment: {
      mode: opts.mode,
      modeAutoDetected: opts.modeAutoDetected,
      vehicleType: opts.vehicleType,
      resolutionPath: opts.resolutionPath,
      fitmentSource: opts.fitmentSource,
      aliasUsed: Boolean(opts.aliasUsed),
      canonicalModificationId: opts.canonicalModificationId || null,
      requestedModificationId: opts.requestedModificationId || null,
      validationMode: "strict",
      // NEW: Availability mode for DB-first architecture
      availabilityMode: "catalog", // Search uses DB only, no live calls
      // Classic vehicle detection - classic_fitments is source of truth for classics
      isClassicVehicle: Boolean(opts.isClassicVehicle),
      classicFitmentUsed: Boolean(opts.classicFitmentUsed),
      // HD truck SRW/DRW configuration
      rearWheelConfig: opts.rearWheelConfig || null,
      isDRWCapable: Boolean(opts.isDRWCapable),
      // Staggered fitment detection
      staggered: opts.staggeredInfo || null,
      // Confidence information (SAFETY-FIRST)
      confidence: opts.confidenceResult?.confidence || "high",
      confidenceReasons: opts.confidenceResult?.reasons || [],
      confidenceUI: confidenceUIMeta ? {
        label: confidenceUIMeta.label,
        colorToken: confidenceUIMeta.colorToken,
        icon: confidenceUIMeta.icon,
        warningMessage: confidenceUIMeta.warningMessage,
      } : null,
      // Fallback confidence (2026-04-26)
      // Indicates reliability of trim-to-trim fallback
      fallbackConfidence: opts.fallbackConfidence || "exact_certified",
      fallbackWarnings: opts.fallbackWarnings || [],
      // Show guaranteed fit badge only for exact_certified or equivalent_certified
      showGuaranteedFit: opts.fallbackConfidence === "exact_certified" || 
                         opts.fallbackConfidence === "equivalent_certified" ||
                         !opts.fallbackConfidence,
      envelope: {
        boltPattern: envelope.boltPattern,
        centerBore: envelope.centerBore,
        oem: {
          diameter: [envelope.oemMinDiameter, envelope.oemMaxDiameter],
          width: [envelope.oemMinWidth, envelope.oemMaxWidth],
          offset: [envelope.oemMinOffset, envelope.oemMaxOffset],
        },
        allowed: {
          diameter: [envelope.allowedMinDiameter, envelope.allowedMaxDiameter],
          width: [envelope.allowedMinWidth, envelope.allowedMaxWidth],
          offset: [envelope.allowedMinOffset, envelope.allowedMaxOffset],
        },
        // Recommended fitment summary for UI display (human-readable)
        recommended: {
          diameter: `${recommendedMinDia}" to ${recommendedMaxDia}"`,
          width: `${recommendedMinWidth}" to ${recommendedMaxWidth}"`,
          offset: `${envelope.allowedMinOffset}mm to ${envelope.allowedMaxOffset}mm`,
          boltPattern: envelope.boltPattern,
        },
      },
      userOffsetFilter: hasUserOffsetFilter ? {
        min: userOffsetMin,
        max: userOffsetMax,
        active: true,
      } : null,
      vehicle: {
        year: Number(opts.year),
        make: opts.make,
        model: opts.model,
        trim: opts.displayTrim,
      },
      dbProfile: opts.dbProfileForResponse || null,
    },
    summary: {
      total: results.length,
      totalCountEligible: totalCount,
      candidates: filteredCandidates.length,
      fitmentValid: fitmentValidCandidates.length,
      staggeredPairsFound,
      // SFTP-FIRST: Inventory from feed, no live API calls
      availabilityMode: "sftp-feed",
      availabilityCachedHits: inventoryData.size,
      resolutionPath: opts.resolutionPath,
      fitmentSource: opts.fitmentSource,
      aliasUsed: Boolean(opts.aliasUsed),
      validationMode: "strict",
      dbIndexBuiltAt: getTechfeedIndexBuiltAt(),
    },
    // NEW: Ranking statistics
    ranking: rankingStats,
    timing: {
      totalMs: Date.now() - t0,
      ...timing,
    },
    // DB-FIRST architecture flag
    dbFirstMode: true,
    dealerlineMode: false,
    // Package prioritization flag
    packagePriorityApplied,
    // Sort applied flag (helps debug if sorting is working)
    sortApplied: isPriceSorted ? sortParam : 'default',
    // Debug SKU trace (only when debugSku param is provided)
    ...(debugSku && debugTrace.length > 0 ? { debugSkuTrace: { sku: debugSku, trace: debugTrace } } : {}),
  });
}

// ============================================================================
// NOTE: Live availability checks removed from search (DB-first architecture)
// Live availability is now handled at cart/checkout via:
// POST /api/cart/validate-availability
// ============================================================================

// ============================================================================
// Legacy Fallback Path Handler
// ============================================================================

async function handleLegacyPath(
  url: URL,
  year: string,
  make: string,
  model: string,
  modificationId: string | undefined,
  displayTrimParam: string | undefined,  // Original trim param for display (e.g., "Base")
  modeParam: string | null,
  debug: boolean,
  t0: number
): Promise<NextResponse> {
  const db = getPool();
  await ensureFitmentTables(db);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // 2026-06-13: UNIVERSAL FITMENT RESOLVER (Single Source of Truth)
  // All model normalization, aliases, and DB lookups are now encapsulated
  // in resolveUniversalFitment(). No more direct getModelVariants/buildFitmentProfile calls.
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  console.log(`[fitment-search] â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•`);
  console.log(`[fitment-search] LEGACY PATH - Using resolveUniversalFitment`);
  console.log(`[fitment-search] RAW INPUT: year=${year} make=${make} model=${model} trim=${displayTrimParam || "(none)"}`);
  
  const universalResult = await resolveUniversalFitment({
    year: Number(year),
    make,
    model,
    trim: displayTrimParam || modificationId || null,
  });
  
  // Debug logging (temporary - for migration verification)
  console.log(`[fitment-search] NORMALIZED: make="${universalResult.normalized.make}" model="${universalResult.normalized.model}"`);
  console.log(`[fitment-search] VARIANTS TRIED: [${universalResult.normalized.modelVariantsTried.join(", ")}]`);
  console.log(`[fitment-search] MATCHED VARIANT: "${universalResult.normalized.matchedVariant || "(none)"}"`);
  console.log(`[fitment-search] DB MODEL: "${universalResult.model}" | TRIM: "${universalResult.trim || "(auto)"}"`);
  console.log(`[fitment-search] SOURCE: ${universalResult.source} | CONFIDENCE: ${universalResult.confidence} | QUALITY: ${universalResult.qualityTier}`);
  console.log(`[fitment-search] BOLT PATTERN: ${universalResult.boltPattern} | CENTER BORE: ${universalResult.centerBore}mm`);
  console.log(`[fitment-search] WHEEL RANGE: ${universalResult.wheelDiameterRange ? `${universalResult.wheelDiameterRange.min}"-${universalResult.wheelDiameterRange.max}"` : "(none)"}`);
  console.log(`[fitment-search] OFFSET RANGE: ${universalResult.offsetRange ? `${universalResult.offsetRange.min}mm-${universalResult.offsetRange.max}mm` : "(none)"}`);
  console.log(`[fitment-search] â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•`);
  
  // Track display trim and auto-selection
  let displayTrim = universalResult.trim || displayTrimParam || modificationId || null;
  const autoSelectedTrim = !displayTrimParam && !modificationId && universalResult.trim !== null;
  const lookupKey = universalResult.modificationId || modificationId;
  
  if (autoSelectedTrim) {
    console.log(`[fitment-search] AUTO-SELECTED trim: ${displayTrim} (${universalResult.modificationId}) from ${universalResult.availableTrims.length} available`);
  }
  
  // Build LEGACY profile format from UniversalFitmentResult
  // (This format has different properties than DBFitmentProfile)
  const wheelSpecs = universalResult.oemWheelSizes.map((ws, idx) => ({
    rimDiameter: ws.diameter,
    rimWidth: ws.width,
    offset: ws.offset ?? null,
    tireSize: universalResult.oemTireSizes[idx] || null,
    axle: ws.axle || "both",
    isStock: true,
  }));
  
  const diameters = [...new Set(wheelSpecs.map(ws => ws.rimDiameter))].filter(d => d > 0);
  const widths = [...new Set(wheelSpecs.map(ws => ws.rimWidth))].filter(w => w > 0);
  const offsets = wheelSpecs.map(ws => ws.offset).filter((o): o is number => o !== null);
  
  // Compute allowed ranges from OEM wheel specs
  const allowedDiameters = diameters.length > 0 ? diameters : 
    (universalResult.wheelDiameterRange ? 
      Array.from({ length: universalResult.wheelDiameterRange.max - universalResult.wheelDiameterRange.min + 1 }, 
        (_, i) => universalResult.wheelDiameterRange!.min + i) : 
      [17, 18, 19, 20]); // Default if no data
  
  const allowedWidths = widths.length > 0 ? widths :
    (universalResult.wheelWidthRange ?
      Array.from({ length: Math.floor((universalResult.wheelWidthRange.max - universalResult.wheelWidthRange.min) * 2) + 1 },
        (_, i) => universalResult.wheelWidthRange!.min + i * 0.5) :
      [7, 7.5, 8, 8.5, 9]); // Default if no data
  
  const allowedOffsets = offsets.length > 0 ? offsets :
    (universalResult.offsetRange ?
      Array.from({ length: universalResult.offsetRange.max - universalResult.offsetRange.min + 1 },
        (_, i) => universalResult.offsetRange!.min + i) :
      [30, 35, 40, 45]); // Default if no data
  
  // Parse bolt pattern to get PCD and stud holes
  let pcd: number | null = null;
  let studHoles: number | null = null;
  if (universalResult.boltPattern) {
    const bpMatch = universalResult.boltPattern.match(/^(\d+)x(\d+(?:\.\d+)?)/);
    if (bpMatch) {
      studHoles = parseInt(bpMatch[1], 10);
      pcd = parseFloat(bpMatch[2]);
    }
  }
  
  // Build legacy profile object
  const profile = {
    boltPattern: universalResult.boltPattern,
    centerBore: universalResult.centerBore,
    wheelSpecs,
    allowedDiameters,
    allowedWidths,
    allowedOffsets,
    displayTrim: displayTrim || "Base",  // For DBFitmentProfile compatibility
    vehicle: {
      year: universalResult.year,
      make: universalResult.make,
      model: universalResult.model,
      trim: displayTrim,
      slug: universalResult.modificationId || `${universalResult.year}-${universalResult.make}-${universalResult.model}`.toLowerCase().replace(/\s+/g, "-"),
    },
    fitment: {
      pcd,
      studHoles,
      threadSize: universalResult.threadSize,
      seatType: universalResult.lugSeatType,
    },
    tireSizes: universalResult.oemTireSizes,
    qualityTier: universalResult.qualityTier,
    source: universalResult.source,
  };
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // DB-FIRST: No external API fallback. If profile not in DB, return user-friendly error.
  // Wheel-Size API is BLOCKED in this path. Use admin/fitment for manual import.
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  if (!profile) {
    console.log(`[fitment-search] DB-FIRST: No profile for ${year} ${make} ${model} lookupKey=${lookupKey || "(none)"} - NOT calling external API`);
    
    // Log unresolved fitment search for gap tracking and prioritization
    logUnresolvedFitment({
      year,
      make,
      model,
      trim: displayTrim || undefined,
      searchType: "wheel",
      source: "api",
      path: `/wheels?year=${year}&make=${make}&model=${model}`,
      modificationId: lookupKey,
      resolutionAttempts: ["legacyFallback"],
    }).catch(() => {}); // Fire and forget
    
    // Return a user-friendly response with clear flags
    return NextResponse.json({
      results: [],
      totalCount: 0,
      profileNotFound: true,
      blocked: true, // Also set blocked so page shows FitmentUnavailable
      blockReason: "We don't have verified fitment data for this vehicle yet.",
      vehicle: { year: Number(year), make, model, trim: displayTrim },
      resolutionPath: "invalid",
      dbFirst: true,
      suggestions: [
        "Contact us for assistance with your specific vehicle",
        "Check back soon as we're constantly adding new vehicles",
        "Try a similar model year if available",
      ],
      timing: {
        totalMs: Date.now() - t0,
      },
    });
  }

  const profileMs = Date.now() - t0;
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // QUALITY TIER - Already included in profile from resolveUniversalFitment
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  console.log(`[fitment-search] Using qualityTier="${profile.qualityTier}" from universalFitmentResolver`);
  
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // NOTE: Fitment rules override is now applied INSIDE resolveUniversalFitment
  // via applyOverrides(). This section is kept for backward compatibility but
  // should not trigger since the resolver already handles these cases.
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const ruleOverride = getFitmentFromRules({
    year: Number(year),
    make,
    model,
    rawModel: model,
    trim: displayTrim || profile.displayTrim || undefined,
    modificationId: lookupKey,
  });
  
  if (ruleOverride && ruleOverride.boltPattern && ruleOverride.boltPattern !== profile.boltPattern) {
    console.log(`[fitment-search] ðŸ”§ REDUNDANT RULE OVERRIDE (resolver should have handled this): ${year} ${make} ${model}`);
    console.log(`  Bolt pattern: ${profile.boltPattern} â†’ ${ruleOverride.boltPattern}`);
    console.log(`  Reason: ${ruleOverride.notes || "Fitment rule match"}`);
    
    // Override the bolt pattern in the profile (should be redundant)
    profile.boltPattern = ruleOverride.boltPattern;
    
    // Also override center bore if provided
    if (ruleOverride.centerBoreMm !== undefined) {
      profile.centerBore = ruleOverride.centerBoreMm;
    }
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // SAFETY CHECK: Calculate confidence on profile
  // Use universalResult.confidence which is already calculated
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  
  const legacyConfidenceInput = {
    boltPattern: profile.boltPattern,
    centerBoreMm: profile.centerBore,
    oemWheelSizes: profile.wheelSpecs.map((ws: any) => ({
      diameter: ws.rimDiameter,
      width: ws.rimWidth,
      offset: ws.offset,
    })),
  };
  
  const confidenceResult = calculateConfidence(legacyConfidenceInput);
  console.log(`[fitment-search] LEGACY CONFIDENCE:`, formatConfidenceForLog(confidenceResult));
  
  // Block if confidence too low (same as main path)
  if (!confidenceResult.canShowWheels) {
    const uiMeta = getConfidenceUIMetadata(confidenceResult.confidence);
    
    console.warn(`[fitment-search] LEGACY BLOCKED (${confidenceResult.confidence}): ${year} ${make} ${model} - insufficient fitment data`);
    
    return NextResponse.json({
      results: [],
      totalCount: 0,
      blocked: true,
      blockReason: "Cannot safely show wheel results without verified fitment data",
      fitment: {
        ...buildConfidenceResponse(confidenceResult),
        vehicle: {
          year: Number(year),
          make,
          model,
          trim: profile.vehicle.trim || displayTrim || null,
        },
        resolutionPath: "legacyFallback",
        profileFound: true,
      },
      suggestions: [
        "Try a different trim level if available",
        "Contact us at (248) 332-4120 for manual fitment lookup",
        "Check your owner's manual for wheel specifications",
      ],
      timing: {
        totalMs: Date.now() - t0,
        profileMs,
      },
    });
  }

  // Determine fitment mode
  let mode: FitmentMode;
  let modeAutoDetected = false;
  let vehicleType: "truck" | "suv" | "car" | undefined;

  if (modeParam && modeParam !== "auto") {
    mode = modeParam as FitmentMode;
  } else {
    const autoResult = autoDetectFitmentMode(model!, {
      boltPattern: profile.boltPattern || undefined,  // Convert null to undefined
      minDiameter: profile.allowedDiameters.length > 0 ? Math.min(...profile.allowedDiameters) : undefined,
      maxWidth: profile.allowedWidths.length > 0 ? Math.max(...profile.allowedWidths) : undefined,
    });
    mode = autoResult.recommendedMode;
    vehicleType = autoResult.vehicleType;
    modeAutoDetected = true;
  }

  // Build aftermarket fitment envelope
  // Note: centerBore is required by OEMSpecs - use a safe default if missing
  const oemSpecs: OEMSpecs = {
    boltPattern: profile.boltPattern || "",
    // 2026-06-30: null centerbore must NOT become 72.6 fallback — fail closed instead.
    // The centerbore null check below will intercept missing-bore vehicles before this.
    centerBore: profile.centerBore || 0,  // 0 will trigger the missing-bore check
    studHoles: profile.fitment.studHoles || undefined,
    pcd: profile.fitment.pcd || undefined,
    wheelSpecs: profile.wheelSpecs.map((ws: any) => ({
      rimDiameter: Number(ws.rimDiameter),
      rimWidth: Number(ws.rimWidth),
      offset: ws.offset,
    })),
  };

  const envelope = buildFitmentEnvelope(oemSpecs, mode);

  // IMPORTANT: legacyFallback is allowed ONLY to derive a fitment envelope.
  // Wheel results must come from DB-first candidates + cached live availability.
  const requestedModificationId = url.searchParams.get("modification") || url.searchParams.get("trim") || null;

  // Detect staggered fitment from legacy profile's wheelSpecs
  const legacyParsedWheelSizes: ParsedWheelSize[] = profile.wheelSpecs.map((ws: any) => ({
    diameter: Number(ws.rimDiameter),
    width: Number(ws.rimWidth),
    offset: ws.offset ?? null,
    tireSize: ws.tireSize || null,
    axle: ws.axle || "both",
    isStock: ws.isStock !== false,
  }));
  const legacyStaggeredInfo = detectStaggeredFromParsed(legacyParsedWheelSizes);
  if (legacyStaggeredInfo.isStaggered) {
    console.log(`[fitment-search] LEGACY STAGGERED FITMENT detected: ${legacyStaggeredInfo.reason}`);
  }

  // Build dbProfile-compatible response from legacy profile
  // NOTE: With universalFitmentResolver, threadSize/seatType ARE now available
  const legacyDbProfile = {
    modificationId: profile.vehicle.slug || requestedModificationId || "",
    displayTrim: profile.vehicle.trim || "",
    boltPattern: profile.boltPattern,  // Can be null per the type
    centerBoreMm: profile.centerBore,  // Can be null per the type
    threadSize: profile.fitment?.threadSize || null,
    seatType: profile.fitment?.seatType || null,
    offsetRange: {
      min: profile.allowedOffsets.length > 0 ? Math.min(...profile.allowedOffsets) : null,
      max: profile.allowedOffsets.length > 0 ? Math.max(...profile.allowedOffsets) : null,
    },
    oemWheelSizes: profile.wheelSpecs.map((ws: any) => ({
      diameter: ws.rimDiameter,
      width: ws.rimWidth,
      offset: ws.offset,
    })),
    oemTireSizes: profile.tireSizes || [],
    source: "universal" as string,  // Updated source to reflect new resolver
  };

  // ========================================================================
  // LEGACY PATH: STAGGERED-CAPABLE UNKNOWN AXLE CHECK
  // Same rule as main path — must have confirmed square OR staggered+axle data.
  // ========================================================================
  if (isStaggeredCapableVehicle(make, model) && !legacyStaggeredInfo.isStaggered) {
    const reason = legacyStaggeredInfo.reason ?? "";
    if (!isConfirmedSquareSetup(reason)) {
      console.warn(`[fitment-search] LEGACY UNKNOWN AXLE: ${year} ${make} ${model} reason="${reason}"`);
      logUnresolvedFitment({
        year, make, model, searchType: "wheel", source: "api",
        path: url.pathname + url.search,
        resolutionAttempts: ["legacyFallback_unknown_axle"],
      }).catch(() => {});
      return NextResponse.json({
        results: [], totalCount: 0,
        fitment: {
          unknownAxleConfiguration: true,
          message: "Per-axle fitment data required for this staggered-capable vehicle.",
          vehicle: { year: Number(year), make, model },
          resolutionPath: "legacyFallback",
        },
        timing: { totalMs: Date.now() - t0 },
      });
    }
  }

  // ========================================================================
  // LEGACY PATH: CENTERBORE NULL CHECK + GEOMETRY INJECTION (2026-06-30)
  // Both must be resolved before proceeding to wheel search.
  // ========================================================================
  if (!profile.centerBore || Number(profile.centerBore) <= 0) {
    console.warn(`[fitment-search] LEGACY MISSING CENTER BORE: ${year} ${make} ${model}`);
    logUnresolvedFitment({
      year, make, model, searchType: "wheel", source: "api",
      path: url.pathname + url.search,
      resolutionAttempts: ["legacyFallback_missing_center_bore"],
    }).catch(() => {});
    return NextResponse.json({
      results: [], totalCount: 0,
      fitment: {
        missingCenterBore: true,
        message: "Wheel recommendations require verified hub bore data for this vehicle.",
        vehicle: { year: Number(year), make, model },
        resolutionPath: "legacyFallback",
      },
      timing: { totalMs: Date.now() - t0 },
    });
  }

  // Resolve OEM offset for legacy path geometry
  const legacyGeoVehicleClass: VehicleClass =
    vehicleType === "truck" ? "truck" :
    vehicleType === "suv"   ? "suv"   :
    (profile.boltPattern?.startsWith("6x") || profile.boltPattern?.startsWith("8x")) ? "truck" :
    "car";
  const legacyGeoProfile = mapModeToProfile(mode);
  const legacyOemWheelSizes = profile.wheelSpecs.map((ws: any) => ({
    diameter: Number(ws.rimDiameter), width: Number(ws.rimWidth),
    offset: ws.offset ?? null, axle: ws.axle || "both",
  }));
  const legacyOemOffsetResult = resolveOemOffset({
    offsetMinMm: universalResult.offsetRange?.min ?? null,
    offsetMaxMm: universalResult.offsetRange?.max ?? null,
    oemWheelSizes: legacyOemWheelSizes,
  });
  if (legacyOemOffsetResult.missing) {
    console.warn(`[fitment-search] LEGACY MISSING OEM OFFSET: ${year} ${make} ${model}`);
    logUnresolvedFitment({
      year, make, model, searchType: "wheel", source: "api",
      path: url.pathname + url.search,
      resolutionAttempts: ["legacyFallback_missing_oem_offset"],
    }).catch(() => {});
    return NextResponse.json({
      results: [], totalCount: 0,
      fitment: {
        missingOemOffset: true,
        message: "Wheel recommendations require verified OEM offset data for this vehicle.",
        vehicle: { year: Number(year), make, model },
        resolutionPath: "legacyFallback",
      },
      timing: { totalMs: Date.now() - t0 },
    });
  }
  const legacyIsKnownStaggered = legacyStaggeredInfo.isStaggered && isStaggeredCapableVehicle(make, model);
  const legacyFrontOem: OemOffsetResult = legacyIsKnownStaggered && legacyStaggeredInfo.frontSpec
    ? resolveOemOffset({ offsetMinMm: universalResult.offsetRange?.min ?? null, offsetMaxMm: universalResult.offsetRange?.max ?? null, oemWheelSizes: legacyOemWheelSizes, axle: "front", requireAxleSpecific: true })
    : legacyOemOffsetResult;
  const legacyRearOem: OemOffsetResult = legacyIsKnownStaggered && legacyStaggeredInfo.rearSpec
    ? resolveOemOffset({ offsetMinMm: universalResult.offsetRange?.min ?? null, offsetMaxMm: universalResult.offsetRange?.max ?? null, oemWheelSizes: legacyOemWheelSizes, axle: "rear", requireAxleSpecific: true })
    : legacyOemOffsetResult;

  return await handleDbFirstWheelResults({
    url,
    year,
    make,
    model,
    displayTrim: profile.vehicle.trim || "",
    boltPattern: profile.boltPattern || "",  // Ensure string, not null
    envelope,
    mode,
    modeAutoDetected,
    vehicleType,
    resolutionPath: "legacyFallback",
    fitmentSource: "dbFirst",
    requestedModificationId,
    debug,
    t0,
    confidenceResult,
    staggeredInfo: legacyStaggeredInfo,
    dbProfileForResponse: legacyDbProfile,
    // Geometry validation (unified with main path)
    oemOffsetResult: legacyOemOffsetResult,
    frontOemOffsetResult: legacyFrontOem,
    rearOemOffsetResult: legacyRearOem,
    geoVehicleClass: legacyGeoVehicleClass,
    geoProfile: legacyGeoProfile,
  });
}

// ============================================================================
// Facet Builder
// ============================================================================

function buildFacets(wheels: any[]) {
  const brands = new Map<string, { code: string; desc: string; count: number }>();
  const styles = new Map<string, number>(); // Model/style names (e.g., "BURN", "CATALYST")
  const finishes = new Map<string, number>();
  const diameters = new Map<string, number>();
  const widths = new Map<string, number>();
  const offsets = new Map<string, number>();
  const boltPatterns = new Map<string, number>();

  const normalizeBp = (bp: string) => String(bp || "").toLowerCase().replace(/[xÃ—-]/g, "x").trim();
  const parseBps = (bp: string) => {
    const raw = String(bp || "").trim();
    if (!raw) return [] as string[];
    const parts = raw.split(/[\/,]/).map((p) => normalizeBp(p.trim())).filter(Boolean);
    return parts.length > 0 ? parts : [normalizeBp(raw)];
  };

  for (const w of wheels) {
    // Brand
    const brandCd = w.properties?.brand_cd;
    const brandDesc = w.properties?.brand_desc || brandCd;
    if (brandCd) {
      const existing = brands.get(brandCd);
      if (existing) existing.count++;
      else brands.set(brandCd, { code: brandCd, desc: brandDesc, count: 1 });
    }

    // Style/Model name (e.g., "BURN", "CATALYST", "FLAME")
    // Try multiple sources: model property, style property, or extract from title
    let styleName = w.properties?.model || w.style;
    if (!styleName && w.title) {
      // Extract model name from title: everything before the first size pattern (e.g., "20X10")
      const sizeMatch = String(w.title).match(/^(.+?)\s+\d+[Xx]\d/);
      styleName = sizeMatch ? sizeMatch[1].trim() : String(w.title).split(' ')[0];
    }
    if (styleName && !/^\d/.test(styleName)) { // Skip if starts with digit (not a model name)
      styles.set(styleName, (styles.get(styleName) || 0) + 1);
    }

    // Finish
    const finish = w.properties?.abbreviated_finish_desc;
    if (finish) finishes.set(finish, (finishes.get(finish) || 0) + 1);

    // Diameter
    const dia = w.properties?.diameter;
    if (dia != null) {
      // Normalize: String(Number()) collapses '16.0' -> '16' while preserving '8.5'
      const diaStr = String(Number(dia));
      diameters.set(diaStr, (diameters.get(diaStr) || 0) + 1);
    }

    // Width
    const wid = w.properties?.width;
    if (wid != null) {
      // Normalize: String(Number()) collapses '7.0' -> '7' while preserving '8.5'
      const widStr = String(Number(wid));
      widths.set(widStr, (widths.get(widStr) || 0) + 1);
    }

    // Offset
    const off = w.properties?.offset;
    if (off != null) {
      const offStr = String(off);
      offsets.set(offStr, (offsets.get(offStr) || 0) + 1);
    }

    // Bolt patterns
    const bpRaw = w.properties?.boltPatternMetric || w.properties?.boltPattern || "";
    for (const bp of parseBps(bpRaw)) {
      boltPatterns.set(bp, (boltPatterns.get(bp) || 0) + 1);
    }
  }

  // Return facets in the format expected by wheels/page.tsx:
  // { facetKey: { buckets: [{ value, count }] } }
  // This matches the WheelPros API response format that the page consumes.
  return {
    // Brand facet - page uses buckets("brand_cd") and expects { value, count }
    brand_cd: {
      buckets: Array.from(brands.values())
        .sort((a, b) => b.count - a.count)
        .map(({ code, count }) => ({ value: code, count })),
    },
    // Style/Model name facet (e.g., "BURN", "CATALYST")
    // Sorted alphabetically for easy searching
    style: {
      buckets: Array.from(styles.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([value, count]) => ({ value, count })),
    },
    // Finish facet - page uses buckets("abbreviated_finish_desc")
    // Now uses normalized finish values with logical sorting
    abbreviated_finish_desc: {
      buckets: sortFinishes(
        Array.from(finishes.entries()).map(([value, count]) => ({ value, count }))
      ),
    },
    // Diameter facet - page uses buckets("wheel_diameter")
    wheel_diameter: {
      buckets: Array.from(diameters.entries())
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([value, count]) => ({ value, count })),
    },
    // Width facet - page uses buckets("width")
    width: {
      buckets: Array.from(widths.entries())
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([value, count]) => ({ value, count })),
    },
    // Offset facet (for potential future use)
    offset: {
      buckets: Array.from(offsets.entries())
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([value, count]) => ({ value, count })),
    },
    // Bolt pattern facet - page uses buckets("bolt_pattern_metric")
    bolt_pattern_metric: {
      buckets: Array.from(boltPatterns.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, count })),
    },
  };
}
