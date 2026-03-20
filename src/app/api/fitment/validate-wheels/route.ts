import { NextResponse } from "next/server";
import {
  getPool,
  ensureFitmentTables,
  buildFitmentProfile,
} from "@/lib/vehicleFitment";
import {
  buildFitmentEnvelope,
  validateWheels,
  summarizeValidations,
  formatValidation,
  type FitmentMode,
  type WheelSpec,
  type OEMSpecs,
  EXPANSION_PRESETS,
} from "@/lib/aftermarketFitment";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/fitment/validate-wheels
 * Validate a list of wheels against a vehicle's fitment envelope
 * 
 * Body: {
 *   year: number,
 *   make: string,
 *   model: string,
 *   trim?: string,
 *   mode?: "oem" | "aftermarket_safe" | "aggressive",
 *   wheels: Array<{
 *     sku: string,
 *     boltPattern?: string,
 *     centerBore?: number,
 *     diameter?: number,
 *     width?: number,
 *     offset?: number,
 *   }>,
 *   debug?: boolean,
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      year,
      make,
      model,
      trim,
      mode = "aftermarket_safe",
      wheels,
      debug = false,
    } = body;

    if (!year || !make || !model) {
      return NextResponse.json(
        { error: "Missing required fields: year, make, model" },
        { status: 400 }
      );
    }

    if (!wheels || !Array.isArray(wheels) || wheels.length === 0) {
      return NextResponse.json(
        { error: "Missing or empty wheels array" },
        { status: 400 }
      );
    }

    // Validate mode
    if (!["oem", "aftermarket_safe", "aggressive", "truck"].includes(mode)) {
      return NextResponse.json(
        { error: `Invalid mode: ${mode}. Must be oem, aftermarket_safe, aggressive, or truck` },
        { status: 400 }
      );
    }

    const db = getPool();
    await ensureFitmentTables(db);

    // Get vehicle fitment profile from database
    const profile = await buildFitmentProfile(db, Number(year), make, model, trim);

    if (!profile) {
      return NextResponse.json(
        {
          error: "Vehicle fitment profile not found. Import data first via POST /api/fitment/import",
          vehicle: { year, make, model, trim },
        },
        { status: 404 }
      );
    }

    // Build OEM specs from profile
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

    // Build envelope with expansion rules
    const envelope = buildFitmentEnvelope(oemSpecs, mode as FitmentMode);

    // Validate all wheels
    const validations = validateWheels(wheels as WheelSpec[], envelope);

    // Generate summary
    const summary = summarizeValidations(validations);

    // Build response
    const response: any = {
      success: true,
      vehicle: {
        year: profile.vehicle.year,
        make: profile.vehicle.make,
        model: profile.vehicle.model,
        trim: profile.vehicle.trim,
      },
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
      summary,
      validations: validations.map((v) => ({
        sku: v.sku,
        fitmentClass: v.fitmentClass,
        boltPatternPass: v.boltPatternPass,
        centerBorePass: v.centerBorePass,
        diameterPass: v.diameterPass,
        widthPass: v.widthPass,
        offsetPass: v.offsetPass,
        exclusionReasons: v.exclusionReasons,
        ...(debug ? { checked: v.checked, envelope: v.envelope } : {}),
      })),
    };

    if (debug) {
      response.debugLog = validations.map(formatValidation);
      response.expansionRules = EXPANSION_PRESETS[mode as FitmentMode];
    }

    return NextResponse.json(response);
  } catch (err: any) {
    console.error("[api/fitment/validate-wheels] Error:", err);
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/fitment/validate-wheels?year=2024&make=Ford&model=F-150&mode=aftermarket_safe
 * Get the fitment envelope for a vehicle (without validating any wheels)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
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

    const profile = await buildFitmentProfile(db, Number(year), make, model, trim);

    if (!profile) {
      return NextResponse.json(
        {
          error: "Vehicle fitment profile not found",
          vehicle: { year, make, model, trim },
        },
        { status: 404 }
      );
    }

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

    return NextResponse.json({
      success: true,
      vehicle: {
        year: profile.vehicle.year,
        make: profile.vehicle.make,
        model: profile.vehicle.model,
        trim: profile.vehicle.trim,
      },
      mode,
      envelope: {
        boltPattern: envelope.boltPattern,
        centerBore: envelope.centerBore,
        studHoles: envelope.studHoles,
        pcd: envelope.pcd,
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
      expansionRules: EXPANSION_PRESETS[mode],
    });
  } catch (err: any) {
    console.error("[api/fitment/validate-wheels] GET Error:", err);
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
