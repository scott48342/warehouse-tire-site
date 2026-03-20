import { NextResponse } from "next/server";
import { 
  importVehicleFitment, 
  importAllVehicleVariants,
  listAvailableModifications,
} from "@/lib/fitmentImport";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/fitment/import?year=2024&make=Ford&model=F-150
 * List available modifications for a vehicle (preview before import)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");
  const usMarketOnly = url.searchParams.get("usMarketOnly") !== "false";

  if (!year || !make || !model) {
    return NextResponse.json(
      { error: "Missing required params: year, make, model" },
      { status: 400 }
    );
  }

  const result = await listAvailableModifications(
    Number(year),
    make,
    model,
    { usMarketOnly }
  );

  return NextResponse.json(result, { status: result.success ? 200 : 404 });
}

/**
 * POST /api/fitment/import
 * Import fitment data from Wheel-Size API
 * 
 * Body: { 
 *   year: number, 
 *   make: string, 
 *   model: string, 
 *   modificationSlug?: string,  // Specific engine variant slug
 *   allVariants?: boolean,      // Import all engine variants
 *   usMarketOnly?: boolean,     // Filter to US market (default: true)
 *   debug?: boolean             // Include raw API response
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      year, 
      make, 
      model, 
      desiredTrim,
      modificationSlug,
      allVariants = false, 
      usMarketOnly = true,
      debug = false,
    } = body;

    if (!year || !make || !model) {
      return NextResponse.json(
        { error: "Missing required fields: year, make, model" },
        { status: 400 }
      );
    }

    if (allVariants) {
      // Import all engine variants
      const result = await importAllVehicleVariants(
        Number(year), 
        make, 
        model, 
        { usMarketOnly, debug }
      );
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    } else {
      // Import single variant (first USDM if no specific slug provided)
      const result = await importVehicleFitment(
        Number(year), 
        make, 
        model, 
        { desiredTrim, modificationSlug, usMarketOnly, debug }
      );
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }
  } catch (err: any) {
    console.error("[api/fitment/import] Error:", err);
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
