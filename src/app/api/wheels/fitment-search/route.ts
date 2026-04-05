import { NextResponse } from "next/server";
import { 
  getPool, 
  buildFitmentProfile, 
  ensureFitmentTables,
} from "@/lib/vehicleFitment";
// DB-FIRST: External API imports blocked. Use admin/fitment for manual import.
// import { importVehicleFitment } from "@/lib/fitmentImport";
import { 
  getFitmentProfile, 
  type FitmentProfile as DBFitmentProfile,
  type ProfileResolutionPath,
  type ProfileLookupResult,
} from "@/lib/fitment-db/profileService";
import { listLocalFitments } from "@/lib/fitment-db/getFitment";
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
  isClassicVehicle,
  getClassicFitment,
} from "@/lib/classic-fitment/classicLookup";

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
} from "@/lib/inventoryCache";

import {
  calculateConfidence,
  buildConfidenceResponse,
  getConfidenceUIMetadata,
  formatConfidenceForLog,
  type FitmentConfidence,
  type ConfidenceResult,
} from "@/lib/fitmentConfidence";

import { logUnresolvedFitment } from "@/lib/fitment-db/unresolvedFitmentTracker";

import { calculateWheelSellPrice } from "@/lib/pricing";

import {
  shouldApplyPackagePriority,
  getPackagePriorityTier,
  type PackagePriorityTier,
} from "@/lib/packagePrioritization";

export const runtime = "nodejs";
export const maxDuration = 60;

// ═══════════════════════════════════════════════════════════════════════════════
// WHEEL SIZE STRING PARSER
// ═══════════════════════════════════════════════════════════════════════════════
// Parses wheel size strings like "8.5Jx18" or "10Jx20" into {width, diameter}
// Also handles object-based formats for backward compatibility
// ═══════════════════════════════════════════════════════════════════════════════

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
  const frontSpecs = wheelSizes.filter(s => s.axle === "front");
  const rearSpecs = wheelSizes.filter(s => s.axle === "rear");
  const bothSpecs = wheelSizes.filter(s => s.axle === "both");

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

  // If all specs are "both" (same front and rear), not staggered
  if (bothSpecs.length > 0 && frontSpecs.length === 0 && rearSpecs.length === 0) {
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
        axle: (obj.axle === "front" || obj.axle === "rear") ? obj.axle : "both",
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
 * 2. If found → use it directly (no legacy system needed)
 * 3. If not found → fall back to legacy system (with logging)
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
    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: ModificationId-First Profile Resolution (with Alias Support)
    // ═══════════════════════════════════════════════════════════════════════════
    
    let dbProfile: DBFitmentProfile | null = null;
    let resolutionPath: FitmentResolutionPath = "invalid";
    let profileResult: ProfileLookupResult | null = null;
    let canonicalModificationId: string | null = null;
    let aliasUsed = false;
    
    // Primary path: Use modificationId-first lookup (DB → Alias → API)
    if (modificationId) {
      try {
        profileResult = await getFitmentProfile(Number(year), make, model, modificationId);
        
        if (profileResult.profile) {
          dbProfile = profileResult.profile;
          resolutionPath = profileResult.resolutionPath;
          canonicalModificationId = profileResult.canonicalModificationId;
          aliasUsed = profileResult.aliasUsed;
          
          console.log(`[fitment-search] RESOLVED (${resolutionPath}): ${year} ${make} ${model} mod=${modificationId}${aliasUsed ? ` → ${canonicalModificationId}` : ''}`, {
            boltPattern: dbProfile.boltPattern,
            oemWheelSizes: dbProfile.oemWheelSizes.length,
            oemTireSizes: dbProfile.oemTireSizes.length,
            aliasUsed,
            timing: profileResult.timing,
          });
        } else {
          console.log(`[fitment-search] PROFILE NOT FOUND: ${year} ${make} ${model} mod=${modificationId}`);
        }
      } catch (profileErr: any) {
        console.error(`[fitment-search] ModificationId-first lookup failed:`, profileErr?.message || profileErr);
        dbProfile = null;
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: Use dbProfile if Available (ModificationId-First Path)
    // Check confidence and potentially block ONLY if we have a profile to evaluate
    // ═══════════════════════════════════════════════════════════════════════════
    
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
        return await handleDbProfilePath(url, dbProfile, resolutionPath, canonicalModificationId, aliasUsed, modeParam, debug, t0, confidenceResult);
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3.5: Direct Local DB Fallback (bypass profileService)
    // This handles cases where profileService fails but we have local fitment data
    // ═══════════════════════════════════════════════════════════════════════════
    
    if (!dbProfile) {
      try {
        console.log(`[fitment-search] TRYING LOCAL DB FALLBACK: ${year} ${make} ${model}`);
        const localFitments = await listLocalFitments(Number(year), make, model);
        
        if (localFitments.length > 0) {
          // Pick best fitment (one with bolt pattern and tire sizes)
          const bestFitment = localFitments.find(f => f.boltPattern && Array.isArray(f.oemTireSizes) && f.oemTireSizes.length > 0) || localFitments[0];
          
          if (bestFitment && bestFitment.boltPattern) {
            console.log(`[fitment-search] LOCAL DB HIT: ${year} ${make} ${model} → ${bestFitment.modificationId} (boltPattern: ${bestFitment.boltPattern})`);
            
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
              offsetMinMm: bestFitment.offsetMinMm ? Number(bestFitment.offsetMinMm) : null,
              offsetMaxMm: bestFitment.offsetMaxMm ? Number(bestFitment.offsetMaxMm) : null,
              oemWheelSizes: parseWheelSizes(bestFitment.oemWheelSizes),
              oemTireSizes: Array.isArray(bestFitment.oemTireSizes) ? bestFitment.oemTireSizes : [],
              source: "db",
              apiCalled: false,
              overridesApplied: false,
            };
            resolutionPath = "directCanonical";
            canonicalModificationId = bestFitment.modificationId;
            
            // Now proceed with wheel search
            const confidenceResult = calculateConfidence(dbProfile);
            if (confidenceResult.canShowWheels && dbProfile.boltPattern) {
              return await handleDbProfilePath(url, dbProfile, resolutionPath, canonicalModificationId, false, modeParam, debug, t0, confidenceResult);
            }
          }
        }
      } catch (localErr: any) {
        console.error(`[fitment-search] Local DB fallback failed:`, localErr?.message || localErr);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3.7: Classic Fitment Fallback (No vehicle_fitments, but has classic_fitments)
    // For classic vehicles without vehicle_fitments records, construct profile from classic_fitments
    // ═══════════════════════════════════════════════════════════════════════════
    
    if (!dbProfile && isClassicVehicle(Number(year), make)) {
      console.log(`[fitment-search] TRYING CLASSIC FALLBACK: ${year} ${make} ${model}`);
      
      try {
        const classicResult = await getClassicFitment(Number(year), make, model);
        
        if (classicResult.isClassicVehicle && classicResult.fitmentMode === "classic") {
          console.log(`[fitment-search] CLASSIC FALLBACK HIT: ${year} ${make} ${model} → platform=${classicResult.platform.code}`);
          
          // Construct a minimal DB profile from classic fitment
          const classicModificationId = `classic_${classicResult.platform.code}_${year}`;
          
          dbProfile = {
            modificationId: classicModificationId,
            year: Number(year),
            make: make.toLowerCase(),
            model: model.toLowerCase(),
            displayTrim: "Base",
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
          return await handleDbProfilePath(url, dbProfile, resolutionPath, canonicalModificationId, false, modeParam, debug, t0, confidenceResult);
        }
      } catch (classicErr: any) {
        console.error(`[fitment-search] Classic fallback failed:`, classicErr?.message || classicErr);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 4: Legacy Fallback (Only When ModificationId-First Fails)
    // ═══════════════════════════════════════════════════════════════════════════
    
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
  confidenceResult?: ConfidenceResult
): Promise<NextResponse> {
  const year = url.searchParams.get("year")!;
  const make = url.searchParams.get("make")!;
  const model = url.searchParams.get("model")!;

  const requestedPage = Math.max(1, Number(url.searchParams.get("page") || "1") || 1);
  const requestedPageSize = Math.max(1, Math.min(200, Number(url.searchParams.get("pageSize") || "24") || 24));

  const brandCd = url.searchParams.get("brand_cd");
  const finish = url.searchParams.get("finish");
  const diameter = url.searchParams.get("diameter");
  const width = url.searchParams.get("width");

  // Hard requirement for "in stock only" live validation
  const minQty = Math.max(1, Number(url.searchParams.get("min_qty") || url.searchParams.get("minQty") || "4") || 4);

  // Build OEM specs from dbProfile (wheel-size based)
  // Parse wheel sizes to handle both string formats ("8.5Jx18") and object formats
  const parsedWheelSizes = parseWheelSizes(dbProfile.oemWheelSizes);
  const wheelSpecs = parsedWheelSizes.map((ws) => ({
    rimDiameter: ws.diameter,
    rimWidth: ws.width,
    offset: ws.offset,
  }));
  
  // Detect staggered fitment from parsed wheel sizes
  const staggeredInfo = detectStaggeredFromParsed(parsedWheelSizes);
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
 * ═══════════════════════════════════════════════════════════════════════════════
 * DB-FIRST WHEEL SEARCH (March 2026 Architecture)
 * ═══════════════════════════════════════════════════════════════════════════════
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
 * ═══════════════════════════════════════════════════════════════════════════════
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
}): Promise<NextResponse> {
  const { url, envelope, debug, t0 } = opts;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TIMING INSTRUMENTATION
  // ═══════════════════════════════════════════════════════════════════════════
  const timing: Record<string, number | string | null> = {};

  const requestedPage = Math.max(1, Number(url.searchParams.get("page") || "1") || 1);
  const requestedPageSize = Math.max(1, Math.min(200, Number(url.searchParams.get("pageSize") || "24") || 24));

  const brandCd = url.searchParams.get("brand_cd");
  const finish = url.searchParams.get("finish");
  const diameter = url.searchParams.get("diameter");
  const width = url.searchParams.get("width");
  
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

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: Get candidates from Techfeed DB (local, fast)
  // ═══════════════════════════════════════════════════════════════════════════
  const tCandidates0 = Date.now();
  const candidates = await getTechfeedCandidatesByBoltPattern(opts.boltPattern);
  timing.candidatesDbMs = Date.now() - tCandidates0;

  // Apply basic DB-level filters (cheap, no I/O)
  const filteredCandidates = candidates.filter((c) => {
    if (brandCd && c.brand_cd && c.brand_cd !== brandCd) return false;
    if (finish && c.abbreviated_finish_desc && String(c.abbreviated_finish_desc) !== String(finish)) return false;
    if (diameter && c.diameter && Number(c.diameter) !== Number(diameter)) return false;
    if (width && c.width && Number(c.width) !== Number(width)) return false;

    // valid pricing fields (required) - use pricing service
    const p = calculateWheelSellPrice({ map: Number(c.map_price) || null, msrp: Number(c.msrp) || null });
    if (p <= 0) return false;

    // best-effort: skip obviously discontinued items if present in text
    const desc = (c.product_desc || "").toLowerCase();
    if (desc.includes("discontinued")) return false;

    return true;
  });

  // Diversify by brand (round-robin) to avoid brand clustering
  const tDiversify0 = Date.now();
  const diversifiedCandidates = diversifyCandidatesByBrand(filteredCandidates);
  timing.diversifyMs = Date.now() - tDiversify0;
  timing.candidatesAfterFilter = filteredCandidates.length;

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: Fitment validation (fast, no I/O)
  // NO AVAILABILITY FILTERING - return ALL fitment-valid wheels
  // ═══════════════════════════════════════════════════════════════════════════
  const tFitment0 = Date.now();
  type FitmentValidCandidate = {
    candidate: typeof diversifiedCandidates[0];
    validation: FitmentValidation;
  };
  let fitmentValidCandidates: FitmentValidCandidate[] = [];

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
    
    // HARD diameter filter: Exclude wheels outside the allowed diameter range
    if (wheelSpec.diameter !== undefined) {
      const wheelDia = Number(wheelSpec.diameter);
      if (wheelDia < envelope.allowedMinDiameter || wheelDia > envelope.allowedMaxDiameter) {
        continue;
      }
    }
    
    // User-provided offset range filter (HARD filter)
    if (hasUserOffsetFilter && wheelSpec.offset !== undefined) {
      const wheelOffset = Number(wheelSpec.offset);
      if (Number.isFinite(wheelOffset)) {
        if (Number.isFinite(userOffsetMin) && wheelOffset < userOffsetMin!) continue;
        if (Number.isFinite(userOffsetMax) && wheelOffset > userOffsetMax!) continue;
      }
    }

    fitmentValidCandidates.push({ candidate: c, validation: v });
  }

  timing.fitmentValidationMs = Date.now() - tFitment0;
  timing.fitmentValidCount = fitmentValidCandidates.length;

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 3: Inventory lookup from SFTP feed (synced every 2 hours)
  // FILTER: Only show SKUs that exist in inventory (removes discontinued products)
  // ═══════════════════════════════════════════════════════════════════════════
  const tAvail0 = Date.now();
  const allSkus = fitmentValidCandidates.map(item => item.candidate.sku);
  const inventoryData = await getInventoryBulk(allSkus);
  timing.cachedAvailabilityMs = Date.now() - tAvail0;
  timing.cachedAvailabilityHits = inventoryData.size;
  timing.totalFitmentValid = fitmentValidCandidates.length;
  
  // INVENTORY FILTER: Only include SKUs that exist in inventory with sufficient qty
  // This filters out discontinued/stale products AND low-stock items
  // Minimum qty = 4 (need at least 4 wheels to sell a set)
  const MIN_INVENTORY_QTY = 4;
  const preFilterCount = fitmentValidCandidates.length;
  fitmentValidCandidates = fitmentValidCandidates.filter(item => {
    const inv = inventoryData.get(item.candidate.sku);
    // Must exist in inventory feed AND have sufficient quantity
    return inv !== undefined && inv.totalQty >= MIN_INVENTORY_QTY;
  });
  timing.inventoryFilteredOut = preFilterCount - fitmentValidCandidates.length;
  
  if (debug && timing.inventoryFilteredOut > 0) {
    console.log(`[fitment-search] 🗑️ Inventory filter removed ${timing.inventoryFilteredOut} SKUs (not in feed or qty < ${MIN_INVENTORY_QTY})`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 4: RANKING & SCORING (v2 - Merchandising Refinement)
  // Score each wheel for quality-based ordering without removing any results
  // ═══════════════════════════════════════════════════════════════════════════
  const tRanking0 = Date.now();
  
  // Brand tiers for scoring
  const TIER_1_BRANDS = new Set(["FM", "FT", "MO", "XD", "KM", "RC", "AR"]); // Fuel, Moto Metal, XD, KMC, Raceline, American Racing
  const TIER_2_BRANDS = new Set(["HE", "VF", "PR", "LE", "DC", "NC", "UC", "OC", "AC", "TU"]); // Helo, Vision, Pro Comp, Level 8, Dick Cepek, Niche, Ultra, Ouray, ATX, Tuff
  
  // Popular finish keywords for visual boost
  const PREMIUM_FINISHES = ["BLACK", "MATTE BLACK", "GLOSS BLACK", "MACHINED", "MILLED", "BRONZE", "GUNMETAL"];
  
  // Calculate OEM midpoints for fitment quality scoring
  const oemMidDiameter = (envelope.oemMinDiameter + envelope.oemMaxDiameter) / 2;
  const oemMidOffset = (envelope.oemMinOffset + envelope.oemMaxOffset) / 2;
  
  // Calculate price statistics for tiered pricing (using pricing service)
  const allPrices = fitmentValidCandidates
    .map(item => calculateWheelSellPrice({ 
      map: Number(item.candidate.map_price) || null, 
      msrp: Number(item.candidate.msrp) || null 
    }))
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
    scoreBreakdown: {
      availability: number;
      brandTier: number;
      fitmentQuality: number;
      visualQuality: number;
      priceRange: number;
      finishBoost: number;
    };
    availabilityLabel: "in_stock" | "limited" | "check_availability";
    priceTier: "value" | "mid" | "premium";
    modelKey: string; // brand+style for deduping
  };
  
  // Orderable inventory types from WheelPros
  const ORDERABLE_TYPES = new Set(["ST", "BW", "NW", "SO", "CS"]);
  
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
    
    // ═══════════════════════════════════════════════════════════════════════
    // SCORING v2 (rebalanced weights, normalized availability)
    // ═══════════════════════════════════════════════════════════════════════
    
    // 1. Availability Score (0-100, weight: 25%) - REBALANCED
    // Narrower gap so other factors can compete
    let availabilityScore = 50; // check_availability baseline
    if (availabilityLabel === "in_stock") availabilityScore = 100;
    else if (availabilityLabel === "limited") availabilityScore = 75;
    
    // 2. Brand Tier Score (0-100, weight: 20%)
    let brandTierScore = 50; // default for unknown brands
    const brandCode = (c.brand_cd || "").toUpperCase();
    if (TIER_1_BRANDS.has(brandCode)) brandTierScore = 100;
    else if (TIER_2_BRANDS.has(brandCode)) brandTierScore = 75;
    
    // 3. Fitment Quality Score (0-100, weight: 20%)
    let fitmentQualityScore = 50;
    const wheelDiameter = Number(c.diameter) || 0;
    const wheelOffset = Number(c.offset) || 0;
    
    // Diameter: prefer near OEM midpoint
    if (wheelDiameter > 0) {
      const diameterDiff = Math.abs(wheelDiameter - oemMidDiameter);
      if (diameterDiff <= 1) fitmentQualityScore = 100;
      else if (diameterDiff <= 2) fitmentQualityScore = 85;
      else if (diameterDiff <= 3) fitmentQualityScore = 65;
      else fitmentQualityScore = 45;
    }
    
    // Offset bonus for near midpoint
    if (c.offset != null) {
      const offsetDiff = Math.abs(wheelOffset - oemMidOffset);
      if (offsetDiff <= 5) fitmentQualityScore = Math.min(100, fitmentQualityScore + 10);
      else if (offsetDiff <= 15) fitmentQualityScore = Math.min(100, fitmentQualityScore + 5);
    }
    
    // 4. Visual Quality Score (0-100, weight: 15%)
    let visualQualityScore = 35; // no images
    const images = c.images || [];
    if (images.length >= 3) visualQualityScore = 100;
    else if (images.length >= 1) visualQualityScore = 75;
    
    // 5. Price Range Score (0-100, weight: 15%)
    // All price tiers are viable, slight preference for mid-range
    const price = calculateWheelSellPrice({ map: Number(c.map_price) || null, msrp: Number(c.msrp) || null });
    let priceRangeScore = 50;
    let priceTier: "value" | "mid" | "premium" = "mid";
    
    if (price > 0) {
      if (price < priceP25) {
        priceTier = "value";
        priceRangeScore = 80; // Value is good
      } else if (price <= priceP75) {
        priceTier = "mid";
        priceRangeScore = 100; // Mid-range is best
      } else {
        priceTier = "premium";
        priceRangeScore = 85; // Premium is good
      }
    }
    
    // 6. Finish Boost (0-15 bonus points) - NEW
    // Boost popular truck/off-road finishes
    let finishBoost = 0;
    const finishDesc = (c.abbreviated_finish_desc || c.fancy_finish_desc || "").toUpperCase();
    const productDesc = (c.product_desc || "").toUpperCase();
    const combinedDesc = `${finishDesc} ${productDesc}`;
    
    for (const finish of PREMIUM_FINISHES) {
      if (combinedDesc.includes(finish)) {
        finishBoost = 10;
        break;
      }
    }
    
    // Calculate weighted total score
    const score = (
      availabilityScore * 0.25 +
      brandTierScore * 0.20 +
      fitmentQualityScore * 0.20 +
      visualQualityScore * 0.15 +
      priceRangeScore * 0.15 +
      finishBoost * 0.05 // 5% weight for finish boost
    );
    
    // Model key for deduping (brand + style/display_style_no)
    const modelKey = `${c.brand_cd || ""}:${c.style || c.display_style_no || c.product_desc?.split(" ")[0] || ""}`.toLowerCase();
    
    return {
      candidate: c,
      validation: v,
      score,
      scoreBreakdown: {
        availability: availabilityScore,
        brandTier: brandTierScore,
        fitmentQuality: fitmentQualityScore,
        visualQuality: visualQualityScore,
        priceRange: priceRangeScore,
        finishBoost,
      },
      availabilityLabel,
      priceTier,
      modelKey,
    };
  });
  
  // Sort by availability tier FIRST (in_stock > limited > check_availability),
  // then by score within each tier. This ensures in-stock wheels always appear first.
  const availabilityTierOrder: Record<string, number> = {
    "in_stock": 0,
    "limited": 1,
    "check_availability": 2,
  };
  scoredCandidates.sort((a, b) => {
    const tierA = availabilityTierOrder[a.availabilityLabel] ?? 2;
    const tierB = availabilityTierOrder[b.availabilityLabel] ?? 2;
    if (tierA !== tierB) return tierA - tierB; // Availability tier first
    return b.score - a.score; // Then by score within tier
  });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 4b: MERCHANDISING POST-PROCESSING
  // 1. Model-level deduping for top slots
  // 2. Brand concentration control
  // 3. Price mix optimization
  // 4. Consecutive brand limit
  // ═══════════════════════════════════════════════════════════════════════════
  
  function applyMerchandisingRules(items: ScoredCandidate[]): ScoredCandidate[] {
    if (items.length <= 5) return items;
    
    const result: ScoredCandidate[] = [];
    const remaining = [...items];
    
    // Track for merchandising rules
    const modelCountInTop20 = new Map<string, number>();
    const brandCountInTop100 = new Map<string, number>();
    const priceTierCountInTop20 = { value: 0, mid: 0, premium: 0 };
    
    // Target price mix for top 20: ~50% mid, ~25% premium, ~25% value
    const priceMixTargets = { value: 5, mid: 10, premium: 5 };
    
    while (remaining.length > 0) {
      const currentPosition = result.length;
      const isTop20 = currentPosition < 20;
      const isTop100 = currentPosition < 100;
      
      let bestIdx = 0;
      let bestScore = -Infinity;
      
      // Evaluate each remaining candidate
      for (let i = 0; i < Math.min(remaining.length, 50); i++) { // Look ahead up to 50 items
        const item = remaining[i];
        let adjustedScore = item.score;
        
        // === Rule 1: Model-level deduping in top 20 ===
        if (isTop20) {
          const modelCount = modelCountInTop20.get(item.modelKey) || 0;
          if (modelCount >= 2) {
            adjustedScore -= 30; // Heavy penalty for 3rd+ of same model
          } else if (modelCount >= 1) {
            adjustedScore -= 10; // Mild penalty for 2nd of same model
          }
        }
        
        // === Rule 2: Brand concentration control in top 100 ===
        if (isTop100) {
          const brandCount = brandCountInTop100.get(item.candidate.brand_cd || "") || 0;
          const brandPct = brandCount / Math.max(1, currentPosition);
          if (brandPct > 0.25 && brandCount >= 5) {
            // Brand already >25% of results, penalize unless score is exceptional
            adjustedScore -= 15;
          }
        }
        
        // === Rule 3: Price mix optimization in top 20 ===
        if (isTop20) {
          const tierCount = priceTierCountInTop20[item.priceTier];
          const tierTarget = priceMixTargets[item.priceTier];
          
          if (tierCount < tierTarget) {
            // Boost underrepresented price tiers
            adjustedScore += 5;
          } else if (tierCount >= tierTarget * 1.5) {
            // Penalize overrepresented tiers
            adjustedScore -= 5;
          }
        }
        
        // === Rule 4: Consecutive brand limit (max 2) ===
        if (result.length >= 2) {
          const lastBrand = result[result.length - 1].candidate.brand_cd;
          const secondLastBrand = result[result.length - 2].candidate.brand_cd;
          
          if (lastBrand && lastBrand === secondLastBrand && item.candidate.brand_cd === lastBrand) {
            adjustedScore -= 50; // Heavy penalty for 3rd consecutive
          }
        }
        
        if (adjustedScore > bestScore) {
          bestScore = adjustedScore;
          bestIdx = i;
        }
      }
      
      // Add best candidate to result
      const selected = remaining[bestIdx];
      result.push(selected);
      remaining.splice(bestIdx, 1);
      
      // Update tracking
      if (result.length <= 20) {
        const mc = modelCountInTop20.get(selected.modelKey) || 0;
        modelCountInTop20.set(selected.modelKey, mc + 1);
        priceTierCountInTop20[selected.priceTier]++;
      }
      if (result.length <= 100) {
        const bc = brandCountInTop100.get(selected.candidate.brand_cd || "") || 0;
        brandCountInTop100.set(selected.candidate.brand_cd || "", bc + 1);
      }
    }
    
    return result;
  }
  
  let rankedCandidates = applyMerchandisingRules(scoredCandidates);
  
  timing.rankingMs = Date.now() - tRanking0;

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 4c: PACKAGE PRIORITY SORTING (Optional Overlay)
  // Apply ONLY when: searchType === 'package' OR buildType === 'lifted'
  // Prioritizes: WheelPros + image + stock > image + stock > WheelPros + stock > rest
  // ═══════════════════════════════════════════════════════════════════════════
  const packageParam = url.searchParams.get("package");
  const buildTypeParam = url.searchParams.get("buildType");
  const searchTypeParam = url.searchParams.get("searchType");
  
  const applyPackagePriority = shouldApplyPackagePriority({
    searchType: searchTypeParam || undefined,
    buildType: buildTypeParam || undefined,
    package: packageParam || undefined,
  });
  
  let packagePriorityApplied = false;
  
  if (applyPackagePriority) {
    const tPkgPriority0 = Date.now();
    
    // Re-sort by package priority tiers, then by price within each tier
    rankedCandidates = [...rankedCandidates].sort((a, b) => {
      // Extract fields for priority calculation
      const aHasImage = (a.candidate.images || []).length > 0;
      const bHasImage = (b.candidate.images || []).length > 0;
      const aStock = inventoryData.get(a.candidate.sku)?.totalQty || 0;
      const bStock = inventoryData.get(b.candidate.sku)?.totalQty || 0;
      const aPrice = calculateWheelSellPrice({ map: Number(a.candidate.map_price) || null, msrp: Number(a.candidate.msrp) || null }) || Infinity;
      const bPrice = calculateWheelSellPrice({ map: Number(b.candidate.map_price) || null, msrp: Number(b.candidate.msrp) || null }) || Infinity;
      
      // All wheels from our DB are WheelPros, so supplier is always "wheelpros"
      const aIsWheelPros = true;
      const bIsWheelPros = true;
      
      // Calculate priority tier (1-4)
      const getTier = (isWP: boolean, hasImg: boolean, stock: number): PackagePriorityTier => {
        if (isWP && hasImg && stock > 0) return 1;
        if (hasImg && stock > 0) return 2;
        if (isWP && stock > 0) return 3;
        return 4;
      };
      
      const aTier = getTier(aIsWheelPros, aHasImage, aStock);
      const bTier = getTier(bIsWheelPros, bHasImage, bStock);
      
      // Sort by tier first (ascending: 1 → 4)
      if (aTier !== bTier) {
        return aTier - bTier;
      }
      
      // Within same tier, sort by price ascending
      return aPrice - bPrice;
    });
    
    timing.packagePriorityMs = Date.now() - tPkgPriority0;
    packagePriorityApplied = true;
    
    console.log(`[fitment-search] 📦 PACKAGE PRIORITY applied: reordered ${rankedCandidates.length} results`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 4d: STAGGERED PAIRING
  // For staggered fitments, find wheels that exist in BOTH front and rear widths
  // Mark them with pair.staggered = true so frontend can filter to complete sets
  // ═══════════════════════════════════════════════════════════════════════════
  const tStaggeredPairing0 = Date.now();
  let staggeredPairsFound = 0;
  
  // Only do pairing if vehicle is staggered
  if (opts.staggeredInfo?.isStaggered && opts.staggeredInfo.frontSpec && opts.staggeredInfo.rearSpec) {
    const frontWidth = opts.staggeredInfo.frontSpec.width;
    const rearWidth = opts.staggeredInfo.rearSpec.width;
    const frontDiameter = opts.staggeredInfo.frontSpec.diameter;
    const rearDiameter = opts.staggeredInfo.rearSpec.diameter;
    
    console.log(`[fitment-search] 🔄 STAGGERED PAIRING: looking for front ${frontDiameter}"×${frontWidth}" + rear ${rearDiameter}"×${rearWidth}"`);
    
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
      // ═══════════════════════════════════════════════════════════════════════════
      // FLEXIBLE STAGGERED PAIRING
      // For aftermarket wheels, we don't require exact OEM width match.
      // Instead, find styles with TWO different widths where one is narrower (front)
      // and one is wider (rear). This captures 9"/10.5" pairs, 8.5"/10" pairs, etc.
      // ═══════════════════════════════════════════════════════════════════════════
      
      // Group candidates by width within this style
      const byWidth = new Map<number, typeof candidates[0][]>();
      for (const c of candidates) {
        const w = Number(c.candidate.width) || 0;
        const d = Number(c.candidate.diameter) || 0;
        // Only consider wheels at the OEM diameter (allow ±1")
        if (Math.abs(d - frontDiameter) > 1 && Math.abs(d - rearDiameter) > 1) continue;
        
        const widthKey = Math.round(w * 2) / 2; // Round to nearest 0.5"
        if (!byWidth.has(widthKey)) byWidth.set(widthKey, []);
        byWidth.get(widthKey)!.push(c);
      }
      
      // Get sorted unique widths for this style
      const availableWidths = Array.from(byWidth.keys()).sort((a, b) => a - b);
      
      // Need at least 2 different widths to form a staggered pair
      if (availableWidths.length < 2) continue;
      
      // Find best front/rear combination:
      // - Front: narrower width (prefer closest to OEM front, max 9.5")
      // - Rear: wider width (prefer closest to OEM rear, min 9.5")
      // - Must have at least 0.5" difference between front and rear
      
      const MAX_FRONT_WIDTH = 9.5;
      const MIN_REAR_WIDTH = 9.5;
      const MIN_WIDTH_DIFF = 0.5;
      
      // Find valid front widths (narrower)
      const frontWidths = availableWidths.filter(w => w <= MAX_FRONT_WIDTH);
      // Find valid rear widths (wider)
      const rearWidths = availableWidths.filter(w => w >= MIN_REAR_WIDTH);
      
      // Find best pair: front closest to OEM front, rear closest to OEM rear
      let bestFrontWidth: number | null = null;
      let bestRearWidth: number | null = null;
      let bestScore = -Infinity;
      
      for (const fw of frontWidths) {
        for (const rw of rearWidths) {
          if (rw - fw < MIN_WIDTH_DIFF) continue; // Need width difference
          
          // Score: prefer widths closer to OEM specs
          const frontScore = 10 - Math.abs(fw - frontWidth);
          const rearScore = 10 - Math.abs(rw - rearWidth);
          const totalScore = frontScore + rearScore;
          
          if (totalScore > bestScore) {
            bestScore = totalScore;
            bestFrontWidth = fw;
            bestRearWidth = rw;
          }
        }
      }
      
      if (bestFrontWidth !== null && bestRearWidth !== null) {
        const frontCandidates = byWidth.get(bestFrontWidth) || [];
        const rearCandidates = byWidth.get(bestRearWidth) || [];
        
        if (frontCandidates.length > 0 && rearCandidates.length > 0) {
          const bestFront = frontCandidates[0];
          const bestRear = rearCandidates[0];
          
          pairedCandidateSkus.add(bestFront.candidate.sku);
          pairedCandidateSkus.add(bestRear.candidate.sku);
          
          staggeredPairs.push({
            styleKey,
            frontSku: bestFront.candidate.sku,
            rearSku: bestRear.candidate.sku,
          });
          
          staggeredPairsFound++;
        }
      }
    }
    
    // Store pairing info for result building
    timing.staggeredPairingMs = Date.now() - tStaggeredPairing0;
    timing.staggeredStylesChecked = styleGroups.size;
    timing.staggeredPairsFound = staggeredPairsFound;
    
    console.log(`[fitment-search] ✅ STAGGERED PAIRING complete: ${staggeredPairsFound} pairs from ${styleGroups.size} styles`);
    
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

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 5: Build paginated results from ranked candidates
  // ═══════════════════════════════════════════════════════════════════════════
  const totalCount = rankedCandidates.length;
  const startIdx = (requestedPage - 1) * requestedPageSize;
  const pageItems = rankedCandidates.slice(startIdx, startIdx + requestedPageSize);

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
            // Use pricing service - prefer inventory cache pricing (2hr sync) over techfeed (stale CSV)
            currencyAmount: String(calculateWheelSellPrice({ 
              map: inv?.mapPrice ?? (Number(c.map_price) || null), 
              msrp: inv?.msrp ?? (Number(c.msrp) || null) 
            })),
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
        abbreviated_finish_desc: c.abbreviated_finish_desc,
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
      pair: staggeredPair ? {
        staggered: true,
        front: {
          sku: staggeredPair.frontSku,
          diameter: staggeredPair.role === "front" ? c.diameter : undefined,
          width: staggeredPair.role === "front" ? c.width : undefined,
          offset: staggeredPair.role === "front" ? c.offset : undefined,
        },
        rear: {
          sku: staggeredPair.rearSku,
          diameter: staggeredPair.role === "rear" ? c.diameter : undefined,
          width: staggeredPair.role === "rear" ? c.width : undefined,
          offset: staggeredPair.role === "rear" ? c.offset : undefined,
        },
      } : undefined,
    };
  });

  // Build facets from ALL ranked items (not just page)
  const facets = buildFacets(rankedCandidates.map((e) => ({
    ...e.candidate,
    properties: {
      brand_cd: e.candidate.brand_cd,
      brand_desc: e.candidate.brand_desc,
      abbreviated_finish_desc: e.candidate.abbreviated_finish_desc,
      diameter: e.candidate.diameter,
      width: e.candidate.width,
      offset: e.candidate.offset,
      boltPatternMetric: e.candidate.bolt_pattern_metric,
      boltPattern: e.candidate.bolt_pattern_standard,
    },
  })));
  
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

  // modificationId is used for lookup (e.g., "s_5b30d3b0")
  // displayTrimParam is kept separate for display (e.g., "Base")
  const lookupKey = modificationId;
  const displayTrim = displayTrimParam || modificationId || null;  // Prefer original trim param
  
  // Try to get profile from legacy database (use modificationId for lookup)
  let profile = await buildFitmentProfile(db, Number(year), make, model, lookupKey);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DB-FIRST: No external API fallback. If profile not in DB, return user-friendly error.
  // Wheel-Size API is BLOCKED in this path. Use admin/fitment for manual import.
  // ═══════════════════════════════════════════════════════════════════════════
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
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CRITICAL: Apply fitment rules to override incorrect legacy data
  // This handles cases like RAM 1500 Classic vs 5th Gen where bolt pattern differs.
  // ═══════════════════════════════════════════════════════════════════════════
  const ruleOverride = getFitmentFromRules({
    year: Number(year),
    make,
    model,
    rawModel: model,
    trim: profile.vehicle?.trim || displayTrim || undefined,
    modificationId: lookupKey,
  });
  
  if (ruleOverride && ruleOverride.boltPattern && ruleOverride.boltPattern !== profile.boltPattern) {
    console.log(`[fitment-search] 🔧 LEGACY RULE OVERRIDE: ${year} ${make} ${model} trim=${displayTrim || "(none)"}`);
    console.log(`  Bolt pattern: ${profile.boltPattern} → ${ruleOverride.boltPattern}`);
    console.log(`  Reason: ${ruleOverride.notes || "Fitment rule match"}`);
    
    // Override the bolt pattern in the profile
    profile.boltPattern = ruleOverride.boltPattern;
    
    // Also override center bore if provided
    if (ruleOverride.centerBoreMm !== undefined) {
      profile.centerBore = ruleOverride.centerBoreMm;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SAFETY CHECK: Calculate confidence on legacy profile
  // ═══════════════════════════════════════════════════════════════════════════
  
  const legacyConfidenceInput = {
    boltPattern: profile.boltPattern,
    centerBoreMm: profile.centerBore,
    oemWheelSizes: profile.wheelSpecs,
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
      boltPattern: profile.boltPattern,
      minDiameter: profile.allowedDiameters.length > 0 ? Math.min(...profile.allowedDiameters) : undefined,
      maxWidth: profile.allowedWidths.length > 0 ? Math.max(...profile.allowedWidths) : undefined,
    });
    mode = autoResult.recommendedMode;
    vehicleType = autoResult.vehicleType;
    modeAutoDetected = true;
  }

  // Build aftermarket fitment envelope
  const oemSpecs: OEMSpecs = {
    boltPattern: profile.boltPattern,
    centerBore: profile.centerBore,
    studHoles: profile.fitment.studHoles,
    pcd: profile.fitment.pcd,
    wheelSpecs: profile.wheelSpecs.map((ws) => ({
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
  // NOTE: Legacy profiles do NOT have threadSize/seatType - those only come from DB-first path.
  // Accessory calculation will show a warning when these are missing.
  const legacyDbProfile = {
    modificationId: profile.vehicle.slug || requestedModificationId || "",
    displayTrim: profile.vehicle.trim || "",
    boltPattern: profile.boltPattern,
    centerBoreMm: profile.centerBore || null,
    threadSize: (profile.fitment as any)?.threadSize || null, // Not available in legacy
    seatType: (profile.fitment as any)?.seatType || null, // Not available in legacy
    offsetRange: {
      min: profile.allowedOffsets.length > 0 ? Math.min(...profile.allowedOffsets) : null,
      max: profile.allowedOffsets.length > 0 ? Math.max(...profile.allowedOffsets) : null,
    },
    oemWheelSizes: profile.wheelSpecs.map((ws: any) => ({
      diameter: ws.rimDiameter,
      width: ws.rimWidth,
      offset: ws.offset,
    })),
    oemTireSizes: (profile as any).tireSizes || [],
    source: "legacy",
  };

  return await handleDbFirstWheelResults({
    url,
    year,
    make,
    model,
    displayTrim: profile.vehicle.trim || "",
    boltPattern: profile.boltPattern,
    envelope,
    mode,
    modeAutoDetected,
    vehicleType,
    resolutionPath: "legacyFallback",
    fitmentSource: "dbFirst",
    requestedModificationId,
    debug,
    t0,
    confidenceResult,  // Pass confidence to response
    staggeredInfo: legacyStaggeredInfo,  // Pass staggered info
    dbProfileForResponse: legacyDbProfile,
  });
}

// ============================================================================
// Facet Builder
// ============================================================================

function buildFacets(wheels: any[]) {
  const brands = new Map<string, { code: string; desc: string; count: number }>();
  const finishes = new Map<string, number>();
  const diameters = new Map<string, number>();
  const widths = new Map<string, number>();
  const offsets = new Map<string, number>();
  const boltPatterns = new Map<string, number>();

  const normalizeBp = (bp: string) => String(bp || "").toLowerCase().replace(/[x×-]/g, "x").trim();
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

    // Finish
    const finish = w.properties?.abbreviated_finish_desc;
    if (finish) finishes.set(finish, (finishes.get(finish) || 0) + 1);

    // Diameter
    const dia = w.properties?.diameter;
    if (dia != null) {
      const diaStr = String(dia);
      diameters.set(diaStr, (diameters.get(diaStr) || 0) + 1);
    }

    // Width
    const wid = w.properties?.width;
    if (wid != null) {
      const widStr = String(wid);
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
    // Finish facet - page uses buckets("abbreviated_finish_desc")
    abbreviated_finish_desc: {
      buckets: Array.from(finishes.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, count })),
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
