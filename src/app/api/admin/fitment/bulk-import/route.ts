/**
 * Bulk Fitment Import API (No Wheel-Size)
 * 
 * GET  - Get coverage stats and target vehicle list
 * POST - Import fitment data from JSON/CSV
 * 
 * NO WHEEL-SIZE DEPENDENCY
 * 
 * @created 2026-03-27
 */

import { NextResponse } from "next/server";
import {
  calculateCoverage,
  getAllTargetVehicles,
  TIER_1_VEHICLES,
  TIER_2_VEHICLES,
  TIER_3_VEHICLES,
  IMPORT_YEARS,
} from "@/lib/fitment-db/bulkImportStrategy";
import {
  importFromJson,
  importFromCsv,
  getExampleCsv,
  getExampleJson,
  type FitmentInput,
} from "@/lib/fitment-db/fitmentManualImport";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max

/**
 * GET /api/admin/fitment/bulk-import
 * Returns coverage statistics and target vehicle summary
 */
export async function GET() {
  try {
    const coverage = await calculateCoverage();
    
    return NextResponse.json({
      coverage,
      targets: {
        tier1: { 
          count: TIER_1_VEHICLES.length,
          records: TIER_1_VEHICLES.length * IMPORT_YEARS.length,
          examples: TIER_1_VEHICLES.slice(0, 10),
        },
        tier2: { 
          count: TIER_2_VEHICLES.length,
          records: TIER_2_VEHICLES.length * IMPORT_YEARS.length,
          examples: TIER_2_VEHICLES.slice(0, 10),
        },
        tier3: { 
          count: TIER_3_VEHICLES.length,
          records: TIER_3_VEHICLES.length * IMPORT_YEARS.length,
          examples: TIER_3_VEHICLES.slice(0, 10),
        },
        years: IMPORT_YEARS,
        totalVehicles: getAllTargetVehicles().length,
      },
      importFormats: {
        description: "Import via POST with JSON records or CSV string",
        jsonExample: getExampleJson().slice(0, 2),
        csvExample: getExampleCsv(),
        requiredFields: ["year", "make", "model", "boltPattern", "centerBoreMm", "source"],
      },
      note: "This endpoint does NOT use Wheel-Size API. All data must be provided in the request.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/fitment/bulk-import
 * 
 * Import fitment data from JSON or CSV.
 * 
 * Body options:
 * 1. JSON records: { records: [...] }
 * 2. CSV string: { csv: "..." }
 * 
 * Options:
 * - validateOnly: boolean - validate without inserting
 * - stopOnError: boolean - stop on first error
 * - source: string - default source for records without one
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    const validateOnly = body.validateOnly === true;
    const stopOnError = body.stopOnError === true;
    const defaultSource = body.source || "api_import";
    
    // CSV import
    if (body.csv && typeof body.csv === "string") {
      console.log("[bulk-import] CSV import started");
      
      const result = await importFromCsv(body.csv, {
        validateOnly,
        stopOnError,
        defaultSource,
      });
      
      const coverage = validateOnly ? null : await calculateCoverage();
      
      return NextResponse.json({
        mode: "csv",
        ...result,
        coverage,
      });
    }
    
    // JSON records import
    if (body.records && Array.isArray(body.records)) {
      console.log(`[bulk-import] JSON import: ${body.records.length} records`);
      
      // Apply default source to records without one
      const records = body.records.map((r: FitmentInput) => ({
        ...r,
        source: r.source || defaultSource,
      }));
      
      const result = await importFromJson(records, {
        validateOnly,
        stopOnError,
      });
      
      const coverage = validateOnly ? null : await calculateCoverage();
      
      return NextResponse.json({
        mode: "json",
        ...result,
        coverage,
      });
    }
    
    return NextResponse.json(
      {
        error: "Invalid request. Provide: { records: [...] } or { csv: '...' }",
        examples: {
          json: { 
            records: getExampleJson().slice(0, 1),
            validateOnly: false,
          },
          csv: { 
            csv: getExampleCsv(),
            validateOnly: false,
          },
        },
      },
      { status: 400 }
    );
  } catch (err) {
    console.error("[bulk-import] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
