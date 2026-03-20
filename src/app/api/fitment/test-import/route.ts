import { NextResponse } from "next/server";
import { 
  importVehicleFitment, 
  importAllVehicleVariants,
} from "@/lib/fitmentImport";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/fitment/test-import?year=2024&make=Ford&model=F-150&allVariants=true
 * Test endpoint to run imports via GET (for easier testing)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");
  const modificationSlug = url.searchParams.get("mod") || undefined;
  const allVariants = url.searchParams.get("allVariants") === "true";
  const usMarketOnly = url.searchParams.get("usMarketOnly") !== "false";
  const debug = url.searchParams.get("debug") === "true";

  if (!year || !make || !model) {
    return NextResponse.json(
      { error: "Missing required params: year, make, model" },
      { status: 400 }
    );
  }

  try {
    if (allVariants) {
      const result = await importAllVehicleVariants(
        Number(year),
        make,
        model,
        { usMarketOnly, debug }
      );
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    } else {
      const result = await importVehicleFitment(
        Number(year),
        make,
        model,
        { modificationSlug, usMarketOnly, debug }
      );
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }
  } catch (err: any) {
    console.error("[test-import] Error:", err);
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
