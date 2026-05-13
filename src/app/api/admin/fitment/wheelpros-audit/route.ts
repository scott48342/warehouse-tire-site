/**
 * WheelPros Fitment Audit API
 * 
 * GET /api/admin/fitment/wheelpros-audit
 *   Returns audit results from latest pipeline run
 * 
 * GET /api/admin/fitment/wheelpros-audit?vehicle=2024+Ford+F-150
 *   Returns detailed results for specific vehicle
 */

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const AUDIT_FILE = path.join(
  process.cwd(),
  "scripts/wheelpros-audit-results/fitment-validation-pipeline.json"
);

export async function GET(request: NextRequest) {
  try {
    // Check if audit file exists
    if (!fs.existsSync(AUDIT_FILE)) {
      return NextResponse.json(
        { 
          error: "No audit results found",
          hint: "Run: npx tsx scripts/wheelpros-fitment-audit-pipeline.ts"
        },
        { status: 404 }
      );
    }

    const data = JSON.parse(fs.readFileSync(AUDIT_FILE, "utf-8"));
    
    // Check for vehicle filter
    const vehicleFilter = request.nextUrl.searchParams.get("vehicle");
    
    if (vehicleFilter) {
      const vehicle = data.vehicles.find((v: any) => {
        const name = `${v.vehicle.year} ${v.vehicle.make} ${v.vehicle.model}`;
        return name.toLowerCase().includes(vehicleFilter.toLowerCase());
      });
      
      if (!vehicle) {
        return NextResponse.json(
          { error: "Vehicle not found in audit", available: data.vehicles.map((v: any) => 
            `${v.vehicle.year} ${v.vehicle.make} ${v.vehicle.model}`
          )},
          { status: 404 }
        );
      }
      
      return NextResponse.json(vehicle);
    }
    
    // Return summary view
    return NextResponse.json({
      auditDate: data.auditDate,
      summary: data.summary,
      vehicles: data.vehicles.map((v: any) => ({
        vehicle: v.vehicle,
        wtdSpecs: {
          boltPattern: v.wtdSpecs.boltPattern,
          centerBoreMm: v.wtdSpecs.centerBoreMm,
          offsetRange: v.wtdSpecs.offsetMinMm != null 
            ? `${v.wtdSpecs.offsetMinMm}-${v.wtdSpecs.offsetMaxMm}mm`
            : null,
          widths: v.wtdSpecs.oemWheelWidths,
          diameters: v.wtdSpecs.oemWheelDiameters,
        },
        totalWheelsQueried: v.totalWheelsQueried,
        cleanMatches: v.cleanMatches,
        aggressiveAftermarket: v.aggressiveAftermarket,
        unsafeProducts: v.unsafeProducts,
        manualReviewNeeded: v.manualReviewNeeded,
        wtdIssues: v.wtdIssues,
      })),
    });
  } catch (error) {
    console.error("[wheelpros-audit] Error:", error);
    return NextResponse.json(
      { error: "Failed to read audit results" },
      { status: 500 }
    );
  }
}
