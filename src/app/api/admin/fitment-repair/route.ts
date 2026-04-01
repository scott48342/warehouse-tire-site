import { NextRequest, NextResponse } from "next/server";
import {
  runRepairSweep,
  getQualityBreakdown,
  formatReportAsText,
} from "@/lib/fitment-db/repairService";
import { Pool } from "pg";

async function normalizeClassicDiameters() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });
  
  try {
    console.log("[admin/fitment-repair] normalizing classic diameter ranges to 15-20");
    
    const beforeResult = await pool.query(`
      SELECT DISTINCT platform_code, platform_name, rec_wheel_diameter_min, rec_wheel_diameter_max 
      FROM classic_fitments WHERE is_active = true ORDER BY platform_name
    `);

    const updateResult = await pool.query(`
      UPDATE classic_fitments SET rec_wheel_diameter_min = 15, rec_wheel_diameter_max = 20, updated_at = NOW()
      WHERE platform_code IN ('ford-mustang-1gen','gm-a-body-2','mopar-e-body','mopar-b-body','gm-f-body-2','gm-f-body-1') AND is_active = true
    `);

    const afterResult = await pool.query(`
      SELECT DISTINCT platform_code, platform_name, rec_wheel_diameter_min, rec_wheel_diameter_max 
      FROM classic_fitments WHERE is_active = true ORDER BY platform_name
    `);

    await pool.end();

    return NextResponse.json({
      success: true,
      action: "normalize_classic_diameters",
      targetRange: "15-20",
      rowsAffected: updateResult.rowCount,
      before: beforeResult.rows,
      after: afterResult.rows,
    });
  } catch (err: any) {
    await pool.end();
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

/**
 * Admin API for fitment repair operations
 * 
 * GET - Get quality breakdown / status
 * POST - Run repair sweep
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json";
    const action = searchParams.get("action");
    
    // Special action: normalize classic diameters
    if (action === "normalize-classic") {
      return await normalizeClassicDiameters();
    }
    
    console.log("[admin/fitment-repair] GET - fetching quality breakdown");
    
    const breakdown = await getQualityBreakdown();
    
    if (format === "text") {
      const lines = [
        "FITMENT QUALITY BREAKDOWN",
        "═════════════════════════",
        "",
        `Total Records: ${breakdown.total}`,
        `Valid:         ${breakdown.valid} (${((breakdown.valid / breakdown.total) * 100).toFixed(1)}%)`,
        `Partial:       ${breakdown.partial} (${((breakdown.partial / breakdown.total) * 100).toFixed(1)}%)`,
        `Invalid:       ${breakdown.invalid} (${((breakdown.invalid / breakdown.total) * 100).toFixed(1)}%)`,
        "",
        "Samples:",
        ...breakdown.samples.map(s => `  [${s.quality}] ${s.vehicle}`),
      ];
      
      return new NextResponse(lines.join("\n"), {
        headers: { "Content-Type": "text/plain" },
      });
    }
    
    return NextResponse.json(breakdown);
  } catch (err: any) {
    console.error("[admin/fitment-repair] GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    
    const {
      limit = 50,
      dryRun = false,
      yearMin,
      yearMax,
      make,
      delayMs = 500,
      format = "json",
    } = body;
    
    console.log("[admin/fitment-repair] POST - starting repair sweep", {
      limit,
      dryRun,
      yearMin,
      yearMax,
      make,
    });
    
    const report = await runRepairSweep({
      limit,
      dryRun,
      yearMin,
      yearMax,
      make,
      delayMs,
    });
    
    if (format === "text") {
      const text = formatReportAsText(report);
      return new NextResponse(text, {
        headers: { "Content-Type": "text/plain" },
      });
    }
    
    return NextResponse.json(report);
  } catch (err: any) {
    console.error("[admin/fitment-repair] POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PUT - Normalize classic diameter ranges to 15-20"
 */
export async function PUT() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });
  
  try {
    console.log("[admin/fitment-repair] PUT - normalizing classic diameter ranges");
    
    // Get before state
    const beforeResult = await pool.query(`
      SELECT DISTINCT platform_code, platform_name, rec_wheel_diameter_min, rec_wheel_diameter_max 
      FROM classic_fitments 
      WHERE is_active = true
      ORDER BY platform_name
    `);

    // Update all classic platforms to 15-20"
    const updateResult = await pool.query(`
      UPDATE classic_fitments 
      SET 
        rec_wheel_diameter_min = 15,
        rec_wheel_diameter_max = 20,
        updated_at = NOW()
      WHERE platform_code IN (
        'ford-mustang-1gen',
        'gm-a-body-2',
        'mopar-e-body',
        'mopar-b-body',
        'gm-f-body-2',
        'gm-f-body-1'
      ) AND is_active = true
    `);

    // Get after state
    const afterResult = await pool.query(`
      SELECT DISTINCT platform_code, platform_name, rec_wheel_diameter_min, rec_wheel_diameter_max 
      FROM classic_fitments 
      WHERE is_active = true
      ORDER BY platform_name
    `);

    await pool.end();

    return NextResponse.json({
      success: true,
      action: "normalize_classic_diameters",
      targetRange: "15-20",
      rowsAffected: updateResult.rowCount,
      before: beforeResult.rows,
      after: afterResult.rows,
    });
  } catch (err: any) {
    console.error("[admin/fitment-repair] PUT error:", err);
    await pool.end();
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
