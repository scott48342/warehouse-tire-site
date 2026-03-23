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
 * Queries vehicle_fitments table which has year, make, model columns
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
        SELECT DISTINCT year FROM vehicle_fitments
        WHERE year IS NOT NULL
        ORDER BY year DESC
      `);
      return NextResponse.json({ years: rows.map((r: any) => String(r.year)) });
    }

    if (type === "makes" && year) {
      const { rows } = await pool.query(`
        SELECT DISTINCT make
        FROM vehicle_fitments
        WHERE year = $1
        ORDER BY make
      `, [parseInt(year, 10)]);
      // Return properly cased makes (capitalize first letter)
      return NextResponse.json({
        makes: rows.map((r: any) =>
          r.make.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
        ),
      });
    }

    if (type === "models" && year && make) {
      // Normalize make for comparison (lowercase, hyphenated)
      const normalizedMake = make.toLowerCase().replace(/\s+/g, "-");
      const { rows } = await pool.query(`
        SELECT DISTINCT model
        FROM vehicle_fitments
        WHERE year = $1
          AND make ILIKE $2
        ORDER BY model
      `, [parseInt(year, 10), normalizedMake]);
      // Return properly cased models
      return NextResponse.json({
        models: rows.map((r: any) =>
          r.model.split("-").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
        ),
      });
    }

    return NextResponse.json({ error: "Invalid type or missing params" }, { status: 400 });
  } catch (err: any) {
    console.error("[admin/fitment/ymm] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}
