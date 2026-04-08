/**
 * Admin API for tire product name overrides
 * Manages corrections for abbreviated/malformed product names from suppliers
 * 
 * Table: tire_name_overrides
 * - brand: Brand name (e.g., "Venom")
 * - model_pattern: Pattern to match in raw name (e.g., "Terra Hunter MT")
 * - display_name: Clean display name to use (e.g., "Terra Hunter Mud-Terrain")
 */
import { NextResponse } from "next/server";
import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;
function getPool() {
  if (pool) return pool;
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Missing POSTGRES_URL");
  pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 3 });
  return pool;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ensure table exists
async function ensureTable() {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS tire_name_overrides (
      id SERIAL PRIMARY KEY,
      brand VARCHAR(100) NOT NULL,
      model_pattern VARCHAR(255) NOT NULL,
      display_name VARCHAR(255) NOT NULL,
      source VARCHAR(50) DEFAULT 'admin',
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(brand, model_pattern)
    )
  `);
}

// GET - List all name overrides
export async function GET(req: Request) {
  const url = new URL(req.url);
  const brand = url.searchParams.get("brand");
  const search = url.searchParams.get("search");
  
  try {
    await ensureTable();
    const db = getPool();
    
    let query = `
      SELECT id, brand, model_pattern, display_name, source, created_at
      FROM tire_name_overrides
    `;
    const params: string[] = [];
    const conditions: string[] = [];
    
    if (brand) {
      params.push(brand);
      conditions.push(`LOWER(brand) = LOWER($${params.length})`);
    }
    
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(
        LOWER(brand) LIKE LOWER($${params.length}) OR 
        LOWER(model_pattern) LIKE LOWER($${params.length}) OR
        LOWER(display_name) LIKE LOWER($${params.length})
      )`);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }
    
    query += ` ORDER BY brand ASC, model_pattern ASC`;
    
    const { rows } = await db.query(query, params);
    
    // Get unique brands
    const { rows: brandRows } = await db.query(`
      SELECT DISTINCT brand FROM tire_name_overrides ORDER BY brand
    `);
    
    return NextResponse.json({
      items: rows,
      brands: brandRows.map(r => r.brand),
      total: rows.length,
    });
  } catch (err: any) {
    console.error("[admin/tire-names] GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST - Add new name override
export async function POST(req: Request) {
  try {
    await ensureTable();
    const body = await req.json();
    const { brand, model_pattern, display_name } = body;
    
    if (!brand || !model_pattern || !display_name) {
      return NextResponse.json(
        { error: "Missing required fields: brand, model_pattern, display_name" },
        { status: 400 }
      );
    }
    
    const db = getPool();
    
    const { rows } = await db.query(`
      INSERT INTO tire_name_overrides (brand, model_pattern, display_name, source)
      VALUES ($1, $2, $3, 'admin')
      ON CONFLICT (brand, model_pattern) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        source = 'admin'
      RETURNING id, brand, model_pattern, display_name, created_at
    `, [brand.trim(), model_pattern.trim(), display_name.trim()]);
    
    return NextResponse.json({
      success: true,
      item: rows[0],
    });
  } catch (err: any) {
    console.error("[admin/tire-names] POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT - Update a name override
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, display_name } = body;
    
    if (!id || !display_name) {
      return NextResponse.json(
        { error: "Missing required fields: id, display_name" },
        { status: 400 }
      );
    }
    
    const db = getPool();
    
    const { rows, rowCount } = await db.query(`
      UPDATE tire_name_overrides
      SET display_name = $2, source = 'admin'
      WHERE id = $1
      RETURNING id, brand, model_pattern, display_name, source, created_at
    `, [id, display_name.trim()]);
    
    if (rowCount === 0) {
      return NextResponse.json({ error: "Override not found" }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      item: rows[0],
    });
  } catch (err: any) {
    console.error("[admin/tire-names] PUT error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE - Remove a name override
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    
    if (!id) {
      return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
    }
    
    const db = getPool();
    
    const { rowCount } = await db.query(`
      DELETE FROM tire_name_overrides WHERE id = $1
    `, [id]);
    
    return NextResponse.json({
      success: true,
      deleted: rowCount,
    });
  } catch (err: any) {
    console.error("[admin/tire-names] DELETE error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
