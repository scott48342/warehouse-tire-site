import { NextResponse } from "next/server";
import { 
  getPool, 
  buildFitmentProfile, 
  ensureFitmentTables,
} from "@/lib/vehicleFitment";
import { importVehicleFitment } from "@/lib/fitmentImport";
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
  // Prefer modificationId over trim for canonical fitment identity
  const modification = url.searchParams.get("modification") || undefined;
  const trim = url.searchParams.get("trim") || modification || undefined;
  const modeParam = url.searchParams.get("mode"); // may be null for auto-detect
  
  // Log modificationId usage
  if (modification) {
    console.log(`[fitment-search] Using modificationId: ${modification} for ${year} ${make} ${model}`);
  }

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
    const db = getPool();
    await ensureFitmentTables(db);

    // Step 1: Get fitment profile from our database
    let profile = await buildFitmentProfile(db, Number(year), make, model, trim);

    if (!profile) {
      // On-demand import + cache
      console.log(`[fitment-search] Cache miss for ${year} ${make} ${model} trim=${trim || ""} -> importing from Wheel-Size`);
      const importRes = await importVehicleFitment(Number(year), make, model, {
        desiredTrim: trim,
        usMarketOnly: true,
        debug: true,  // Enable debug to see imported values
      });

      console.log(`[fitment-search] Import result:`, {
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
      // NOTE: We now try BOTH the imported slug AND the user's trim
      console.log(`[fitment-search] Attempting to load profile with: trim=${trim}, importedSlug=${importRes.modificationSlug}`);
      profile = await buildFitmentProfile(db, Number(year), make, model, trim);

      if (!profile && importRes.vehicle) {
        // Fallback: try loading by the exact vehicleId we just imported
        console.log(`[fitment-search] Primary lookup failed, trying by vehicleId=${importRes.vehicle.id}`);
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

      if (!profile) {
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

    const profileMs = Date.now() - t0;

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
      },
      summary: {
        fromWheelPros: wpResults.length,
        afterFitmentFilter: passingWheels.length,
        ...summary,
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
