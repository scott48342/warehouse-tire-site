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
 * Get Y/M/M dropdown values for fitment search
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type"); // years, makes, models
  const year = url.searchParams.get("year");
  const make = url.searchParams.get("make");

  const pool = getPool();
  try {
    if (type === "years") {
      const { rows } = await pool.query(`
        SELECT DISTINCT year FROM fitment_modifications
        WHERE year IS NOT NULL
        ORDER BY year DESC
      `);
      return NextResponse.json({ years: rows.map((r: any) => r.year) });
    }

    if (type === "makes" && year) {
      const { rows } = await pool.query(`
        SELECT DISTINCT mk.name
        FROM fitment_makes mk
        JOIN fitment_models mo ON mo.make_id = mk.make_id
        JOIN fitment_modifications m ON m.model_id = mo.model_id
        WHERE m.year = $1
        ORDER BY mk.name
      `, [year]);
      return NextResponse.json({ makes: rows.map((r: any) => r.name) });
    }

    if (type === "models" && year && make) {
      const { rows } = await pool.query(`
        SELECT DISTINCT mo.name
        FROM fitment_models mo
        JOIN fitment_makes mk ON mk.make_id = mo.make_id
        JOIN fitment_modifications m ON m.model_id = mo.model_id
        WHERE m.year = $1
          AND mk.name ILIKE $2
        ORDER BY mo.name
      `, [year, make]);
      return NextResponse.json({ models: rows.map((r: any) => r.name) });
    }

    return NextResponse.json({ error: "Invalid type or missing params" }, { status: 400 });
  } catch (err: any) {
    console.error("[admin/fitment/ymm] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}
