import { NextResponse } from "next/server";
import { 
  getPool, 
  buildFitmentProfile, 
  ensureFitmentTables,
} from "@/lib/vehicleFitment";
import { importVehicleFitment } from "@/lib/fitmentImport";
import { getFitmentProfile, type FitmentProfile as DBFitmentProfile } from "@/lib/fitment-db/profileService";
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
 * GET /api/wheels/fitment-search
 * Search wheels with aftermarket-aware fitment validation
 * 
 * Query params:
 * - year, make, model, trim: Vehicle selection
 * - mode: "oem" | "aftermarket_safe" | "aggressive" (default: aftermarket_safe)
 * - page, pageSize: Pagination
 * - brand_cd, finish, diameter, width: Additional filters
 * - offsetMin, offsetMax: User offset range filter (applied after fitment validation)
 * - debug: Include validation details
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";
  const t0 = Date.now();

  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");
  
  // PARAM SEPARATION: modification = fitment identity (preferred), trim = legacy fallback
  const modification = url.searchParams.get("modification") || undefined;
  const trimParam = url.searchParams.get("trim") || undefined;
  
  // Canonical fitment identity: prefer modification, fall back to trim
  const trim = modification || trimParam || undefined;
  
  // Log deprecation warning if using trim as modificationId
  if (!modification && trimParam) {
    console.warn(`[fitment-search] DEPRECATION: Using 'trim' param. Migrate to 'modification=${trimParam}'`);
  }
  
  const modeParam = url.searchParams.get("mode"); // may be null for auto-detect

  if (!year || !make || !model) {
    return NextResponse.json(
      { error: "Missing required params: year, make, model" },
      { status: 400 }
    );
  }

  // Validate mode if explicitly provided (null = auto-detect)
  if (modeParam && !["oem", "aftermarket_safe", "aggressive", "truck", "auto"].includes(modeParam)) {
    return NextResponse.json(
      { error: `Invalid mode: ${modeParam}. Must be oem, aftermarket_safe, aggressive, truck, or auto` },
      { status: 400 }
    );
  }

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // NEW: DB-First Profile Lookup using canonical modificationId
    // ─────────────────────────────────────────────────────────────────────────
    
    let dbProfile: DBFitmentProfile | null = null;
    let usedLegacyFallback = false;
    
    // Try new DB-first service if we have a modification param
    // Wrapped in try-catch to gracefully degrade to legacy system on errors
    if (modification) {
      try {
        const result = await getFitmentProfile(Number(year), make, model, modification);
        
        if (result.profile) {
          dbProfile = result.profile;
          console.log(`[fitment-search] ${result.source.toUpperCase()}: ${year} ${make} ${model} mod=${modification}`, {
            boltPattern: dbProfile.boltPattern,
            oemWheelSizes: dbProfile.oemWheelSizes.length,
            oemTireSizes: dbProfile.oemTireSizes.length,
            timing: result.timing,
          });
        }
      } catch (profileErr: any) {
        // Log but don't fail - fall back to legacy system
        console.error(`[fitment-search] DB-first profile lookup failed:`, profileErr?.message || profileErr);
        dbProfile = null;
      }
    }
    
    // ─────────────────────────────────────────────────────────────────────────
    // LEGACY: Build legacy profile for wheel validation (still needed for now)
    // NOTE: We always build this because downstream validation uses it
    // ─────────────────────────────────────────────────────────────────────────
    
    const db = getPool();
    await ensureFitmentTables(db);

    // Step 1: Get fitment profile from our database (legacy system)
    let profile = await buildFitmentProfile(db, Number(year), make, model, trim);
    
    // If we got a dbProfile, mark that we don't need legacy import
    if (dbProfile) {
      usedLegacyFallback = false;
      console.log(`[fitment-search] Using dbProfile, legacy profile ${profile ? 'also available' : 'not found'}`);
    }
    
    // If no legacy profile AND no dbProfile, try legacy import
    if (!profile && !dbProfile) {
      usedLegacyFallback = true;
      // On-demand import + cache (legacy)
      console.log(`[fitment-search] LEGACY Cache miss for ${year} ${make} ${model} trim=${trim || ""} -> importing from Wheel-Size`);
      const importRes = await importVehicleFitment(Number(year), make, model, {
        desiredTrim: trim,
        usMarketOnly: true,
        debug: true,
      });

      console.log(`[fitment-search] LEGACY Import result:`, {
        success: importRes.success,
        vehicleId: importRes.vehicle?.id,
        vehicleTrim: importRes.vehicle?.trim,
        vehicleSlug: importRes.vehicle?.slug,
        modSlug: importRes.modificationSlug,
        modName: importRes.modificationName,
        error: importRes.error,
      });

      if (!importRes.success) {
        return NextResponse.json({
          error: "No fitment profile found and import failed",
          importError: importRes.error,
          vehicle: { year, make, model, trim },
        }, { status: 404 });
      }

      // Rebuild profile after import (should now hit DB)
      // Add retry logic to handle potential race condition
      console.log(`[fitment-search] LEGACY Attempting to load profile with: trim=${trim}, importedSlug=${importRes.modificationSlug}`);
      
      let retries = 0;
      const maxRetries = 3;
      const retryDelayMs = 100;
      
      while (retries < maxRetries && !profile) {
        if (retries > 0) {
          console.log(`[fitment-search] Retry ${retries}/${maxRetries} after ${retryDelayMs}ms...`);
          await new Promise(r => setTimeout(r, retryDelayMs));
        }
        profile = await buildFitmentProfile(db, Number(year), make, model, trim);
        retries++;
      }
      
      if (profile) {
        console.log(`[fitment-search] Profile loaded after ${retries} attempt(s)`);
      }

      if (!profile && importRes.vehicle) {
        // Fallback: try loading by the exact vehicleId we just imported
        console.log(`[fitment-search] LEGACY Primary lookup failed, trying by vehicleId=${importRes.vehicle.id}`);
        const fitment = await db.query(
          `SELECT id FROM vehicle_fitment WHERE vehicle_id = $1`,
          [importRes.vehicle.id]
        );
        console.log(`[fitment-search] Direct fitment lookup found ${fitment.rows.length} rows`);
        
        // If fitment exists for this vehicle, our lookup is the problem
        if (fitment.rows.length > 0) {
          // Debug: what does getVehicle return for various lookup strategies?
          const debugLookup = await db.query(
            `SELECT id, year, make, model, trim, search_trim, slug 
             FROM vehicles 
             WHERE year = $1 AND make = $2 AND model = $3 
             LIMIT 5`,
            [Number(year), make, model]
          );
          console.log(`[fitment-search] DEBUG - All vehicles for ${year} ${make} ${model}:`, debugLookup.rows);
        }
      }

      if (!profile && !dbProfile) {
        return NextResponse.json({
          error: "Import succeeded but fitment profile still not found in DB",
          vehicle: { year, make, model, trim },
          debug: {
            importedVehicleId: importRes.vehicle?.id,
            importedTrim: importRes.vehicle?.trim,
            importedSlug: importRes.vehicle?.slug,
            searchedTrim: trim,
          }
        }, { status: 500 });
      }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // DB-PROFILE FALLBACK: Use dbProfile when legacy profile is unavailable
    // ═══════════════════════════════════════════════════════════════════════════
    if (!profile && dbProfile) {
      console.log(`[fitment-search] Using dbProfile fallback (no legacy profile): ${year} ${make} ${model}`);
      
      // Validate dbProfile has minimum required data
      if (!dbProfile.boltPattern) {
        console.warn(`[fitment-search] dbProfile invalid - missing boltPattern`);
        return NextResponse.json({
          results: [],
          fitment: {
            mode: "unknown",
            fitmentSource: "invalid",
            validationMode: "skipped",
            vehicle: { year: Number(year), make, model, trim: dbProfile.displayTrim },
            dbProfile: {
              modificationId: dbProfile.modificationId,
              displayTrim: dbProfile.displayTrim,
              boltPattern: null,
              centerBoreMm: dbProfile.centerBoreMm,
              oemWheelSizes: dbProfile.oemWheelSizes,
              oemTireSizes: dbProfile.oemTireSizes,
              source: dbProfile.source,
            },
          },
          summary: { 
            note: "Fitment profile invalid - missing bolt pattern",
            fitmentSource: "invalid",
            validationMode: "skipped",
          },
        });
      }
      
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
      let derivedMode: FitmentMode = "aftermarket_safe";
      let derivedVehicleType: "truck" | "suv" | "car" | undefined;
      
      if (modeParam && modeParam !== "auto") {
        derivedMode = modeParam as FitmentMode;
      } else {
        const autoResult = autoDetectFitmentMode(model!, {
          boltPattern: dbProfile.boltPattern,
          minDiameter: oemMinDiameter,
          maxWidth: oemMaxWidth,
        });
        derivedMode = autoResult.recommendedMode;
        derivedVehicleType = autoResult.vehicleType;
      }
      
      // Build derived envelope with expansion based on mode
      const expansion = EXPANSION_PRESETS[derivedMode] || EXPANSION_PRESETS.aftermarket_safe;
      
      const derivedEnvelope = {
        boltPattern: dbProfile.boltPattern,
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
      
      console.log(`[fitment-search] Derived envelope:`, {
        boltPattern: derivedEnvelope.boltPattern,
        diameter: `${derivedEnvelope.allowedMinDiameter}-${derivedEnvelope.allowedMaxDiameter}`,
        width: `${derivedEnvelope.allowedMinWidth}-${derivedEnvelope.allowedMaxWidth}`,
        offset: `${derivedEnvelope.allowedMinOffset}-${derivedEnvelope.allowedMaxOffset}`,
        mode: derivedMode,
      });
      
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
        boltPattern: dbProfile.boltPattern,
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
      
      console.log(`[fitment-search] WheelPros returned ${wpResults.length} wheels for bolt pattern ${dbProfile.boltPattern}`);
      
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
            fitmentMode: derivedMode,
            ...(debug ? {
              diameterPass: diaPass,
              widthPass,
              offsetPass,
              centerBorePass: cbPass,
            } : {}),
          },
        });
      }
      
      console.log(`[fitment-search] 📤 RESPONSE (dbProfile fallback): ${year} ${make} ${model}`, {
        boltPattern: dbProfile.boltPattern,
        wheels: passingWheels.length,
        surefit: surefitCount,
        specfit: specfitCount,
        extended: extendedCount,
        excluded: excludedCount,
      });
      
      // Build facets
      const facets = buildFacets(passingWheels);
      
      return NextResponse.json({
        results: passingWheels,
        totalCount: passingWheels.length,
        page: Number(page),
        pageSize: Number(pageSize),
        facets,
        fitment: {
          mode: derivedMode,
          modeAutoDetected: !modeParam || modeParam === "auto",
          vehicleType: derivedVehicleType,
          fitmentSource: "dbProfileFallback",
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
          fitmentSource: "dbProfileFallback",
          validationMode: "derived",
          note: "Using dbProfile fallback - legacy profile not available",
        },
        timing: debug ? { totalMs: Date.now() - t0 } : undefined,
      });
    }

    const profileMs = Date.now() - t0;
    
    // At this point, profile is guaranteed to be non-null
    // (either from DB or from import, and we returned early if neither available)
    if (!profile) {
      // This should never happen, but satisfies TypeScript
      throw new Error("Unexpected: profile is null after all fallbacks");
    }

    // Step 2: Determine fitment mode (auto-detect if not specified)
    let mode: FitmentMode;
    let modeAutoDetected = false;
    let vehicleType: "truck" | "suv" | "car" | undefined;

    if (modeParam && modeParam !== "auto") {
      mode = modeParam as FitmentMode;
    } else {
      // Auto-detect based on vehicle model and specs
      const autoResult = autoDetectFitmentMode(model!, {
        boltPattern: profile.boltPattern,
        minDiameter: profile.allowedDiameters.length > 0 ? Math.min(...profile.allowedDiameters) : undefined,
        maxWidth: profile.allowedWidths.length > 0 ? Math.max(...profile.allowedWidths) : undefined,
      });
      mode = autoResult.recommendedMode;
      vehicleType = autoResult.vehicleType;
      modeAutoDetected = true;
      console.log(`[fitment-search] Auto-detected: vehicleType=${vehicleType}, mode=${mode} for ${model}`);
    }

    // Step 3: Build aftermarket fitment envelope
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

    // Step 3: Query Wheel Pros for wheels matching bolt pattern
    const wheelProsBase = process.env.WHEELPROS_WRAPPER_URL || process.env.NEXT_PUBLIC_WHEELPROS_API_BASE_URL;
    if (!wheelProsBase) {
      return NextResponse.json({ error: "Missing WHEELPROS_WRAPPER_URL" }, { status: 500 });
    }

    const page = url.searchParams.get("page") || "1";
    const pageSize = url.searchParams.get("pageSize") || "200"; // Fetch more since we'll filter
    const brandCd = url.searchParams.get("brand_cd");
    const finish = url.searchParams.get("finish");
    const diameter = url.searchParams.get("diameter");
    const width = url.searchParams.get("width");
    const offsetMinParam = url.searchParams.get("offsetMin");
    const offsetMaxParam = url.searchParams.get("offsetMax");

    const offsetMinUser = offsetMinParam != null && String(offsetMinParam).trim() !== "" ? Number(offsetMinParam) : null;
    const offsetMaxUser = offsetMaxParam != null && String(offsetMaxParam).trim() !== "" ? Number(offsetMaxParam) : null;

    const wpParams = new URLSearchParams({
      boltPattern: profile.boltPattern,
      page,
      pageSize,
      fields: "inventory,price,images",
    });
    if (brandCd) wpParams.set("brand_cd", brandCd);
    if (finish) wpParams.set("abbreviated_finish_desc", finish);
    // Only filter diameter/width at WP level if user explicitly chose them
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

    // Step 4: Validate each wheel against fitment envelope
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

      // Only include non-excluded wheels
      // NOTE: We no longer apply additional offset filtering here - the fitment envelope
      // already handles offset validation through surefit/specfit/extended classification.
      // Client-side sorting by fitmentClass prioritizes surefit while still showing all valid options.
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
              checked: validation.checked,
              boltPatternDebug: validation.boltPatternDebug,
            } : {}),
          },
        });
      }
    }

    const validateMs = Date.now() - t0 - profileMs - envelopeMs - wpMs;

    // Step 5: Build summary stats
    const summary = summarizeValidations(allValidations);

    // Build facets from passing wheels only
    const facets = buildFacets(passingWheels);

    // ═══════════════════════════════════════════════════════════════════════════
    // RESPONSE SUMMARY LOG
    // ═══════════════════════════════════════════════════════════════════════════
    console.log(`[fitment-search] 📤 RESPONSE: ${year} ${make} ${model}`, {
      dbProfile: dbProfile ? {
        modificationId: dbProfile.modificationId,
        oemTireSizes: dbProfile.oemTireSizes,
        boltPattern: dbProfile.boltPattern,
        source: dbProfile.source,
      } : null,
      legacyEnvelope: envelope ? {
        boltPattern: envelope.boltPattern,
        oemDia: `${envelope.oemMinDiameter}-${envelope.oemMaxDiameter}`,
      } : null,
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
        fitmentSource: "legacy",
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
        // Staggered fitment info (based on vehicle's actual front/rear specs)
        staggered: profile.staggered,
        // ═══════════════════════════════════════════════════════════════════════
        // DB-FIRST PROFILE (Primary Source of Truth)
        // ═══════════════════════════════════════════════════════════════════════
        // When present, dbProfile provides canonical fitment data from our database.
        // Frontend should use dbProfile values over legacy envelope when available.
        ...(dbProfile ? {
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
        } : {}),
      },
      summary: {
        fromWheelPros: wpResults.length,
        afterFitmentFilter: passingWheels.length,
        ...summary,
        fitmentSource: "legacy",
        validationMode: "strict",
      },
      timing: debug ? {
        totalMs: Date.now() - t0,
        profileMs,
        envelopeMs,
        wpMs,
        validateMs,
      } : undefined,
      ...(debug ? {
        expansionRules: EXPANSION_PRESETS[mode],
      } : {}),
    });

  } catch (err: any) {
    console.error("[wheels/fitment-search] Error:", err);
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}

function buildFacets(wheels: any[]) {
  const brands = new Map<string, { code: string; desc: string; count: number }>();
  const finishes = new Map<string, number>();
  const diameters = new Map<string, number>();
  const widths = new Map<string, number>();
  const offsets = new Map<string, number>();
  const boltPatterns = new Map<string, number>();

  // Local helpers (avoid importing lib here)
  const normalizeBp = (bp: string) => String(bp || "").toLowerCase().replace(/[x×-]/g, "x").trim();
  const parseBps = (bp: string) => {
    const raw = String(bp || "").trim();
    if (!raw) return [] as string[];
    const parts = raw.split(/[\/,]/).map((p) => normalizeBp(p.trim())).filter(Boolean);
    return parts.length ? parts : [normalizeBp(raw)];
  };

  for (const w of wheels) {
    // Brand
    const brandCode = w.brand?.code || "";
    const brandDesc = w.brand?.description || w.brand?.parent || brandCode;
    if (brandCode) {
      const existing = brands.get(brandCode);
      if (existing) {
        existing.count++;
      } else {
        brands.set(brandCode, { code: brandCode, desc: brandDesc, count: 1 });
      }
    }

    // Finish
    const finish = w.properties?.finish || w.techfeed?.finish || "";
    if (finish) {
      finishes.set(finish, (finishes.get(finish) || 0) + 1);
    }

    // Diameter
    const dia = w.properties?.diameter;
    if (dia != null && String(dia).trim() !== "") {
      const diaKey = String(dia);
      diameters.set(diaKey, (diameters.get(diaKey) || 0) + 1);
    }

    // Width
    const wid = w.properties?.width;
    if (wid != null && String(wid).trim() !== "") {
      const widKey = String(wid);
      widths.set(widKey, (widths.get(widKey) || 0) + 1);
    }

    // Offset
    const off = w.properties?.offset;
    if (off != null && String(off).trim() !== "") {
      const offKey = String(off);
      offsets.set(offKey, (offsets.get(offKey) || 0) + 1);
    }

    // Bolt pattern (from returned wheels ONLY)
    const bpRaw = w.properties?.boltPatternMetric || w.properties?.boltPattern || "";
    const patterns = parseBps(bpRaw);
    for (const p of patterns) {
      if (!p) continue;
      boltPatterns.set(p, (boltPatterns.get(p) || 0) + 1);
    }
  }

  return {
    brand_cd: { buckets: Array.from(brands.values()).sort((a, b) => b.count - a.count) },
    abbreviated_finish_desc: {
      buckets: Array.from(finishes.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
    },
    wheel_diameter: {
      buckets: Array.from(diameters.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => Number(a.value) - Number(b.value)),
    },
    width: {
      buckets: Array.from(widths.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => Number(a.value) - Number(b.value)),
    },
    offset: {
      buckets: Array.from(offsets.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => Number(a.value) - Number(b.value)),
    },
    bolt_pattern_metric: {
      buckets: Array.from(boltPatterns.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count),
    },
  };
}
