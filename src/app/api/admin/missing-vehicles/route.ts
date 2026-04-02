/**
 * Admin API: Missing Vehicles Report
 * 
 * GET /api/admin/missing-vehicles
 * 
 * Returns a list of vehicles that users have searched for but don't have
 * fitment data in our database. Useful for prioritizing data entry.
 */

import { NextResponse } from "next/server";
import { getTopMissingVehicles, clearMissingVehicle } from "@/lib/missingVehicleLogger";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || "50")));
    
    const missingVehicles = await getTopMissingVehicles(limit);
    
    return NextResponse.json({
      success: true,
      count: missingVehicles.length,
      vehicles: missingVehicles,
      description: "Vehicles searched by users but not found in fitment database. Sorted by search count (descending).",
    });
  } catch (err: any) {
    console.error("[admin/missing-vehicles] Error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/missing-vehicles
 * 
 * Clears a vehicle from the missing list (e.g., after adding to database).
 * 
 * Body: { year: number, make: string, model: string }
 */
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { year, make, model } = body;
    
    if (!year || !make || !model) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: year, make, model" },
        { status: 400 }
      );
    }
    
    await clearMissingVehicle(year, make, model);
    
    return NextResponse.json({
      success: true,
      message: `Cleared missing vehicle entry for ${year} ${make} ${model}`,
    });
  } catch (err: any) {
    console.error("[admin/missing-vehicles] DELETE error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
