import { NextResponse } from "next/server";
import pg from "pg";

export const runtime = "nodejs";

const { Pool } = pg;

function getPool() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("Missing DATABASE_URL");
  return new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
}

/**
 * Search vehicles by Y/M/M and return modifications with fitment data
 * 
 * Two modes:
 * 1. With modificationId param: Look up specific modification
 * 2. Without: Fetch trims from storefront API, join with DB data
 * 
 * Flow:
 * - Trims come from /api/vehicles/trims (Wheel-Size API, full coverage)
 * - Current fitment data comes from vehicle_fitments (may not exist)
 * - Overrides come from admin_fitment_overrides
 * - If vehicle not in DB, current data is empty but override can be created
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");
  const modificationId = url.searchParams.get("modificationId");

  if (!year || !make || !model) {
    return NextResponse.json({ error: "year, make, model required" }, { status: 400 });
  }

  // Normalize make/model for DB lookup (lowercase, hyphenated)
  const normalizedMake = make.toLowerCase().replace(/\s+/g, "-");
  const normalizedModel = model.toLowerCase().replace(/\s+/g, "-");

  const pool = getPool();
  
  try {
    // -------------------------------------------------------------------------
    // Step 1: Get trims from storefront API (full coverage)
    // -------------------------------------------------------------------------
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : "http://localhost:3000";
    
    const trimsUrl = new URL("/api/vehicles/trims", baseUrl);
    trimsUrl.searchParams.set("year", year);
    trimsUrl.searchParams.set("make", make);
    trimsUrl.searchParams.set("model", model);

    const trimsRes = await fetch(trimsUrl.toString(), { cache: "no-store" });
    let trims: Array<{ value: string; label: string; modificationId: string }> = [];
    
    if (trimsRes.ok) {
      const trimsData = await trimsRes.json();
      trims = (trimsData.results || []).map((t: any) => ({
        value: t.value,
        label: t.label,
        modificationId: t.modificationId || t.value,
      }));
    }

    // If specific modificationId requested, filter to just that
    if (modificationId) {
      trims = trims.filter(t => t.modificationId === modificationId);
      // If not found in API, create a placeholder
      if (trims.length === 0) {
        trims = [{ value: modificationId, label: modificationId, modificationId }];
      }
    }

    // -------------------------------------------------------------------------
    // Step 2: Get existing fitment data from vehicle_fitments (may be partial)
    // -------------------------------------------------------------------------
    const modIds = trims.map(t => t.modificationId);
    
    const { rows: dbFitments } = await pool.query(`
      SELECT 
        modification_id,
        display_trim,
        raw_trim,
        submodel,
        bolt_pattern,
        center_bore_mm,
        thread_size,
        seat_type,
        offset_min_mm,
        offset_max_mm,
        oem_wheel_sizes,
        oem_tire_sizes
      FROM vehicle_fitments
      WHERE year = $1
        AND make ILIKE $2
        AND model ILIKE $3
        AND modification_id = ANY($4)
    `, [parseInt(year, 10), normalizedMake, normalizedModel, modIds]);

    const dbMap = new Map(dbFitments.map((f: any) => [f.modification_id, f]));

    // -------------------------------------------------------------------------
    // Step 3: Get any existing overrides for these modifications
    // -------------------------------------------------------------------------
    let overrideMap = new Map<string, any>();
    
    if (modIds.length > 0) {
      const { rows: overrides } = await pool.query(`
        SELECT * FROM admin_fitment_overrides
        WHERE modification_id = ANY($1)
      `, [modIds]);
      overrideMap = new Map(overrides.map((o: any) => [o.modification_id, o]));
    }

    // -------------------------------------------------------------------------
    // Step 4: Format response - merge API trims with DB data and overrides
    // -------------------------------------------------------------------------
    const results = trims.map((trim) => {
      const dbData = dbMap.get(trim.modificationId);
      const override = overrideMap.get(trim.modificationId);

      // Determine data source for diagnostics
      let dataSource: "override" | "db" | "api" | "none" = "none";
      if (override) dataSource = "override";
      else if (dbData) dataSource = "db";
      else if (trims.length > 0) dataSource = "api";

      return {
        modificationId: trim.modificationId,
        trim: trim.label,
        hasDbData: !!dbData,
        hasOverride: !!override,
        dataSource,
        current: dbData ? {
          boltPattern: dbData.bolt_pattern || null,
          centerBoreMm: dbData.center_bore_mm ? Number(dbData.center_bore_mm) : null,
          threadSize: dbData.thread_size || null,
          seatType: dbData.seat_type || null,
          wheelSizes: dbData.oem_wheel_sizes || [],
          tireSizes: dbData.oem_tire_sizes || [],
          offsetMin: dbData.offset_min_mm ? Number(dbData.offset_min_mm) : null,
          offsetMax: dbData.offset_max_mm ? Number(dbData.offset_max_mm) : null,
        } : {
          // No DB data - show empty fields
          boltPattern: null,
          centerBoreMm: null,
          threadSize: null,
          seatType: null,
          wheelSizes: [],
          tireSizes: [],
          offsetMin: null,
          offsetMax: null,
        },
        override: override ? {
          id: override.id,
          boltPattern: override.bolt_pattern,
          centerBoreMm: override.center_bore_mm ? Number(override.center_bore_mm) : null,
          threadSize: override.thread_size,
          seatType: override.seat_type,
          wheelSizes: override.wheel_sizes,
          tireSizes: override.tire_sizes,
          offsetMin: override.offset_min,
          offsetMax: override.offset_max,
          notes: override.notes,
          updatedAt: override.updated_at,
          createdBy: override.created_by,
        } : null,
      };
    });

    // Build diagnostics
    const diagnostics = {
      trimsFromApi: trims.length,
      trimsWithDbData: dbFitments.length,
      trimsWithOverride: overrideMap.size,
      trimsWithNoData: results.filter(r => !r.hasDbData && !r.hasOverride).length,
      issues: [] as string[],
    };

    // Identify potential issues
    if (trims.length === 0) {
      diagnostics.issues.push("No trims found for this vehicle");
    }
    if (dbFitments.length === 0 && overrideMap.size === 0) {
      diagnostics.issues.push("No fitment data in database - vehicle may not have been imported");
    }
    if (trims.length > 0 && dbFitments.length === 0) {
      diagnostics.issues.push("API has trims but no local fitment data - consider importing");
    }

    return NextResponse.json({
      year,
      make,
      model,
      trimCount: trims.length,
      dbMatchCount: dbFitments.length,
      overrideCount: overrideMap.size,
      modifications: results,
      diagnostics,
    });
  } catch (err: any) {
    console.error("[admin/fitment/search] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}
