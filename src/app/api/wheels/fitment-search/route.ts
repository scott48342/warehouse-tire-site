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

import { getSupplierCredentials } from "@/lib/supplierCredentialsSecure";

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
    // ═══════════════════════════════════════════════════════════════════════════
    
    if (dbProfile && dbProfile.boltPattern) {
      return await handleDbProfilePath(url, dbProfile, resolutionPath, canonicalModificationId, aliasUsed, modeParam, debug, t0);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3: Legacy Fallback (Only When ModificationId-First Fails)
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
  t0: number
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
  const tStart = Date.now();

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

  // Hard requirement for "in stock only" live validation
  const minQty = Math.max(1, Number(url.searchParams.get("min_qty") || url.searchParams.get("minQty") || "4") || 4);

  const wheelProsBase = process.env.WHEELPROS_WRAPPER_URL || process.env.NEXT_PUBLIC_WHEELPROS_API_BASE_URL;
  if (!wheelProsBase) {
    return NextResponse.json({ error: "Missing WHEELPROS_WRAPPER_URL" }, { status: 500 });
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.WHEELPROS_WRAPPER_API_KEY) {
    headers["x-api-key"] = process.env.WHEELPROS_WRAPPER_API_KEY;
  }

  // Get supplier credentials from admin settings (with fallback to env/hardcoded)
  const tCreds0 = Date.now();
  const wpCreds = await getSupplierCredentials("wheelpros");
  timing.credentialsMs = Date.now() - tCreds0;

  const tCandidates0 = Date.now();
  const candidates = await getTechfeedCandidatesByBoltPattern(opts.boltPattern);
  timing.candidatesDbMs = Date.now() - tCandidates0;

  // Apply basic DB-level filters first (cheap)
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

  // Concurrent availability validation settings
  // OPTIMIZATION: Increased concurrency and reduced time budget for faster response
  const CONCURRENCY = Math.max(1, Math.min(20, Number(process.env.WT_AVAIL_CONCURRENCY || "16") || 16));
  const scanCap = Math.max(500, Number(process.env.WT_DB_SCAN_CAP || "6000") || 6000);
  const timeBudgetMs = Math.max(2000, Number(process.env.WT_DB_SCAN_TIME_BUDGET_MS || "5000") || 5000);
  
  // OPTIMIZATION: Early stop when we have enough eligible items
  // Lower target for faster results - facets will be built from eligible items
  const targetEligible = Math.max(requestedPageSize * 2, 60);
  
  // OPTIMIZATION: Fast mode - trust techfeed data for quick results when we have many candidates
  // Only do live validation for a sample to verify availability patterns
  const fastMode = filteredCandidates.length > 500;
  const fastModeSampleSize = fastMode ? Math.min(50, Math.ceil(filteredCandidates.length * 0.02)) : 0;
  
  const tScan0 = Date.now();

  // Phase 1: Fitment validation (fast, no I/O)
  const tFitment0 = Date.now();
  type FitmentValidCandidate = {
    candidate: typeof diversifiedCandidates[0];
    validation: FitmentValidation;
  };
  const fitmentValidCandidates: FitmentValidCandidate[] = [];
  let scanned = 0;
  let truncated = false;
  const capsHit: string[] = [];

  for (const c of diversifiedCandidates) {
    scanned++;
    if (scanned > scanCap) {
      truncated = true;
      capsHit.push("scanCap");
      break;
    }

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
    
    // User-provided offset range filter (HARD filter, not classification)
    // Critical for lifted trucks: e.g., 4" lift F150 needs -18 to 0mm offset, not +35mm OEM
    if (hasUserOffsetFilter && wheelSpec.offset !== undefined) {
      const wheelOffset = Number(wheelSpec.offset);
      if (Number.isFinite(wheelOffset)) {
        // Check min offset (if provided)
        if (Number.isFinite(userOffsetMin) && wheelOffset < userOffsetMin!) continue;
        // Check max offset (if provided)
        if (Number.isFinite(userOffsetMax) && wheelOffset > userOffsetMax!) continue;
      }
    }

    fitmentValidCandidates.push({ candidate: c, validation: v });
  }

  const fitmentValid = fitmentValidCandidates.length;
  timing.fitmentValidationMs = Date.now() - tFitment0;
  timing.fitmentValidCount = fitmentValid;

  // Phase 2: Concurrent live availability checks with time budget
  const tAvail0 = Date.now();
  type EligibleItem = {
    candidate: typeof diversifiedCandidates[0];
    validation: FitmentValidation;
    avail: { ok: true; inventoryType: string; localQty: number; globalQty: number; checkedAt: string };
  };
  const eligibleItems: EligibleItem[] = [];
  let availabilityChecked = 0;
  let cacheHits = 0;
  let fastModeAccepted = 0;
  let launchStopped = false;
  let earlyStopReason: string | null = null;

  // Concurrency pool
  const inFlight = new Set<Promise<void>>();

  const checkAvailability = async (item: FitmentValidCandidate): Promise<void> => {
    const avail = await fetchLiveAvailabilityForSku({
      wheelProsBase,
      headers,
      sku: item.candidate.sku,
      minQty,
      customerNumber: wpCreds.customerNumber || undefined,
      companyCode: wpCreds.companyCode || undefined,
    });
    availabilityChecked++;
    if ((avail as any).fromCache) cacheHits++;
    if (avail.ok) {
      eligibleItems.push({
        candidate: item.candidate,
        validation: item.validation,
        avail: avail as EligibleItem["avail"],
      });
    }
  };

  // OPTIMIZATION: Fast mode - accept items from techfeed without live check
  // Trust techfeed data for items with valid pricing (they're in the dealer catalog)
  // Do live validation for a sample to verify availability patterns
  let sampleChecked = 0;
  let sampleAvailable = 0;
  
  if (fastMode && fitmentValidCandidates.length > 100) {
    // Phase 2a: Sample validation - check a small sample to estimate availability rate
    const sampleItems = fitmentValidCandidates.slice(0, fastModeSampleSize);
    const samplePromises = sampleItems.map(async (item) => {
      const avail = await fetchLiveAvailabilityForSku({
        wheelProsBase,
        headers,
        sku: item.candidate.sku,
        minQty,
        customerNumber: wpCreds.customerNumber || undefined,
        companyCode: wpCreds.companyCode || undefined,
      });
      sampleChecked++;
      availabilityChecked++;
      if ((avail as any).fromCache) cacheHits++;
      if (avail.ok) {
        sampleAvailable++;
        eligibleItems.push({
          candidate: item.candidate,
          validation: item.validation,
          avail: avail as EligibleItem["avail"],
        });
      }
    });
    await Promise.all(samplePromises);
    
    // If sample shows >50% availability, trust remaining items without live check
    const availabilityRate = sampleChecked > 0 ? sampleAvailable / sampleChecked : 0;
    if (availabilityRate >= 0.3 && eligibleItems.length < targetEligible) {
      // Accept more items from techfeed based on sample confidence
      const remainingNeeded = targetEligible - eligibleItems.length;
      const estimatedAvailable = Math.ceil(remainingNeeded / Math.max(0.3, availabilityRate));
      const acceptCount = Math.min(estimatedAvailable * 2, fitmentValidCandidates.length - fastModeSampleSize);
      
      for (let i = fastModeSampleSize; i < fastModeSampleSize + acceptCount && i < fitmentValidCandidates.length; i++) {
        const item = fitmentValidCandidates[i];
        // Accept items with valid pricing as "likely available"
        const hasPrice = Number(item.candidate.map_price || item.candidate.msrp || 0) > 0;
        if (hasPrice) {
          fastModeAccepted++;
          eligibleItems.push({
            candidate: item.candidate,
            validation: item.validation,
            avail: {
              ok: true,
              inventoryType: "TF", // TechFeed (not live verified)
              localQty: 0,
              globalQty: 4, // Assumed available
              checkedAt: new Date().toISOString(),
            },
          });
          if (eligibleItems.length >= targetEligible) {
            earlyStopReason = "fastModeTargetReached";
            capsHit.push("earlyStop:fastMode");
            break;
          }
        }
      }
    }
    
    timing.fastModeSampleRate = availabilityRate;
    timing.fastModeAccepted = fastModeAccepted;
  }

  // Phase 2b: Continue with live checks if we need more eligible items
  if (eligibleItems.length < targetEligible && !earlyStopReason) {
    const startIdx = fastMode ? fastModeSampleSize : 0;
    
    for (let i = startIdx; i < fitmentValidCandidates.length; i++) {
      const item = fitmentValidCandidates[i];
      
      // Skip items already accepted in fast mode
      if (fastMode && i < fastModeSampleSize + (fastModeAccepted * 2)) continue;
      
      // OPTIMIZATION: Early stop when we have enough eligible items
      if (eligibleItems.length >= targetEligible) {
        earlyStopReason = "targetReached";
        capsHit.push("earlyStop:targetReached");
        launchStopped = true;
        break;
      }
      
      // Check time budget before launching new checks
      if (Date.now() - tScan0 > timeBudgetMs) {
        truncated = true;
        earlyStopReason = "timeBudget";
        capsHit.push("timeBudget");
        launchStopped = true;
        break;
      }

      // Wait if at concurrency limit
      while (inFlight.size >= CONCURRENCY) {
        await Promise.race(inFlight);
      }

      // Launch availability check
      const p = checkAvailability(item).finally(() => inFlight.delete(p));
      inFlight.add(p);
    }
  }

  // Wait for remaining in-flight checks to complete (with a hard cap)
  if (inFlight.size > 0) {
    const flushDeadline = Date.now() + 2000; // REDUCED: max 2s extra for in-flight (was 3s)
    while (inFlight.size > 0 && Date.now() < flushDeadline) {
      await Promise.race([...inFlight, new Promise((r) => setTimeout(r, 50))]);
    }
  }
  
  timing.availabilityMs = Date.now() - tAvail0;
  timing.availabilityChecked = availabilityChecked;
  timing.availabilityCacheHits = cacheHits;
  timing.eligibleCount = eligibleItems.length;
  timing.earlyStopReason = earlyStopReason;

  // Phase 3: Build results from eligible items
  const startWanted = (requestedPage - 1) * requestedPageSize;
  const eligibleCount = eligibleItems.length;

  const pageItems = eligibleItems.slice(startWanted, startWanted + requestedPageSize);
  const results = pageItems.map(({ candidate: c, validation: v, avail }) => ({
    sku: c.sku,
    skuType: "WHEEL",
    title: c.product_desc || c.sku,
    brand: c.brand_cd ? { code: c.brand_cd, description: c.brand_desc || c.brand_cd } : undefined,
    inventory: {
      type: avail.inventoryType,
      localStock: avail.localQty,
      globalStock: avail.globalQty,
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
    availability: {
      confirmed: true,
      minQty,
      checkedAt: avail.checkedAt,
    },
  }));

  // Build facets from ALL eligible items (not just page)
  const facets = buildFacets(eligibleItems.map((e) => ({
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

  return NextResponse.json({
    results,
    totalCount: eligibleCount,
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
      // User-provided offset filter (from lifted page or manual filter)
      // When active, this overrides the OEM envelope for hard filtering
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
      // DB profile for accessory fitment calculation (threadSize, seatType, centerBoreMm)
      dbProfile: opts.dbProfileForResponse || null,
    },
    summary: {
      total: results.length,
      totalCountEligible: eligibleCount,
      candidates: filteredCandidates.length,
      scanned,
      fitmentValid,
      availabilityChecked,
      truncated,
      capsHit: Array.from(new Set(capsHit)),
      resolutionPath: opts.resolutionPath,
      fitmentSource: opts.fitmentSource,
      aliasUsed: Boolean(opts.aliasUsed),
      validationMode: "strict",
      dbIndexBuiltAt: getTechfeedIndexBuiltAt(),
    },
    // Always include timing for performance monitoring
    timing: {
      totalMs: Date.now() - t0,
      scanMs: Date.now() - tScan0,
      ...timing,
    },
    dealerlineMode: false,
  });
}

// ============================================================================
// Live availability (WheelPros wrapper) with short TTL cache
// ============================================================================

// OPTIMIZATION: Increased cache TTL from 10 min to 30 min (inventory doesn't change that fast)
const AVAIL_CACHE_TTL_MS = Math.max(
  60_000,
  Math.min(60 * 60_000, Number(process.env.WT_AVAIL_CACHE_TTL_MS || "1800000") || 1800_000)
);
const availCache = new Map<
  string,
  {
    expiresAt: number;
    ok: boolean;
    inventoryType?: string;
    localQty?: number;
    globalQty?: number;
    checkedAt: string;
  }
>();

const ORDERABLE_TYPES = new Set(["SO", "ST", "NW", "BW", "CS"]);

async function fetchLiveAvailabilityForSku(opts: {
  wheelProsBase: string;
  headers: Record<string, string>;
  sku: string;
  minQty: number;
  customerNumber?: string;
  companyCode?: string;
}): Promise<
  | { ok: true; inventoryType: string; localQty: number; globalQty: number; checkedAt: string; fromCache?: boolean }
  | { ok: false; checkedAt: string; fromCache?: boolean }
> {
  const checkedAt = new Date().toISOString();
  const sku = String(opts.sku || "").trim();
  if (!sku) return { ok: false, checkedAt };

  const cacheKey = `${sku}|minQty=${opts.minQty}`;
  const cached = availCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.ok
      ? {
          ok: true,
          inventoryType: cached.inventoryType || "",
          localQty: cached.localQty || 0,
          globalQty: cached.globalQty || 0,
          checkedAt: cached.checkedAt,
          fromCache: true,
        }
      : { ok: false, checkedAt: cached.checkedAt, fromCache: true };
  }

  const ac = new AbortController();
  // OPTIMIZATION: Reduced timeout from 1400ms to 800ms for faster failure
  const timeoutMs = Math.max(400, Math.min(1500, Number(process.env.WT_AVAIL_TIMEOUT_MS || "800") || 800));
  const to = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const u = new URL("/wheels/search", opts.wheelProsBase);
    u.searchParams.set("sku", sku);
    u.searchParams.set("page", "1");
    u.searchParams.set("pageSize", "1");
    u.searchParams.set("fields", "inventory");

    // Required params for true sellability (admin-managed or env fallback)
    u.searchParams.set("customer", opts.customerNumber || "1022165");
    u.searchParams.set("company", opts.companyCode || "1000");
    u.searchParams.set("min_qty", String(opts.minQty));

    const res = await fetch(u.toString(), {
      headers: opts.headers,
      cache: "no-store",
      signal: ac.signal,
    });

    const data = await res.json().catch(() => null);
    const item = data?.results?.[0] || data?.items?.[0] || null;

    const inv = item?.inventory;
    const invObj = Array.isArray(inv) ? inv[0] : inv;
    const t = typeof invObj?.type === "string" ? invObj.type.trim().toUpperCase() : "";

    const local = Number(invObj?.localStock ?? invObj?.local_qty ?? invObj?.localQty ?? 0) || 0;
    const global = Number(invObj?.globalStock ?? invObj?.global_qty ?? invObj?.globalQty ?? invObj?.quantity ?? 0) || 0;
    const total = local + global;

    const ok = Boolean(t && ORDERABLE_TYPES.has(t) && total >= opts.minQty);

    availCache.set(cacheKey, {
      expiresAt: Date.now() + AVAIL_CACHE_TTL_MS,
      ok,
      inventoryType: t,
      localQty: local,
      globalQty: global,
      checkedAt,
    });

    return ok
      ? { ok: true, inventoryType: t, localQty: local, globalQty: global, checkedAt }
      : { ok: false, checkedAt };
  } catch {
    availCache.set(cacheKey, {
      expiresAt: Date.now() + AVAIL_CACHE_TTL_MS,
      ok: false,
      checkedAt,
    });
    return { ok: false, checkedAt };
  } finally {
    clearTimeout(to);
  }
}

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
