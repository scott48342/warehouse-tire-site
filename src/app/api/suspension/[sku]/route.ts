import { NextRequest, NextResponse } from "next/server";
import pg from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const { Pool } = pg;

/**
 * GET /api/suspension/[sku]
 * 
 * Fetches a single suspension/lift kit product by SKU.
 * Returns product details including fitment info.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sku: string }> }
) {
  const { sku } = await context.params;

  if (!sku) {
    return NextResponse.json({ error: "SKU required" }, { status: 400 });
  }

  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

  try {
    // Fetch product from database
    const result = await pool.query(`
      SELECT 
        sku,
        product_desc,
        brand,
        product_type,
        lift_height,
        CASE 
          WHEN lift_height IS NOT NULL THEN
            CASE 
              WHEN lift_height <= 2 THEN 'leveled'
              WHEN lift_height <= 4 THEN '4in'
              WHEN lift_height <= 6 THEN '6in'
              ELSE '8in'
            END
          ELSE NULL
        END as lift_level,
        make,
        model,
        year_start,
        year_end,
        msrp,
        map_price,
        image_url
      FROM suspension_fitments
      WHERE sku = $1
      LIMIT 1
    `, [sku]);

    if (result.rows.length === 0) {
      await pool.end();
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const row = result.rows[0] as Record<string, unknown>;

    // Transform to camelCase
    const product = {
      sku: row.sku as string,
      productDesc: row.product_desc as string,
      brand: row.brand as string,
      productType: row.product_type as string | null,
      liftHeight: row.lift_height ? Number(row.lift_height) : null,
      liftLevel: row.lift_level as string | null,
      make: row.make as string,
      model: row.model as string,
      yearStart: Number(row.year_start),
      yearEnd: Number(row.year_end),
      msrp: row.msrp ? Number(row.msrp) : null,
      mapPrice: row.map_price ? Number(row.map_price) : null,
      imageUrl: row.image_url as string | null,
      // Assume in stock if we have it - could enhance with inventory check
      inStock: true,
      inventory: 1,
    };

    await pool.end();
    return NextResponse.json({ ok: true, product });
  } catch (error) {
    console.error("[suspension/sku] Error:", error);
    await pool.end();
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }
}
