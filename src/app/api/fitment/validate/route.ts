import { NextResponse } from "next/server";
import { 
  getPool, 
  buildFitmentProfile, 
  ensureFitmentTables,
  evaluateWheel,
  type WheelToValidate,
  type WheelValidation,
} from "@/lib/vehicleFitment";

export const runtime = "nodejs";

/**
 * POST /api/fitment/validate
 * Validate wheels against a vehicle's fitment profile
 * 
 * Body: {
 *   vehicle: { year: number, make: string, model: string, trim?: string },
 *   wheels: Array<{ sku: string, boltPattern?: string, centerBore?: number, diameter?: number, width?: number, offset?: number }>,
 *   debug?: boolean
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { vehicle, wheels, debug } = body;

    if (!vehicle?.year || !vehicle?.make || !vehicle?.model) {
      return NextResponse.json(
        { error: "Missing vehicle: { year, make, model }" },
        { status: 400 }
      );
    }

    if (!Array.isArray(wheels) || wheels.length === 0) {
      return NextResponse.json(
        { error: "Missing wheels array" },
        { status: 400 }
      );
    }

    const db = getPool();
    await ensureFitmentTables(db);

    const profile = await buildFitmentProfile(
      db,
      Number(vehicle.year),
      vehicle.make,
      vehicle.model,
      vehicle.trim
    );

    if (!profile) {
      return NextResponse.json(
        { 
          error: "No fitment profile found for vehicle. Import data first.",
          vehicle,
        },
        { status: 404 }
      );
    }

    // Validate each wheel
    const results: Array<{
      wheel: WheelToValidate;
      validation: WheelValidation;
    }> = [];

    const summary = {
      total: wheels.length,
      surefit: 0,
      specfit: 0,
      excluded: 0,
    };

    for (const wheel of wheels as WheelToValidate[]) {
      const validation = evaluateWheel(wheel, profile);
      results.push({ wheel, validation });

      summary[validation.fitmentClass]++;

      if (debug) {
        console.log(`[fitment/validate] ${wheel.sku}:`, validation);
      }
    }

    return NextResponse.json({
      vehicle: profile.vehicle,
      profile: {
        boltPattern: profile.boltPattern,
        centerBore: profile.centerBore,
        allowedDiameters: profile.allowedDiameters,
        allowedWidths: profile.allowedWidths,
        allowedOffsets: profile.allowedOffsets,
      },
      summary,
      results: debug ? results : results.filter((r) => r.validation.fitmentClass !== "excluded"),
      excludedSkus: debug ? undefined : results.filter((r) => r.validation.fitmentClass === "excluded").map((r) => r.wheel.sku),
    });
  } catch (err: any) {
    console.error("[api/fitment/validate] Error:", err);
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
