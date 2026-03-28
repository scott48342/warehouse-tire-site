/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PRODUCTION BULK FITMENT IMPORT API
 * POST /api/admin/fitment/bulk
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Features:
 * - Admin token authentication (Authorization: Bearer <ADMIN_API_TOKEN>)
 * - Backup/export existing records before import
 * - Full validation (bolt pattern, center bore, required fields)
 * - Upsert with created/updated/skipped/failed counts
 * - dryRun mode for validation without writes
 * 
 * NO WHEEL-SIZE DEPENDENCY
 * 
 * @created 2026-03-28
 */

import { NextResponse } from "next/server";
import { db, schema } from "@/lib/fitment-db/db";
import { eq, and, or, inArray, sql } from "drizzle-orm";
import {
  importFromJson,
  importFromCsv,
  validateFitmentInput,
  type FitmentInput,
} from "@/lib/fitment-db/fitmentManualImport";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes max

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════════

function authenticateRequest(req: Request): { ok: boolean; error?: string } {
  const adminToken = process.env.ADMIN_API_TOKEN;
  
  if (!adminToken) {
    console.error("[fitment/bulk] ADMIN_API_TOKEN not configured");
    return { ok: false, error: "Server not configured for API access" };
  }
  
  const authHeader = req.headers.get("authorization");
  
  if (!authHeader) {
    return { ok: false, error: "Missing Authorization header" };
  }
  
  // Support both "Bearer <token>" and raw token
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;
  
  if (token !== adminToken) {
    return { ok: false, error: "Invalid admin token" };
  }
  
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BACKUP/EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

interface BackupRecord {
  year: number;
  make: string;
  model: string;
  modificationId: string;
  displayTrim: string;
  boltPattern: string | null;
  centerBoreMm: string | null;
  threadSize: string | null;
  seatType: string | null;
  offsetMinMm: string | null;
  offsetMaxMm: string | null;
  oemWheelSizes: any;
  oemTireSizes: any;
  source: string;
  updatedAt: Date;
}

/**
 * Export existing fitment records that would be affected by the import
 */
async function backupAffectedRecords(
  records: FitmentInput[]
): Promise<{ records: BackupRecord[]; count: number }> {
  // Get unique year/make/model combinations
  const vehicles = new Map<string, { year: number; make: string; model: string }>();
  
  for (const r of records) {
    const year = typeof r.year === "number" ? r.year : parseInt(String(r.year), 10);
    const key = `${year}|${r.make.toLowerCase()}|${r.model.toLowerCase()}`;
    if (!vehicles.has(key)) {
      vehicles.set(key, {
        year,
        make: r.make.toLowerCase().replace(/\s+/g, "-"),
        model: r.model.toLowerCase().replace(/\s+/g, "-"),
      });
    }
  }
  
  if (vehicles.size === 0) {
    return { records: [], count: 0 };
  }
  
  // Build conditions for each vehicle
  const conditions = Array.from(vehicles.values()).map((v) =>
    and(
      eq(schema.vehicleFitments.year, v.year),
      eq(schema.vehicleFitments.make, v.make),
      eq(schema.vehicleFitments.model, v.model)
    )
  );
  
  // Query existing records
  const existing = await db
    .select({
      year: schema.vehicleFitments.year,
      make: schema.vehicleFitments.make,
      model: schema.vehicleFitments.model,
      modificationId: schema.vehicleFitments.modificationId,
      displayTrim: schema.vehicleFitments.displayTrim,
      boltPattern: schema.vehicleFitments.boltPattern,
      centerBoreMm: schema.vehicleFitments.centerBoreMm,
      threadSize: schema.vehicleFitments.threadSize,
      seatType: schema.vehicleFitments.seatType,
      offsetMinMm: schema.vehicleFitments.offsetMinMm,
      offsetMaxMm: schema.vehicleFitments.offsetMaxMm,
      oemWheelSizes: schema.vehicleFitments.oemWheelSizes,
      oemTireSizes: schema.vehicleFitments.oemTireSizes,
      source: schema.vehicleFitments.source,
      updatedAt: schema.vehicleFitments.updatedAt,
    })
    .from(schema.vehicleFitments)
    .where(or(...conditions));
  
  return {
    records: existing as BackupRecord[],
    count: existing.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

interface ValidationSummary {
  valid: number;
  invalid: number;
  errors: Array<{ row: number; vehicle: string; errors: string[] }>;
}

function validateAllRecords(records: FitmentInput[]): ValidationSummary {
  let valid = 0;
  let invalid = 0;
  const errors: Array<{ row: number; vehicle: string; errors: string[] }> = [];
  
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const vehicleLabel = `${r.year} ${r.make} ${r.model}`;
    const validationErrors = validateFitmentInput(r);
    
    if (validationErrors.length > 0) {
      invalid++;
      errors.push({
        row: i + 1,
        vehicle: vehicleLabel,
        errors: validationErrors.map((e) => `${e.field}: ${e.message}`),
      });
    } else {
      valid++;
    }
  }
  
  return { valid, invalid, errors };
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/admin/fitment/bulk
 * 
 * Import fitment data from JSON array.
 * 
 * Headers:
 * - Authorization: Bearer <ADMIN_API_TOKEN>
 * 
 * Body:
 * {
 *   "records": [...],       // Array of FitmentInput
 *   "dryRun": false,        // Validate without importing
 *   "includeBackup": true,  // Include backup of affected records in response
 *   "stopOnError": false,   // Stop on first validation error
 *   "source": "api_import"  // Default source for records without one
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "mode": "import" | "dryRun",
 *   "counts": { created, updated, skipped, failed, total },
 *   "backup": { records: [...], count: N },  // if includeBackup=true
 *   "validation": { valid: N, invalid: N, errors: [...] },
 *   "errors": [...]
 * }
 */
export async function POST(req: Request) {
  // Authenticate
  const auth = authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  
  try {
    const body = await req.json();
    
    // Extract options
    const dryRun = body.dryRun === true;
    const includeBackup = body.includeBackup !== false; // default true
    const stopOnError = body.stopOnError === true;
    const defaultSource = body.source || "api_import";
    
    // Validate request
    if (!body.records || !Array.isArray(body.records)) {
      return NextResponse.json(
        {
          error: "Invalid request. Provide: { records: [...] }",
          example: {
            records: [
              {
                year: 2024,
                make: "Ford",
                model: "F-150",
                trim: "XLT",
                boltPattern: "6x135",
                centerBoreMm: 87.1,
                threadSize: "M14x1.5",
                seatType: "conical",
                source: "manual",
              },
            ],
            dryRun: false,
            includeBackup: true,
          },
        },
        { status: 400 }
      );
    }
    
    const records = body.records as FitmentInput[];
    
    if (records.length === 0) {
      return NextResponse.json(
        { error: "No records provided" },
        { status: 400 }
      );
    }
    
    console.log(`[fitment/bulk] Processing ${records.length} records (dryRun=${dryRun})`);
    
    // Apply default source to records without one
    for (const r of records) {
      if (!r.source) r.source = defaultSource;
    }
    
    // Validate all records first
    const validation = validateAllRecords(records);
    
    // If there are validation errors and stopOnError is true, return early
    if (validation.invalid > 0 && stopOnError) {
      return NextResponse.json({
        success: false,
        mode: "validation_failed",
        validation,
        message: `${validation.invalid} records failed validation`,
      });
    }
    
    // Backup affected records if requested
    let backup: { records: BackupRecord[]; count: number } | null = null;
    if (includeBackup && !dryRun) {
      backup = await backupAffectedRecords(records);
      console.log(`[fitment/bulk] Backed up ${backup.count} existing records`);
    }
    
    // If dry run, don't actually import
    if (dryRun) {
      return NextResponse.json({
        success: validation.invalid === 0,
        mode: "dryRun",
        counts: {
          total: records.length,
          valid: validation.valid,
          invalid: validation.invalid,
          wouldCreate: "unknown (dry run)",
          wouldUpdate: "unknown (dry run)",
        },
        validation,
        backup: backup ? { count: backup.count } : null,
        message: `Dry run complete. ${validation.valid} records valid, ${validation.invalid} invalid.`,
      });
    }
    
    // Actually import
    const result = await importFromJson(records, {
      stopOnError,
      validateOnly: false,
    });
    
    console.log(`[fitment/bulk] Import complete: ${result.inserted} inserted, ${result.updated} updated, ${result.failed} failed`);
    
    return NextResponse.json({
      success: result.success,
      mode: "import",
      counts: {
        total: result.total,
        created: result.inserted,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed,
      },
      validation: {
        valid: validation.valid,
        invalid: validation.invalid,
      },
      backup: backup
        ? {
            count: backup.count,
            records: backup.records,
          }
        : null,
      errors: result.errors.slice(0, 50), // Limit errors in response
      message:
        result.success
          ? `Successfully imported ${result.inserted + result.updated} records (${result.inserted} created, ${result.updated} updated)`
          : `Import completed with errors. ${result.failed} records failed.`,
    });
  } catch (err) {
    console.error("[fitment/bulk] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET HANDLER - Export current fitment data
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/fitment/bulk
 * 
 * Export fitment data for backup or inspection.
 * 
 * Query params:
 * - year: Filter by year
 * - make: Filter by make
 * - model: Filter by model
 * - limit: Max records (default 1000)
 * 
 * Headers:
 * - Authorization: Bearer <ADMIN_API_TOKEN>
 */
export async function GET(req: Request) {
  // Authenticate
  const auth = authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  
  try {
    const url = new URL(req.url);
    const year = url.searchParams.get("year");
    const make = url.searchParams.get("make");
    const model = url.searchParams.get("model");
    const limit = parseInt(url.searchParams.get("limit") || "1000", 10);
    
    // Build conditions
    const conditions: any[] = [];
    
    if (year) {
      conditions.push(eq(schema.vehicleFitments.year, parseInt(year, 10)));
    }
    if (make) {
      conditions.push(eq(schema.vehicleFitments.make, make.toLowerCase().replace(/\s+/g, "-")));
    }
    if (model) {
      conditions.push(eq(schema.vehicleFitments.model, model.toLowerCase().replace(/\s+/g, "-")));
    }
    
    // Query
    let query = db
      .select({
        year: schema.vehicleFitments.year,
        make: schema.vehicleFitments.make,
        model: schema.vehicleFitments.model,
        modificationId: schema.vehicleFitments.modificationId,
        rawTrim: schema.vehicleFitments.rawTrim,
        displayTrim: schema.vehicleFitments.displayTrim,
        submodel: schema.vehicleFitments.submodel,
        boltPattern: schema.vehicleFitments.boltPattern,
        centerBoreMm: schema.vehicleFitments.centerBoreMm,
        threadSize: schema.vehicleFitments.threadSize,
        seatType: schema.vehicleFitments.seatType,
        offsetMinMm: schema.vehicleFitments.offsetMinMm,
        offsetMaxMm: schema.vehicleFitments.offsetMaxMm,
        oemWheelSizes: schema.vehicleFitments.oemWheelSizes,
        oemTireSizes: schema.vehicleFitments.oemTireSizes,
        source: schema.vehicleFitments.source,
        createdAt: schema.vehicleFitments.createdAt,
        updatedAt: schema.vehicleFitments.updatedAt,
      })
      .from(schema.vehicleFitments);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    
    const records = await query.limit(limit);
    
    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.vehicleFitments)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    
    const totalCount = countResult[0]?.count || 0;
    
    return NextResponse.json({
      records,
      count: records.length,
      totalCount,
      filters: { year, make, model },
      limit,
      truncated: records.length < totalCount,
    });
  } catch (err) {
    console.error("[fitment/bulk] GET Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
