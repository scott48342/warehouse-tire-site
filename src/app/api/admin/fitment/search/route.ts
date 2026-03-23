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
 * Queries vehicle_fitments table which has year, make, model, modification_id, etc.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");

  if (!year || !make || !model) {
    return NextResponse.json({ error: "year, make, model required" }, { status: 400 });
  }

  // Normalize make/model for DB lookup (lowercase, hyphenated)
  const normalizedMake = make.toLowerCase().replace(/\s+/g, "-");
  const normalizedModel = model.toLowerCase().replace(/\s+/g, "-");

  const pool = getPool();
  try {
    // Get modifications for this Y/M/M from vehicle_fitments
    const { rows: mods } = await pool.query(`
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
      ORDER BY display_trim
    `, [parseInt(year, 10), normalizedMake, normalizedModel]);

    // Get any existing overrides for these modifications
    const modIds = mods.map((m: any) => m.modification_id).filter(Boolean);
    let overrideMap = new Map<string, any>();
    
    if (modIds.length > 0) {
      const { rows: overrides } = await pool.query(`
        SELECT * FROM admin_fitment_overrides
        WHERE modification_id = ANY($1)
      `, [modIds]);
      overrideMap = new Map(overrides.map((o: any) => [o.modification_id, o]));
    }

    // Format response
    const results = mods.map((m: any) => {
      const override = overrideMap.get(m.modification_id);

      return {
        modificationId: m.modification_id,
        trim: m.display_trim || m.raw_trim || m.submodel || "Base",
        current: {
          boltPattern: m.bolt_pattern || null,
          centerBoreMm: m.center_bore_mm ? Number(m.center_bore_mm) : null,
          threadSize: m.thread_size || null,
          seatType: m.seat_type || null,
          wheelSizes: m.oem_wheel_sizes || [],
          tireSizes: m.oem_tire_sizes || [],
          offsetMin: m.offset_min_mm ? Number(m.offset_min_mm) : null,
          offsetMax: m.offset_max_mm ? Number(m.offset_max_mm) : null,
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
