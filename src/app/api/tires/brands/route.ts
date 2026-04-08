/**
 * Tire Brands API
 * Returns list of available tire brands from the database
 */

import { NextResponse } from "next/server";
import pg from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { Pool } = pg;

let pool: pg.Pool | null = null;
function getPool() {
  if (pool) return pool;
  const DATABASE_URL = process.env.POSTGRES_URL;
  if (!DATABASE_URL) throw new Error("Missing POSTGRES_URL");
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
  return pool;
}

export async function GET() {
  try {
    const db = getPool();
    
    // Get distinct brands from WheelPros tires table
    const { rows } = await db.query(`
      SELECT DISTINCT brand_desc as brand, COUNT(*) as count
      FROM wp_tires
      WHERE brand_desc IS NOT NULL AND brand_desc != ''
      GROUP BY brand_desc
      ORDER BY brand_desc ASC
    `);
    
    const brands = rows.map(r => ({
      name: r.brand,
      count: parseInt(r.count, 10),
    }));
    
    return NextResponse.json({
      brands,
      total: brands.length,
    });
  } catch (error) {
    console.error("[api/tires/brands] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch brands" },
      { status: 500 }
    );
  }
}
