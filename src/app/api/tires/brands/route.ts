/**
 * Tire Brands API
 * Returns list of available tire brands from WheelPros inventory
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
    
    // Get distinct brands from WheelPros tires (those with any inventory)
    // Count = number of SKUs with qty > 0
    const { rows } = await db.query(`
      SELECT t.brand_desc as brand, COUNT(DISTINCT t.sku) as count
      FROM wp_tires t
      JOIN wp_inventory i ON i.sku = t.sku 
        AND i.product_type = 'tire' 
        AND i.location_id = 'TOTAL'
      WHERE t.brand_desc IS NOT NULL 
        AND t.brand_desc != ''
        AND COALESCE(i.qoh, 0) > 0
      GROUP BY t.brand_desc
      ORDER BY count DESC, t.brand_desc ASC
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
