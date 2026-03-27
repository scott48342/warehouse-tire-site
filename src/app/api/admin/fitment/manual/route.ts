/**
 * Manual Fitment Entry API
 * 
 * POST - Add/update fitment records (single or bulk)
 * GET  - Get example formats
 * 
 * NO WHEEL-SIZE DEPENDENCY
 * 
 * @created 2026-03-27
 */

import { NextResponse } from "next/server";
import {
  upsertFitment,
  importFromJson,
  importFromCsv,
  getExampleCsv,
  getExampleJson,
  validateFitmentInput,
  type FitmentInput,
} from "@/lib/fitment-db/fitmentManualImport";
import { calculateCoverage } from "@/lib/fitment-db/bulkImportStrategy";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes for bulk imports

/**
 * GET /api/admin/fitment/manual
 * Returns example formats and current coverage
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format");
  
  if (format === "csv") {
    return new NextResponse(getExampleCsv(), {
      headers: { "Content-Type": "text/csv" },
    });
  }
  
  try {
    const coverage = await calculateCoverage();
    
    return NextResponse.json({
      examples: {
        json: getExampleJson(),
        csv: getExampleCsv(),
      },
      requiredFields: [
        "year",
        "make", 
        "model",
        "boltPattern",
        "centerBoreMm",
        "source",
      ],
      optionalFields: [
        "trim",
        "displayTrim",
        "submodel",
        "threadSize",
        "seatType",
        "wheelDiameterMin",
        "wheelDiameterMax",
        "wheelWidthMin",
        "wheelWidthMax",
        "offsetMinMm",
        "offsetMaxMm",
        "oemWheelSizes",
        "oemTireSizes",
        "sourceNotes",
        "confidence",
        "modificationId",
      ],
      validSeatTypes: ["conical", "ball", "flat", "mag"],
      validConfidence: ["high", "medium", "low"],
      coverage,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/fitment/manual
 * 
 * Accepts:
 * - Single record: { year, make, model, ... }
 * - Bulk JSON: { records: [...] }
 * - CSV string: { csv: "year,make,model,..." }
 * 
 * Options:
 * - validateOnly: boolean - just validate, don't insert
 * - stopOnError: boolean - stop on first error
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    const validateOnly = body.validateOnly === true;
    const stopOnError = body.stopOnError === true;
    
    // CSV import
    if (body.csv && typeof body.csv === "string") {
      console.log("[manual-fitment] CSV import started");
      
      const result = await importFromCsv(body.csv, {
        validateOnly,
        stopOnError,
        defaultSource: body.source || "csv_import",
      });
      
      const coverage = validateOnly ? null : await calculateCoverage();
      
      return NextResponse.json({
        mode: "csv",
        ...result,
        coverage,
      });
    }
    
    // Bulk JSON import
    if (body.records && Array.isArray(body.records)) {
      console.log(`[manual-fitment] Bulk import: ${body.records.length} records`);
      
      const result = await importFromJson(body.records, {
        validateOnly,
        stopOnError,
      });
      
      const coverage = validateOnly ? null : await calculateCoverage();
      
      return NextResponse.json({
        mode: "bulk",
        ...result,
        coverage,
      });
    }
    
    // Single record
    if (body.year && body.make && body.model) {
      console.log(`[manual-fitment] Single record: ${body.year} ${body.make} ${body.model}`);
      
      // Validate only?
      if (validateOnly) {
        const errors = validateFitmentInput(body as FitmentInput);
        return NextResponse.json({
          mode: "single",
          valid: errors.length === 0,
          errors,
        });
      }
      
      const result = await upsertFitment(body as FitmentInput);
      const coverage = result.success ? await calculateCoverage() : null;
      
      return NextResponse.json({
        mode: "single",
        ...result,
        coverage,
      });
    }
    
    return NextResponse.json(
      { 
        error: "Invalid request. Provide: single record {year, make, model, ...}, bulk {records: [...]}, or CSV {csv: '...'}",
        examples: {
          single: { year: 2024, make: "Ford", model: "F-150", boltPattern: "6x135", centerBoreMm: 87.1, source: "manual" },
          bulk: { records: [{ year: 2024, make: "Ford", model: "F-150", boltPattern: "6x135", centerBoreMm: 87.1, source: "manual" }] },
          csv: { csv: "year,make,model,bolt_pattern,center_bore_mm,source\n2024,Ford,F-150,6x135,87.1,manual" },
        },
      },
      { status: 400 }
    );
  } catch (err) {
    console.error("[manual-fitment] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
