import { NextResponse } from "next/server";
import {
  getAllVehicleData,
  getModifications,
  getVehicleData,
  resolveMakeModel,
} from "@/lib/wheelSizeApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/debug/wheelsize-raw
 * 
 * Query Wheel-Size API directly and return raw results.
 * 
 * Query params:
 * - year: Vehicle year (required)
 * - make: Vehicle make (required)
 * - model: Vehicle model (required)
 * - modification: Specific modification slug (optional)
 * - usOnly: Filter to US market only (default: true)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");
  const modification = url.searchParams.get("modification");
  const usOnly = url.searchParams.get("usOnly") !== "false";

  if (!year || !make || !model) {
    return NextResponse.json(
      { error: "Missing required params: year, make, model" },
      { status: 400 }
    );
  }

  try {
    const t0 = Date.now();

    // Resolve make/model to slugs
    const resolved = await resolveMakeModel(make, model);
    if (!resolved) {
      return NextResponse.json(
        { error: `Could not resolve make/model: ${make} ${model}` },
        { status: 404 }
      );
    }

    // Get all modifications
    const allModifications = await getModifications(
      resolved.makeSlug,
      resolved.modelSlug,
      parseInt(year, 10)
    );

    const usModifications = allModifications.filter(m => m.regions?.includes("usdm"));

    // If specific modification requested, fetch just that one
    if (modification) {
      const vehicleData = await getVehicleData(
        resolved.makeSlug,
        resolved.modelSlug,
        parseInt(year, 10),
        modification
      );

      return NextResponse.json({
        query: { year, make, model, modification },
        resolved,
        allModificationsCount: allModifications.length,
        usModificationsCount: usModifications.length,
        vehicleData,
        timing: { totalMs: Date.now() - t0 },
      });
    }

    // Otherwise, fetch data for first US modification (or first any)
    const targetMods = usOnly ? usModifications : allModifications;
    const targetMod = targetMods[0];

    if (!targetMod) {
      return NextResponse.json({
        query: { year, make, model },
        resolved,
        error: "No modifications found",
        allModifications,
        timing: { totalMs: Date.now() - t0 },
      });
    }

    const vehicleData = await getVehicleData(
      resolved.makeSlug,
      resolved.modelSlug,
      parseInt(year, 10),
      targetMod.slug
    );

    return NextResponse.json({
      query: { year, make, model, usOnly },
      resolved,
      allModificationsCount: allModifications.length,
      usModificationsCount: usModifications.length,
      selectedModification: targetMod,
      allModifications: allModifications.slice(0, 10), // First 10 for reference
      vehicleData,
      timing: { totalMs: Date.now() - t0 },
    });

  } catch (err: any) {
    console.error("[debug/wheelsize-raw] Error:", err);
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
