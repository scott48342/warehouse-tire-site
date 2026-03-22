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
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");

  if (!year || !make || !model) {
    return NextResponse.json({ error: "year, make, model required" }, { status: 400 });
  }

  const pool = getPool();
  try {
    // Get modifications for this Y/M/M
    const { rows: mods } = await pool.query(`
      SELECT DISTINCT
        m.modification_id,
        m.trim_display,
        m.wheel_info,
        m.tire_info,
        m.generation
      FROM fitment_modifications m
      JOIN fitment_models mo ON mo.model_id = m.model_id
      JOIN fitment_makes mk ON mk.make_id = mo.make_id
      WHERE m.year = $1
        AND mk.name ILIKE $2
        AND mo.name ILIKE $3
      ORDER BY m.trim_display
    `, [year, make, model]);

    // Get any existing overrides for these modifications
    const modIds = mods.map((m: any) => m.modification_id);
    const { rows: overrides } = await pool.query(`
      SELECT * FROM admin_fitment_overrides
      WHERE modification_id = ANY($1)
    `, [modIds]);

    const overrideMap = new Map(overrides.map((o: any) => [o.modification_id, o]));

    // Format response
    const results = mods.map((m: any) => {
      const wheelInfo = m.wheel_info || {};
      const tireInfo = m.tire_info || {};
      const override = overrideMap.get(m.modification_id);

      return {
        modificationId: m.modification_id,
        trim: m.trim_display || m.generation || "Base",
        current: {
          boltPattern: wheelInfo.bolt_pattern || null,
          centerBoreMm: wheelInfo.center_bore_mm || null,
          threadSize: wheelInfo.thread_size || null,
          seatType: wheelInfo.seat_type || null,
          wheelSizes: wheelInfo.sizes || [],
          tireSizes: tireInfo.sizes || [],
          offsetMin: wheelInfo.offset_min || null,
          offsetMax: wheelInfo.offset_max || null,
        },
        override: override ? {
          id: override.id,
          boltPattern: override.bolt_pattern,
          centerBoreMm: override.center_bore_mm,
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

    return NextResponse.json({
      year,
      make,
      model,
      modifications: results,
    });
  } catch (err: any) {
    console.error("[admin/fitment/search] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}
