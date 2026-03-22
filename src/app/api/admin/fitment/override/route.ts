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
 * Create or update a fitment override
 */
export async function POST(req: Request) {
  const body = await req.json();
  const {
    modificationId,
    year,
    make,
    model,
    trim,
    boltPattern,
    centerBoreMm,
    threadSize,
    seatType,
    wheelSizes,
    tireSizes,
    offsetMin,
    offsetMax,
    notes,
    createdBy,
  } = body;

  if (!modificationId) {
    return NextResponse.json({ error: "modificationId required" }, { status: 400 });
  }

  const pool = getPool();
  try {
    // Upsert override
    const { rows } = await pool.query(`
      INSERT INTO admin_fitment_overrides (
        modification_id, year, make, model, trim,
        bolt_pattern, center_bore_mm, thread_size, seat_type,
        wheel_sizes, tire_sizes, offset_min, offset_max,
        notes, created_by, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now())
      ON CONFLICT (modification_id) DO UPDATE SET
        bolt_pattern = EXCLUDED.bolt_pattern,
        center_bore_mm = EXCLUDED.center_bore_mm,
        thread_size = EXCLUDED.thread_size,
        seat_type = EXCLUDED.seat_type,
        wheel_sizes = EXCLUDED.wheel_sizes,
        tire_sizes = EXCLUDED.tire_sizes,
        offset_min = EXCLUDED.offset_min,
        offset_max = EXCLUDED.offset_max,
        notes = EXCLUDED.notes,
        updated_at = now()
      RETURNING *
    `, [
      modificationId,
      year || null,
      make || null,
      model || null,
      trim || null,
      boltPattern || null,
      centerBoreMm || null,
      threadSize || null,
      seatType || null,
      wheelSizes ? JSON.stringify(wheelSizes) : null,
      tireSizes ? JSON.stringify(tireSizes) : null,
      offsetMin || null,
      offsetMax || null,
      notes || null,
      createdBy || "admin",
    ]);

    // Log the change
    await pool.query(`
      INSERT INTO admin_logs (log_type, vehicle_params, details)
      VALUES ('fitment_override', $1, $2)
    `, [
      JSON.stringify({ modificationId, year, make, model, trim }),
      JSON.stringify(rows[0]),
    ]);

    return NextResponse.json({ ok: true, override: rows[0] });
  } catch (err: any) {
    console.error("[admin/fitment/override] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}

/**
 * Delete a fitment override
 */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const modificationId = url.searchParams.get("modificationId");

  if (!modificationId) {
    return NextResponse.json({ error: "modificationId required" }, { status: 400 });
  }

  const pool = getPool();
  try {
    await pool.query(
      `DELETE FROM admin_fitment_overrides WHERE modification_id = $1`,
      [modificationId]
    );

    // Log the deletion
    await pool.query(`
      INSERT INTO admin_logs (log_type, vehicle_params, details)
      VALUES ('fitment_override_deleted', $1, $2)
    `, [
      JSON.stringify({ modificationId }),
      JSON.stringify({ deleted: true }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[admin/fitment/override] Delete error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}
