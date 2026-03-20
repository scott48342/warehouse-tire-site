import { NextResponse } from "next/server";
import { getPool, buildFitmentProfile, ensureFitmentTables } from "@/lib/vehicleFitment";

export const runtime = "nodejs";

/**
 * GET /api/fitment/profile?year=2024&make=Ford&model=F-150&trim=XLT
 * Get the stored fitment profile for a vehicle
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");
  const trim = url.searchParams.get("trim") || undefined;

  if (!year || !make || !model) {
    return NextResponse.json(
      { error: "Missing required params: year, make, model" },
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
          error: "No fitment profile found. Import data first via POST /api/fitment/import",
          vehicle: { year, make, model, trim },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      vehicle: profile.vehicle,
      fitment: profile.fitment,
      wheelSpecs: profile.wheelSpecs,
      derived: {
        allowedDiameters: profile.allowedDiameters,
        allowedWidths: profile.allowedWidths,
        allowedOffsets: profile.allowedOffsets,
        boltPattern: profile.boltPattern,
        centerBore: profile.centerBore,
      },
    });
  } catch (err: any) {
    console.error("[api/fitment/profile] Error:", err);
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
