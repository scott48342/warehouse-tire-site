import { NextResponse } from "next/server";
import { 
  getPool, 
  buildFitmentProfile, 
  ensureFitmentTables,
} from "@/lib/vehicleFitment";
import { importVehicleFitment } from "@/lib/fitmentImport";
import { 
  getFitmentProfile, 
  type FitmentProfile as DBFitmentProfile,
  type ProfileResolutionPath,
  type ProfileLookupResult,
} from "@/lib/fitment-db/profileService";
import {
  buildFitmentEnvelope,
  validateWheel,
  // summarizeValidations,
  autoDetectFitmentMode,
  type FitmentMode,
  type WheelSpec,
  type OEMSpecs,
  type FitmentValidation,
  EXPANSION_PRESETS,
} from "@/lib/aftermarketFitment";

import {
  getTechfeedCandidatesByBoltPattern,
  getTechfeedIndexBuiltAt,
} from "@/lib/techfeed/wheels";

// NOTE: getSupplierCredentials removed from search (DB-first architecture)
// Live availability checks now happen at cart/checkout only

import {
  getCachedBulk,
  getCacheStats as getAvailabilityCacheStats,
} from "@/lib/availabilityCache";

import {
  calculateConfidence,
  buildConfidenceResponse,
  getConfidenceUIMetadata,
  formatConfidenceForLog,
  type FitmentConfidence,
  type ConfidenceResult,
} from "@/lib/fitmentConfidence";

export const runtime = "nodejs";
export const maxDuration = 60;

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
    // STEP 4: Legacy Fallback (Only When ModificationId-First Fails)
    // ═══════════════════════════════════════════════════════════════════════════
    
    console.warn(`[fitment-search] LEGACY FALLBACK: ${year} ${make} ${model} mod=${modificationId || "(none)"} - dbProfile unavailable`);
    resolutionPath = "legacyFallback";
    
    return await handleLegacyPath(url, year, make, model, modificationId, modeParam, debug, t0);

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
  const wheelSpecs = (dbProfile.oemWheelSizes || []).map((ws: any) => ({
    rimDiameter: Number(ws.diameter),
    rimWidth: Number(ws.width),
    offset: ws.offset != null ? Number(ws.offset) : null,
  }));

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

  const envelope = buildFitmentEnvelope(oem, mode);

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

    // valid pricing fields (required)
    const p = Number(c.map_price || c.msrp || 0) || 0;
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
  const fitmentValidCandidates: FitmentValidCandidate[] = [];

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
  // PHASE 3: Optional cached availability lookup (NO LIVE CALLS)
  // Used only for displaying availability labels, NOT for filtering results
  // ═══════════════════════════════════════════════════════════════════════════
  const tAvail0 = Date.now();
  const allSkus = fitmentValidCandidates.map(item => item.candidate.sku);
  const cachedAvailability = await getCachedBulk(allSkus, minQty);
  timing.cachedAvailabilityMs = Date.now() - tAvail0;
  timing.cachedAvailabilityHits = cachedAvailability.size;
  timing.totalFitmentValid = fitmentValidCandidates.length;

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 4: RANKING & SCORING
  // Score each wheel for quality-based ordering without removing any results
  // ═══════════════════════════════════════════════════════════════════════════
  const tRanking0 = Date.now();
  
  // Brand tiers for scoring
  const TIER_1_BRANDS = new Set(["FM", "FT", "MO", "XD", "KM", "RC", "AR"]); // Fuel, Moto Metal, XD, KMC, Raceline, American Racing
  const TIER_2_BRANDS = new Set(["HE", "VF", "PR", "LE", "DC", "NC", "UC"]); // Helo, Vision, Pro Comp, Level 8, Dick Cepek, Niche, Ultra
  
  // Calculate OEM midpoints for fitment quality scoring
  const oemMidDiameter = (envelope.oemMinDiameter + envelope.oemMaxDiameter) / 2;
  const oemMidOffset = (envelope.oemMinOffset + envelope.oemMaxOffset) / 2;
  
  // Calculate price statistics for mid-range preference
  const allPrices = fitmentValidCandidates
    .map(item => Number(item.candidate.map_price || item.candidate.msrp || 0))
    .filter(p => p > 0);
  const priceMedian = allPrices.length > 0 
    ? allPrices.sort((a, b) => a - b)[Math.floor(allPrices.length / 2)] 
    : 300;
  const priceQ1 = allPrices.length > 0 
    ? allPrices[Math.floor(allPrices.length * 0.25)] 
    : 150;
  const priceQ3 = allPrices.length > 0 
    ? allPrices[Math.floor(allPrices.length * 0.75)] 
    : 500;
  
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
    };
    availabilityLabel: "in_stock" | "limited" | "check_availability";
  };
  
  const scoredCandidates: ScoredCandidate[] = fitmentValidCandidates.map(({ candidate: c, validation: v }) => {
    const cached = cachedAvailability.get(c.sku);
    const totalStock = cached ? (cached.localQty || 0) + (cached.globalQty || 0) : 0;
    
    // Determine availability label
    let availabilityLabel: "in_stock" | "limited" | "check_availability" = "check_availability";
    if (cached?.ok && totalStock >= minQty * 2) {
      availabilityLabel = "in_stock";
    } else if (cached?.ok && totalStock >= minQty) {
      availabilityLabel = "limited";
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // SCORING (0-100 scale per category, weighted)
    // ═══════════════════════════════════════════════════════════════════════
    
    // 1. Availability Score (0-100, weight: 30%)
    let availabilityScore = 0;
    if (availabilityLabel === "in_stock") availabilityScore = 100;
    else if (availabilityLabel === "limited") availabilityScore = 60;
    else availabilityScore = 20; // check_availability still gets some points
    
    // 2. Brand Tier Score (0-100, weight: 20%)
    let brandTierScore = 50; // default for unknown brands
    const brandCode = (c.brand_cd || "").toUpperCase();
    if (TIER_1_BRANDS.has(brandCode)) brandTierScore = 100;
    else if (TIER_2_BRANDS.has(brandCode)) brandTierScore = 75;
    
    // 3. Fitment Quality Score (0-100, weight: 20%)
    let fitmentQualityScore = 50;
    const wheelDiameter = Number(c.diameter) || 0;
    const wheelOffset = Number(c.offset) || 0;
    
    // Diameter: prefer near OEM midpoint (within 2" is great, 4" is okay)
    if (wheelDiameter > 0) {
      const diameterDiff = Math.abs(wheelDiameter - oemMidDiameter);
      if (diameterDiff <= 1) fitmentQualityScore = 100;
      else if (diameterDiff <= 2) fitmentQualityScore = 85;
      else if (diameterDiff <= 3) fitmentQualityScore = 60;
      else fitmentQualityScore = 40;
    }
    
    // Offset: prefer within OEM range (bonus for near midpoint)
    if (wheelOffset !== 0 || c.offset != null) {
      const offsetDiff = Math.abs(wheelOffset - oemMidOffset);
      if (offsetDiff <= 5) fitmentQualityScore = Math.min(100, fitmentQualityScore + 15);
      else if (offsetDiff <= 15) fitmentQualityScore = Math.min(100, fitmentQualityScore + 5);
    }
    
    // 4. Visual Quality Score (0-100, weight: 15%)
    let visualQualityScore = 30; // no images
    const images = c.images || [];
    if (images.length >= 3) visualQualityScore = 100;
    else if (images.length >= 1) visualQualityScore = 70;
    
    // 5. Price Range Score (0-100, weight: 15%)
    // Prefer mid-range pricing (between Q1 and Q3)
    let priceRangeScore = 50;
    const price = Number(c.map_price || c.msrp || 0);
    if (price > 0) {
      if (price >= priceQ1 && price <= priceQ3) {
        // In the sweet spot (middle 50%)
        priceRangeScore = 100;
      } else if (price < priceQ1) {
        // Budget range - still okay
        priceRangeScore = 70;
      } else {
        // Premium range
        priceRangeScore = 60;
      }
    }
    
    // Calculate weighted total score
    const score = (
      availabilityScore * 0.30 +
      brandTierScore * 0.20 +
      fitmentQualityScore * 0.20 +
      visualQualityScore * 0.15 +
      priceRangeScore * 0.15
    );
    
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
      },
      availabilityLabel,
    };
  });
  
  // Sort by score (descending)
  scoredCandidates.sort((a, b) => b.score - a.score);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 4b: BRAND DIVERSITY POST-PROCESSING
  // Avoid more than 2 consecutive items from the same brand
  // ═══════════════════════════════════════════════════════════════════════════
  
  function applyBrandDiversity(items: ScoredCandidate[]): ScoredCandidate[] {
    if (items.length <= 3) return items;
    
    const result: ScoredCandidate[] = [];
    const remaining = [...items];
    
    while (remaining.length > 0) {
      // Find next item that doesn't create 3+ consecutive same-brand
      let foundIdx = 0;
      
      if (result.length >= 2) {
        const lastBrand = result[result.length - 1].candidate.brand_cd;
        const secondLastBrand = result[result.length - 2].candidate.brand_cd;
        
        if (lastBrand && lastBrand === secondLastBrand) {
          // Need to find a different brand
          for (let i = 0; i < remaining.length; i++) {
            if (remaining[i].candidate.brand_cd !== lastBrand) {
              foundIdx = i;
              break;
            }
          }
          // If all remaining are same brand, just take the first
        }
      }
      
      result.push(remaining[foundIdx]);
      remaining.splice(foundIdx, 1);
    }
    
    return result;
  }
  
  const rankedCandidates = applyBrandDiversity(scoredCandidates);
  
  timing.rankingMs = Date.now() - tRanking0;

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 5: Build paginated results from ranked candidates
  // ═══════════════════════════════════════════════════════════════════════════
  const totalCount = rankedCandidates.length;
  const startIdx = (requestedPage - 1) * requestedPageSize;
  const pageItems = rankedCandidates.slice(startIdx, startIdx + requestedPageSize);

  const results = pageItems.map(({ candidate: c, validation: v, score, scoreBreakdown, availabilityLabel }) => {
    // Get cached availability for inventory display
    const cached = cachedAvailability.get(c.sku);
    
    const availabilityData = cached ? {
      confirmed: true,
      inventoryType: cached.inventoryType,
      localStock: cached.localQty,
      globalStock: cached.globalQty,
      checkedAt: cached.checkedAt,
    } : { confirmed: false };
    
    return {
      sku: c.sku,
      skuType: "WHEEL",
      title: c.product_desc || c.sku,
      brand: c.brand_cd ? { code: c.brand_cd, description: c.brand_desc || c.brand_cd } : undefined,
      // Inventory shown from cache only (no live calls)
      inventory: cached ? {
        type: cached.inventoryType || "UNKNOWN",
        localStock: cached.localQty || 0,
        globalStock: cached.globalQty || 0,
      } : {
        type: "UNKNOWN",
        localStock: 0,
        globalStock: 0,
      },
      prices: {
        msrp: [
          {
            currencyAmount: String(Number(c.map_price || c.msrp || 0) || 0),
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
        breakdown: debug ? scoreBreakdown : undefined,
      },
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
  const rankingStats = {
    // Availability distribution
    availabilityDistribution: {
      in_stock: rankedCandidates.filter(c => c.availabilityLabel === "in_stock").length,
      limited: rankedCandidates.filter(c => c.availabilityLabel === "limited").length,
      check_availability: rankedCandidates.filter(c => c.availabilityLabel === "check_availability").length,
    },
    // Brand distribution in top 100
    topBrandDistribution: (() => {
      const top100 = rankedCandidates.slice(0, 100);
      const brandCounts = new Map<string, number>();
      for (const c of top100) {
        const brand = c.candidate.brand_cd || "UNKNOWN";
        brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);
      }
      return Array.from(brandCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([brand, count]) => ({ brand, count }));
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
      // DB-FIRST: No live availability checks during search
      availabilityMode: "catalog",
      availabilityCachedHits: cachedAvailability.size,
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
  modeParam: string | null,
  debug: boolean,
  t0: number
): Promise<NextResponse> {
  const db = getPool();
  await ensureFitmentTables(db);

  // Use modificationId as trim for legacy lookup
  const trim = modificationId;
  
  // Try to get profile from legacy database
  let profile = await buildFitmentProfile(db, Number(year), make, model, trim);
  
  // If no profile found, try legacy import
  if (!profile) {
    console.log(`[fitment-search] LEGACY Import: ${year} ${make} ${model} trim=${trim || "(none)"}`);
    
    const importRes = await importVehicleFitment(Number(year), make, model, {
      desiredTrim: trim,
      usMarketOnly: true,
      debug: true,
    });

    if (!importRes.success) {
      return NextResponse.json({
        error: "No fitment profile found and import failed",
        importError: importRes.error,
        vehicle: { year, make, model, trim },
        resolutionPath: "invalid",
      }, { status: 404 });
    }

    // Try multiple lookup strategies after import
    profile = await buildFitmentProfile(db, Number(year), make, model, trim);
    
    if (!profile && importRes.modificationSlug && importRes.modificationSlug !== trim) {
      profile = await buildFitmentProfile(db, Number(year), make, model, importRes.modificationSlug);
    }
    
    if (!profile && importRes.vehicle?.trim && importRes.vehicle.trim !== trim) {
      profile = await buildFitmentProfile(db, Number(year), make, model, importRes.vehicle.trim);
    }
    
    if (!profile && importRes.vehicle?.slug) {
      profile = await buildFitmentProfile(db, Number(year), make, model, importRes.vehicle.slug);
    }

    if (!profile) {
      return NextResponse.json({
        error: "Import succeeded but fitment profile still not found in DB",
        vehicle: { year, make, model, trim },
        resolutionPath: "invalid",
        debug: {
          importedVehicleId: importRes.vehicle?.id,
          importedTrim: importRes.vehicle?.trim,
          importedSlug: importRes.vehicle?.slug,
          modificationSlug: importRes.modificationSlug,
          searchedTrim: trim,
        }
      }, { status: 500 });
    }
  }

  const profileMs = Date.now() - t0;

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
          trim: profile.vehicle.trim || modificationId || null,
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
