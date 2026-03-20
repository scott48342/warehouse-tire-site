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
 * - debug: Include validation details
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";
  const t0 = Date.now();

  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");
  const trim = url.searchParams.get("trim") || undefined;
  const mode = (url.searchParams.get("mode") || "aftermarket_safe") as FitmentMode;

  if (!year || !make || !model) {
    return NextResponse.json(
      { error: "Missing required params: year, make, model" },
      { status: 400 }
    );
  }

  if (!["oem", "aftermarket_safe", "aggressive", "truck"].includes(mode)) {
    return NextResponse.json(
      { error: `Invalid mode: ${mode}. Must be oem, aftermarket_safe, aggressive, or truck` },
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
        debug: false,
      });

      if (!importRes.success) {
        return NextResponse.json({
          error: "No fitment profile found and import failed",
          importError: importRes.error,
          vehicle: { year, make, model, trim },
        }, { status: 404 });
      }

      // Rebuild profile after import (should now hit DB)
      profile = await buildFitmentProfile(db, Number(year), make, model, trim);

      if (!profile) {
        return NextResponse.json({
          error: "Import succeeded but fitment profile still not found in DB",
          vehicle: { year, make, model, trim },
        }, { status: 500 });
      }
    }

    const profileMs = Date.now() - t0;

    // Step 2: Build aftermarket fitment envelope
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
    if (dia) {
      const diaKey = String(dia);
      diameters.set(diaKey, (diameters.get(diaKey) || 0) + 1);
    }

    // Width
    const wid = w.properties?.width;
    if (wid) {
      const widKey = String(wid);
      widths.set(widKey, (widths.get(widKey) || 0) + 1);
    }
  }

  return {
    brand_cd: { buckets: Array.from(brands.values()).sort((a, b) => b.count - a.count) },
    abbreviated_finish_desc: { buckets: Array.from(finishes.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count) },
    wheel_diameter: { buckets: Array.from(diameters.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => Number(a.value) - Number(b.value)) },
    width: { buckets: Array.from(widths.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => Number(a.value) - Number(b.value)) },
  };
}
