import { NextResponse } from "next/server";
import { importVehicleFitment, importAllTrims } from "@/lib/fitmentImport";

export const runtime = "nodejs";

/**
 * POST /api/fitment/import
 * Import fitment data from Wheel-Size API
 * 
 * Body: { year: number, make: string, model: string, trim?: string, allTrims?: boolean, debug?: boolean }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { year, make, model, trim, allTrims, debug } = body;

    if (!year || !make || !model) {
      return NextResponse.json(
        { error: "Missing required fields: year, make, model" },
        { status: 400 }
      );
    }

    if (allTrims) {
      const result = await importAllTrims(Number(year), make, model, { debug });
      return NextResponse.json({
        success: result.results.some((r) => r.success),
        totalWheelSpecs: result.totalWheelSpecs,
        imports: result.results,
      });
    } else {
      const result = await importVehicleFitment(Number(year), make, model, trim, { debug });
      return NextResponse.json(result);
    }
  } catch (err: any) {
    console.error("[api/fitment/import] Error:", err);
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
