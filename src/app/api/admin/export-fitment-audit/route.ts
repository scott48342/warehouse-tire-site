/**
 * Fitment Trim Audit Export API
 * 
 * GET /api/admin/export-fitment-audit
 * 
 * Exports trim coverage audit as CSV for identifying vehicles with
 * missing or low trim counts.
 * 
 * Sorted by: trim_count ASC (problems first), then year DESC
 * 
 * Flags vehicles as suspicious if:
 * - trim_count = 0
 * - trim_count = 1
 * - trim is null/empty
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
 * Escape a value for CSV
 */
function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
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

// Known truck/SUV models that should have multiple trims (2WD/4WD variants)
const HD_VEHICLES = new Set([
  "silverado-1500", "silverado-2500hd", "silverado-3500hd", "silverado-2500-hd", "silverado-3500-hd",
  "f-150", "f-250", "f-350", "f-250-super-duty", "f-350-super-duty",
  "ram-1500", "ram-2500", "ram-3500", "1500", "2500", "3500",
  "sierra-1500", "sierra-2500hd", "sierra-3500hd", "sierra-2500-hd", "sierra-3500-hd",
  "tacoma", "tundra", "colorado", "canyon", "ranger", "frontier", "titan",
  "tahoe", "suburban", "yukon", "escalade", "expedition", "explorer",
  "durango", "grand-cherokee", "wrangler", "4runner", "sequoia", "pathfinder", "armada",
  "pilot", "passport", "ridgeline", "bronco",
]);

function normalizeModelSlug(model: string): string {
  return model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function isSuspicious(trimCount: number, model: string, hasEmptyTrim: boolean): boolean {
  // Always suspicious if zero trims or has empty trims
  if (trimCount === 0 || hasEmptyTrim) return true;
  
  // Trucks/SUVs with only 1 trim are suspicious (should have 2WD/4WD)
  const modelSlug = normalizeModelSlug(model);
  if (trimCount === 1 && HD_VEHICLES.has(modelSlug)) return true;
  
  return false;
}

function getSuspicionReason(trimCount: number, model: string, hasEmptyTrim: boolean): string {
  if (trimCount === 0) return "ZERO_TRIMS";
  if (hasEmptyTrim) return "EMPTY_TRIM_NAME";
  
  const modelSlug = normalizeModelSlug(model);
  if (trimCount === 1 && HD_VEHICLES.has(modelSlug)) return "LOW_TRIM_COUNT";
  
  return "";
}

export async function GET(req: Request) {
  const pool = getPool();
  
  try {
    const t0 = Date.now();
    
    // Query trim counts grouped by Y/M/M
    const { rows } = await pool.query(`
      SELECT 
        year,
        make,
        model,
        COUNT(DISTINCT modification_id) as trim_count,
        ARRAY_AGG(DISTINCT COALESCE(NULLIF(display_trim, ''), 'NO_TRIM') ORDER BY COALESCE(NULLIF(display_trim, ''), 'NO_TRIM')) as trims,
        BOOL_OR(display_trim IS NULL OR display_trim = '') as has_empty_trim
      FROM vehicle_fitments
      GROUP BY year, make, model
      ORDER BY COUNT(DISTINCT modification_id) ASC, year DESC, make ASC, model ASC
    `);
    
    const queryTime = Date.now() - t0;
    console.log(`[export-fitment-audit] Audited ${rows.length} Y/M/M combinations in ${queryTime}ms`);
    
    // Process rows to add computed columns
    const processedRows = rows.map(row => {
      const trimCount = parseInt(row.trim_count);
      const hasEmptyTrim = row.has_empty_trim === true;
      const suspicious = isSuspicious(trimCount, row.model, hasEmptyTrim);
      const reason = getSuspicionReason(trimCount, row.model, hasEmptyTrim);
      
      return {
        year: row.year,
        make: row.make,
        model: row.model,
        trim_count: trimCount,
        trims: Array.isArray(row.trims) ? row.trims.join("; ") : row.trims,
        is_suspicious: suspicious ? "TRUE" : "FALSE",
        suspicion_reason: reason,
        has_empty_trim: hasEmptyTrim ? "TRUE" : "FALSE",
      };
    });
    
    // Count stats
    const suspiciousCount = processedRows.filter(r => r.is_suspicious === "TRUE").length;
    const zeroTrimCount = processedRows.filter(r => r.trim_count === 0).length;
    const lowTrimCount = processedRows.filter(r => r.trim_count === 1).length;
    
    console.log(`[export-fitment-audit] Stats: ${zeroTrimCount} zero, ${lowTrimCount} low (1), ${suspiciousCount} suspicious`);
    
    // Define CSV columns
    const columns = [
      "year",
      "make",
      "model",
      "trim_count",
      "trims",
      "is_suspicious",
      "suspicion_reason",
      "has_empty_trim",
    ];
    
    // Generate CSV
    const csv = toCSV(processedRows, columns);
    
    // Return as downloadable CSV
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="fitment-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
        "X-Total-YMM": String(rows.length),
        "X-Suspicious-Count": String(suspiciousCount),
        "X-Zero-Trim-Count": String(zeroTrimCount),
        "X-Low-Trim-Count": String(lowTrimCount),
        "X-Query-Time-Ms": String(queryTime),
      },
    });
    
  } catch (err: any) {
    console.error("[export-fitment-audit] Error:", err?.message);
    return NextResponse.json({
      error: "Failed to export fitment audit",
      message: err?.message,
    }, { status: 500 });
  } finally {
    await pool.end();
  }
}
