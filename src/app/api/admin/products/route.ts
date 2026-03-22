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
 * Get product flags with optional filters
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const productType = url.searchParams.get("type"); // wheel, tire
  const filter = url.searchParams.get("filter"); // flagged, hidden
  const search = url.searchParams.get("search");
  const limit = parseInt(url.searchParams.get("limit") || "100", 10);

  const pool = getPool();
  try {
    let whereConditions = ["1=1"];
    const values: any[] = [];
    let paramIndex = 1;

    if (productType) {
      whereConditions.push(`product_type = $${paramIndex++}`);
      values.push(productType);
    }

    if (filter === "flagged") {
      whereConditions.push(`flagged = true`);
    } else if (filter === "hidden") {
      whereConditions.push(`hidden = true`);
    }

    if (search) {
      whereConditions.push(`sku ILIKE $${paramIndex++}`);
      values.push(`%${search}%`);
    }

    values.push(limit);

    const { rows } = await pool.query(`
      SELECT *
      FROM admin_product_flags
      WHERE ${whereConditions.join(" AND ")}
      ORDER BY updated_at DESC
      LIMIT $${paramIndex}
    `, values);

    // Get counts
    const { rows: countRows } = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE hidden = true) as hidden_count,
        COUNT(*) FILTER (WHERE flagged = true) as flagged_count,
        COUNT(*) as total_count
      FROM admin_product_flags
      ${productType ? "WHERE product_type = $1" : ""}
    `, productType ? [productType] : []);

    return NextResponse.json({
      products: rows,
      counts: countRows[0],
    });
  } catch (err: any) {
    console.error("[admin/products] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}

/**
 * Create or update a product flag
 */
export async function POST(req: Request) {
  const body = await req.json();
  const { productType, sku, hidden, flagged, flagReason } = body;

  if (!productType || !sku) {
    return NextResponse.json({ error: "productType and sku required" }, { status: 400 });
  }

  const pool = getPool();
  try {
    const { rows } = await pool.query(`
      INSERT INTO admin_product_flags (product_type, sku, hidden, flagged, flag_reason, updated_at)
      VALUES ($1, $2, $3, $4, $5, now())
      ON CONFLICT (product_type, sku) DO UPDATE SET
        hidden = EXCLUDED.hidden,
        flagged = EXCLUDED.flagged,
        flag_reason = EXCLUDED.flag_reason,
        updated_at = now()
      RETURNING *
    `, [productType, sku, hidden || false, flagged || false, flagReason || null]);

    // Log the change
    await pool.query(`
      INSERT INTO admin_logs (log_type, sku, details)
      VALUES ('product_flag', $1, $2)
    `, [sku, JSON.stringify({ productType, hidden, flagged, flagReason })]);

    return NextResponse.json({ ok: true, product: rows[0] });
  } catch (err: any) {
    console.error("[admin/products] POST Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}

/**
 * Delete a product flag (restore to default)
 */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const productType = url.searchParams.get("type");
  const sku = url.searchParams.get("sku");

  if (!productType || !sku) {
    return NextResponse.json({ error: "type and sku required" }, { status: 400 });
  }

  const pool = getPool();
  try {
    await pool.query(
      `DELETE FROM admin_product_flags WHERE product_type = $1 AND sku = $2`,
      [productType, sku]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[admin/products] DELETE Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}
