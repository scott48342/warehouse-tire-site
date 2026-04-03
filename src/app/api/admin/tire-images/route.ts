/**
 * Admin API for tire model images
 * Manages brand+model → image mappings
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

// GET - List all tire model images
export async function GET(req: Request) {
  const url = new URL(req.url);
  const brand = url.searchParams.get("brand");
  const search = url.searchParams.get("search");
  
  try {
    const db = getPool();
    
    let query = `
      SELECT id, brand, model_pattern, image_url, source, created_at
      FROM tire_model_images
    `;
    const params: string[] = [];
    const conditions: string[] = [];
    
    if (brand) {
      params.push(brand);
      conditions.push(`LOWER(brand) = LOWER($${params.length})`);
    }
    
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(LOWER(brand) LIKE LOWER($${params.length}) OR LOWER(model_pattern) LIKE LOWER($${params.length}))`);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }
    
    query += ` ORDER BY brand ASC, model_pattern ASC`;
    
    const { rows } = await db.query(query, params);
    
    // Get unique brands for filter dropdown
    const { rows: brandRows } = await db.query(`
      SELECT DISTINCT brand FROM tire_model_images ORDER BY brand
    `);
    
    return NextResponse.json({
      items: rows,
      brands: brandRows.map(r => r.brand),
      total: rows.length,
    });
  } catch (err: any) {
    console.error("[admin/tire-images] GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST - Add new tire model image
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { brand, model_pattern, image_url } = body;
    
    if (!brand || !model_pattern || !image_url) {
      return NextResponse.json(
        { error: "Missing required fields: brand, model_pattern, image_url" },
        { status: 400 }
      );
    }
    
    const db = getPool();
    
    const { rows } = await db.query(`
      INSERT INTO tire_model_images (brand, model_pattern, image_url, source)
      VALUES ($1, $2, $3, 'admin')
      ON CONFLICT (brand, model_pattern) DO UPDATE SET
        image_url = EXCLUDED.image_url,
        source = 'admin'
      RETURNING id, brand, model_pattern, image_url, created_at
    `, [brand.trim(), model_pattern.trim(), image_url.trim()]);
    
    return NextResponse.json({
      success: true,
      item: rows[0],
    });
  } catch (err: any) {
    console.error("[admin/tire-images] POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT - Update a tire model image URL
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, image_url } = body;
    
    if (!id || !image_url) {
      return NextResponse.json(
        { error: "Missing required fields: id, image_url" },
        { status: 400 }
      );
    }
    
    const db = getPool();
    
    const { rows, rowCount } = await db.query(`
      UPDATE tire_model_images
      SET image_url = $2, source = 'admin'
      WHERE id = $1
      RETURNING id, brand, model_pattern, image_url, source, created_at
    `, [id, image_url.trim()]);
    
    if (rowCount === 0) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      item: rows[0],
    });
  } catch (err: any) {
    console.error("[admin/tire-images] PUT error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE - Remove a tire model image
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    
    if (!id) {
      return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
    }
    
    const db = getPool();
    
    const { rowCount } = await db.query(`
      DELETE FROM tire_model_images WHERE id = $1
    `, [id]);
    
    return NextResponse.json({
      success: true,
      deleted: rowCount,
    });
  } catch (err: any) {
    console.error("[admin/tire-images] DELETE error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
