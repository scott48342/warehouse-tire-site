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
  summarizeValidations,
  autoDetectFitmentMode,
  type FitmentMode,
  type WheelSpec,
  type OEMSpecs,
  type FitmentValidation,
  EXPANSION_PRESETS,
} from "@/lib/aftermarketFitment";

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
  
  // Build derived envelope from dbProfile
  const derivedWheelSpecs = (dbProfile.oemWheelSizes || []).map((ws: any) => ({
    rimDiameter: Number(ws.diameter),
    rimWidth: Number(ws.width),
    offset: ws.offset != null ? Number(ws.offset) : null,
  }));
  
  // Calculate OEM ranges from wheel specs
  const diameters = derivedWheelSpecs.map(ws => ws.rimDiameter).filter(d => d > 0);
  const widths = derivedWheelSpecs.map(ws => ws.rimWidth).filter(w => w > 0);
  const offsets = derivedWheelSpecs.map(ws => ws.offset).filter((o): o is number => o != null);
  
  const oemMinDiameter = diameters.length > 0 ? Math.min(...diameters) : 16;
  const oemMaxDiameter = diameters.length > 0 ? Math.max(...diameters) : 20;
  const oemMinWidth = widths.length > 0 ? Math.min(...widths) : 7;
  const oemMaxWidth = widths.length > 0 ? Math.max(...widths) : 9;
  const oemMinOffset = offsets.length > 0 ? Math.min(...offsets) : (dbProfile.offsetMinMm ?? 20);
  const oemMaxOffset = offsets.length > 0 ? Math.max(...offsets) : (dbProfile.offsetMaxMm ?? 50);
  
  // Auto-detect fitment mode
  let mode: FitmentMode = "aftermarket_safe";
  let vehicleType: "truck" | "suv" | "car" | undefined;
  let modeAutoDetected = false;
  
  if (modeParam && modeParam !== "auto") {
    mode = modeParam as FitmentMode;
  } else {
    const autoResult = autoDetectFitmentMode(model!, {
      boltPattern: dbProfile.boltPattern,
      minDiameter: oemMinDiameter,
      maxWidth: oemMaxWidth,
    });
    mode = autoResult.recommendedMode;
    vehicleType = autoResult.vehicleType;
    modeAutoDetected = true;
  }
  
  // Build derived envelope with expansion based on mode
  const expansion = EXPANSION_PRESETS[mode] || EXPANSION_PRESETS.aftermarket_safe;
  
  const derivedEnvelope = {
    boltPattern: dbProfile.boltPattern!,
    centerBore: dbProfile.centerBoreMm || 0,
    oemMinDiameter,
    oemMaxDiameter,
    oemMinWidth,
    oemMaxWidth,
    oemMinOffset,
    oemMaxOffset,
    allowedMinDiameter: Math.max(14, oemMinDiameter - (expansion.diameterPlusMin || 0)),
    allowedMaxDiameter: oemMaxDiameter + (expansion.diameterPlusMax || 2),
    allowedMinWidth: Math.max(5, oemMinWidth - (expansion.widthPlusMin || 0)),
    allowedMaxWidth: oemMaxWidth + (expansion.widthPlusMax || 1),
    allowedMinOffset: oemMinOffset - (expansion.offsetExpandLow || 15),
    allowedMaxOffset: oemMaxOffset + (expansion.offsetExpandHigh || 10),
  };
  
  // Query WheelPros
  const wheelProsBase = process.env.WHEELPROS_WRAPPER_URL || process.env.NEXT_PUBLIC_WHEELPROS_API_BASE_URL;
  if (!wheelProsBase) {
    return NextResponse.json({ error: "Missing WHEELPROS_WRAPPER_URL" }, { status: 500 });
  }
  
  const page = url.searchParams.get("page") || "1";
  const pageSize = url.searchParams.get("pageSize") || "200";
  const brandCd = url.searchParams.get("brand_cd");
  const finish = url.searchParams.get("finish");
  const diameter = url.searchParams.get("diameter");
  const width = url.searchParams.get("width");
  
  const wpParams = new URLSearchParams({
    boltPattern: dbProfile.boltPattern!,
    page,
    pageSize,
    fields: "inventory,price,images",
  });
  if (brandCd) wpParams.set("brand_cd", brandCd);
  if (finish) wpParams.set("abbreviated_finish_desc", finish);
  if (diameter) wpParams.set("diameter", diameter);
  if (width) wpParams.set("width", width);
  
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.WHEELPROS_WRAPPER_API_KEY) {
    headers["x-api-key"] = process.env.WHEELPROS_WRAPPER_API_KEY;
  }
  
  const wpUrl = new URL("/wheels/search", wheelProsBase);
  wpParams.forEach((v, k) => wpUrl.searchParams.set(k, v));
  
  const wpRes = await fetch(wpUrl.toString(), { headers, cache: "no-store" });
  const wpData = await wpRes.json();
  const wpResults = wpData?.results || wpData?.items || [];
  
  // Validate wheels against derived envelope
  const passingWheels: any[] = [];
  let surefitCount = 0;
  let specfitCount = 0;
  let extendedCount = 0;
  let excludedCount = 0;
  
  for (const wpWheel of wpResults) {
    const wheelDia = wpWheel.properties?.diameter ? Number(wpWheel.properties.diameter) : null;
    const wheelWidth = wpWheel.properties?.width ? Number(wpWheel.properties.width) : null;
    const wheelOffset = wpWheel.properties?.offset ? Number(wpWheel.properties.offset) : null;
    const wheelCb = wpWheel.properties?.centerbore ? Number(wpWheel.properties.centerbore) : null;
    
    // Basic validation
    const diaPass = wheelDia != null && wheelDia >= derivedEnvelope.allowedMinDiameter && wheelDia <= derivedEnvelope.allowedMaxDiameter;
    const widthPass = wheelWidth != null && wheelWidth >= derivedEnvelope.allowedMinWidth && wheelWidth <= derivedEnvelope.allowedMaxWidth;
    const offsetPass = wheelOffset == null || (wheelOffset >= derivedEnvelope.allowedMinOffset && wheelOffset <= derivedEnvelope.allowedMaxOffset);
    const cbPass = wheelCb == null || derivedEnvelope.centerBore === 0 || wheelCb >= derivedEnvelope.centerBore;
    
    if (!diaPass || !widthPass || !offsetPass || !cbPass) {
      excludedCount++;
      continue;
    }
    
    // Determine fitment class
    let fitmentClass: "surefit" | "specfit" | "extended" = "extended";
    
    const isOemDia = wheelDia != null && wheelDia >= oemMinDiameter && wheelDia <= oemMaxDiameter;
    const isOemWidth = wheelWidth != null && wheelWidth >= oemMinWidth && wheelWidth <= oemMaxWidth;
    const isOemOffset = wheelOffset == null || (wheelOffset >= oemMinOffset && wheelOffset <= oemMaxOffset);
    
    if (isOemDia && isOemWidth && isOemOffset) {
      fitmentClass = "surefit";
      surefitCount++;
    } else if (isOemDia && isOemWidth) {
      fitmentClass = "specfit";
      specfitCount++;
    } else {
      extendedCount++;
    }
    
    passingWheels.push({
      ...wpWheel,
      fitmentValidation: {
        fitmentClass,
        fitmentMode: mode,
        ...(debug ? {
          diameterPass: diaPass,
          widthPass,
          offsetPass,
          centerBorePass: cbPass,
        } : {}),
      },
    });
  }
  
  console.log(`[fitment-search] 📤 RESPONSE (${resolutionPath}): ${year} ${make} ${model}`, {
    boltPattern: dbProfile.boltPattern,
    wheels: passingWheels.length,
    surefit: surefitCount,
    specfit: specfitCount,
    extended: extendedCount,
    excluded: excludedCount,
    timing: `${Date.now() - t0}ms`,
  });
  
  // Build facets
  const facets = buildFacets(passingWheels);
  
  const requestedModificationId = url.searchParams.get("modification") || url.searchParams.get("trim") || null;
  
  return NextResponse.json({
    results: passingWheels,
    totalCount: passingWheels.length,
    page: Number(page),
    pageSize: Number(pageSize),
    facets,
    fitment: {
      mode,
      modeAutoDetected,
      vehicleType,
      resolutionPath,
      fitmentSource: resolutionPath,
      aliasUsed,
      canonicalModificationId,
      requestedModificationId,
      validationMode: "derived",
      envelope: {
        boltPattern: derivedEnvelope.boltPattern,
        centerBore: derivedEnvelope.centerBore,
        oem: {
          diameter: [oemMinDiameter, oemMaxDiameter],
          width: [oemMinWidth, oemMaxWidth],
          offset: [oemMinOffset, oemMaxOffset],
        },
        allowed: {
          diameter: [derivedEnvelope.allowedMinDiameter, derivedEnvelope.allowedMaxDiameter],
          width: [derivedEnvelope.allowedMinWidth, derivedEnvelope.allowedMaxWidth],
          offset: [derivedEnvelope.allowedMinOffset, derivedEnvelope.allowedMaxOffset],
        },
      },
      vehicle: {
        year: Number(year),
        make,
        model,
        trim: dbProfile.displayTrim,
      },
      dbProfile: {
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
    },
    summary: {
      fromWheelPros: wpResults.length,
      afterFitmentFilter: passingWheels.length,
      total: passingWheels.length,
      surefit: surefitCount,
      specfit: specfitCount,
      extended: extendedCount,
      excluded: excludedCount,
      resolutionPath,
      fitmentSource: resolutionPath,
      aliasUsed,
      validationMode: "derived",
    },
    timing: debug ? { totalMs: Date.now() - t0 } : undefined,
  });
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
  const envelopeMs = Date.now() - t0 - profileMs;

  // Query Wheel Pros
  const wheelProsBase = process.env.WHEELPROS_WRAPPER_URL || process.env.NEXT_PUBLIC_WHEELPROS_API_BASE_URL;
  if (!wheelProsBase) {
    return NextResponse.json({ error: "Missing WHEELPROS_WRAPPER_URL" }, { status: 500 });
  }

  const page = url.searchParams.get("page") || "1";
  const pageSize = url.searchParams.get("pageSize") || "200";
  const brandCd = url.searchParams.get("brand_cd");
  const finish = url.searchParams.get("finish");
  const diameter = url.searchParams.get("diameter");
  const width = url.searchParams.get("width");

  const wpParams = new URLSearchParams({
    boltPattern: profile.boltPattern,
    page,
    pageSize,
    fields: "inventory,price,images",
  });
  if (brandCd) wpParams.set("brand_cd", brandCd);
  if (finish) wpParams.set("abbreviated_finish_desc", finish);
  if (diameter) wpParams.set("diameter", diameter);
  if (width) wpParams.set("width", width);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.WHEELPROS_WRAPPER_API_KEY) {
    headers["x-api-key"] = process.env.WHEELPROS_WRAPPER_API_KEY;
  }

  const wpUrl = new URL("/wheels/search", wheelProsBase);
  wpParams.forEach((v, k) => wpUrl.searchParams.set(k, v));

  const wpRes = await fetch(wpUrl.toString(), { headers, cache: "no-store" });
  const wpData = await wpRes.json();
  const wpMs = Date.now() - t0 - profileMs - envelopeMs;
  const wpResults = wpData?.results || wpData?.items || [];

  // Validate each wheel
  const allValidations: FitmentValidation[] = [];
  const passingWheels: any[] = [];

  for (const wpWheel of wpResults) {
    const wheelSpec: WheelSpec = {
      sku: wpWheel.sku || "",
      boltPattern: wpWheel.properties?.boltPatternMetric || wpWheel.properties?.boltPattern || "",
      centerBore: wpWheel.properties?.centerbore ? Number(wpWheel.properties.centerbore) : undefined,
      diameter: wpWheel.properties?.diameter ? Number(wpWheel.properties.diameter) : undefined,
      width: wpWheel.properties?.width ? Number(wpWheel.properties.width) : undefined,
      offset: wpWheel.properties?.offset ? Number(wpWheel.properties.offset) : undefined,
    };

    const validation = validateWheel(wheelSpec, envelope);
    allValidations.push(validation);

    if (validation.fitmentClass !== "excluded") {
      passingWheels.push({
        ...wpWheel,
        fitmentValidation: {
          fitmentClass: validation.fitmentClass,
          fitmentMode: validation.fitmentMode,
          ...(debug ? {
            boltPatternPass: validation.boltPatternPass,
            centerBorePass: validation.centerBorePass,
            diameterPass: validation.diameterPass,
            widthPass: validation.widthPass,
            offsetPass: validation.offsetPass,
            exclusionReasons: validation.exclusionReasons,
          } : {}),
        },
      });
    }
  }

  const validateMs = Date.now() - t0 - profileMs - envelopeMs - wpMs;
  const summary = summarizeValidations(allValidations);
  const facets = buildFacets(passingWheels);

  console.log(`[fitment-search] 📤 RESPONSE (legacyFallback): ${year} ${make} ${model}`, {
    boltPattern: envelope.boltPattern,
    wheels: passingWheels.length,
    timing: `${Date.now() - t0}ms`,
  });

  return NextResponse.json({
    results: passingWheels,
    totalCount: passingWheels.length,
    page: Number(page),
    pageSize: Number(pageSize),
    facets,
    fitment: {
      mode,
      modeAutoDetected,
      vehicleType,
      resolutionPath: "legacyFallback",
      fitmentSource: "legacyFallback",
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
      vehicle: {
        year: profile.vehicle.year,
        make: profile.vehicle.make,
        model: profile.vehicle.model,
        trim: profile.vehicle.trim,
      },
      staggered: profile.staggered,
    },
    summary: {
      fromWheelPros: wpResults.length,
      afterFitmentFilter: passingWheels.length,
      ...summary,
      resolutionPath: "legacyFallback",
      fitmentSource: "legacyFallback",
      validationMode: "strict",
    },
    timing: debug ? {
      totalMs: Date.now() - t0,
      profileMs,
      envelopeMs,
      wpMs,
      validateMs,
    } : undefined,
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

  return {
    brands: Array.from(brands.values()).sort((a, b) => b.count - a.count),
    finishes: Array.from(finishes.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, count })),
    diameters: Array.from(diameters.entries())
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([value, count]) => ({ value, count })),
    widths: Array.from(widths.entries())
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([value, count]) => ({ value, count })),
    offsets: Array.from(offsets.entries())
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([value, count]) => ({ value, count })),
    boltPatterns: Array.from(boltPatterns.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, count })),
  };
}
