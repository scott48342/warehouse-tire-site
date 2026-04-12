/**
 * Full Fitment Export API
 * 
 * GET /api/admin/export-fitments
 * 
 * Exports complete fitment data as CSV for debugging and validation.
 * Sorted by: year DESC, make ASC, model ASC, trim ASC
 */

import { NextResponse } from "next/server";
import pg from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { Pool } = pg;

function getPool() {
  return new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
}

/**
 * Escape a value for CSV (handle commas, quotes, newlines)
 */
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert array of objects to CSV string
 */
function toCSV(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(",");
  const lines = rows.map(row => 
    columns.map(col => escapeCSV(row[col])).join(",")
  );
  return [header, ...lines].join("\n");
}

export async function GET(req: Request) {
  const pool = getPool();
  
  try {
    const t0 = Date.now();
    
    // Query full fitment data with efficient field selection
    const { rows } = await pool.query(`
      SELECT 
        year,
        make,
        model,
        COALESCE(NULLIF(display_trim, ''), 'NO_TRIM') as trim,
        modification_id,
        bolt_pattern,
        center_bore_mm,
        thread_size,
        seat_type,
        offset_min_mm,
        offset_max_mm,
        oem_wheel_sizes::text as wheel_sizes,
        oem_tire_sizes::text as tire_sizes,
        source,
        created_at,
        updated_at
      FROM vehicle_fitments
      ORDER BY year DESC, make ASC, model ASC, display_trim ASC
    `);
    
    const queryTime = Date.now() - t0;
    console.log(`[export-fitments] Exported ${rows.length} rows in ${queryTime}ms`);
    
    // Define CSV columns
    const columns = [
      "year",
      "make", 
      "model",
      "trim",
      "modification_id",
      "bolt_pattern",
      "center_bore_mm",
      "thread_size",
      "seat_type",
      "offset_min_mm",
      "offset_max_mm",
      "wheel_sizes",
      "tire_sizes",
      "source",
      "created_at",
      "updated_at",
    ];
    
    // Generate CSV
    const csv = toCSV(rows, columns);
    
    // Return as downloadable CSV
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="fitment-export-${new Date().toISOString().slice(0, 10)}.csv"`,
        "X-Total-Rows": String(rows.length),
        "X-Query-Time-Ms": String(queryTime),
      },
    });
    
  } catch (err: any) {
    console.error("[export-fitments] Error:", err?.message);
    return NextResponse.json({
      error: "Failed to export fitments",
      message: err?.message,
    }, { status: 500 });
  } finally {
    await pool.end();
  }
}
