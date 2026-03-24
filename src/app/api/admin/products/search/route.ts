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
 * Search actual products (wheels/tires) from cache tables
 * Returns products with their flag status
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("q") || "";
  const productType = url.searchParams.get("type") || "wheel";
  const supplier = url.searchParams.get("supplier");
  const brand = url.searchParams.get("brand");
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50", 10));

  if (!query || query.length < 2) {
    return NextResponse.json({ 
      products: [], 
      message: "Enter at least 2 characters to search" 
    });
  }

  const pool = getPool();
  try {
    // Ensure image_url column exists
    await pool.query(`
      ALTER TABLE admin_product_flags ADD COLUMN IF NOT EXISTS image_url TEXT
    `).catch(() => {});

    // Add supplier/brand columns if missing
    await pool.query(`
      ALTER TABLE admin_product_flags ADD COLUMN IF NOT EXISTS supplier TEXT
    `).catch(() => {});
    await pool.query(`
      ALTER TABLE admin_product_flags ADD COLUMN IF NOT EXISTS brand TEXT
    `).catch(() => {});

    if (productType === "wheel") {
      // Search wheel_cache for wheels
      const { rows } = await pool.query(`
        SELECT 
          wc.sku,
          wc.upc,
          wc.style_description as name,
          wc.brand,
          wc.finish as finish_desc,
          wc.diameter,
          wc.width,
          wc.bolt_pattern,
          wc.offset,
          wc.image_url,
          wc.supplier,
          pf.id as flag_id,
          pf.hidden,
          pf.flagged,
          pf.flag_reason,
          pf.image_url as override_image_url
        FROM wheel_cache wc
        LEFT JOIN admin_product_flags pf ON pf.sku = wc.sku AND pf.product_type = 'wheel'
        WHERE (
          wc.sku ILIKE $1 
          OR wc.upc ILIKE $1
          OR wc.style_description ILIKE $1
          OR wc.brand ILIKE $1
        )
        ${supplier ? `AND wc.supplier = $3` : ""}
        ${brand ? `AND wc.brand ILIKE ${supplier ? "$4" : "$3"}` : ""}
        ORDER BY wc.brand, wc.style_description
        LIMIT $2
      `, supplier && brand 
        ? [`%${query}%`, limit, supplier, `%${brand}%`]
        : supplier 
          ? [`%${query}%`, limit, supplier]
          : brand 
            ? [`%${query}%`, limit, `%${brand}%`]
            : [`%${query}%`, limit]
      );

      // Get distinct brands/suppliers for filters
      const { rows: brandRows } = await pool.query(`
        SELECT DISTINCT brand FROM wheel_cache WHERE brand IS NOT NULL ORDER BY brand LIMIT 100
      `);
      const { rows: supplierRows } = await pool.query(`
        SELECT DISTINCT supplier FROM wheel_cache WHERE supplier IS NOT NULL ORDER BY supplier
      `);

      return NextResponse.json({
        products: rows.map(r => ({
          sku: r.sku,
          upc: r.upc,
          name: r.name,
          brand: r.brand,
          finish: r.finish_desc,
          size: r.diameter && r.width ? `${r.diameter}x${r.width}` : null,
          boltPattern: r.bolt_pattern,
          offset: r.offset,
          imageUrl: r.override_image_url || r.image_url,
          supplier: r.supplier,
          // Flag status
          flagId: r.flag_id,
          hidden: r.hidden || false,
          flagged: r.flagged || false,
          flagReason: r.flag_reason,
        })),
        filters: {
          brands: brandRows.map(r => r.brand),
          suppliers: supplierRows.map(r => r.supplier),
        },
        total: rows.length,
      });
    } else {
      // Search wp_tires table for tires
      const { rows } = await pool.query(`
        SELECT 
          t.sku,
          t.brand_desc as brand,
          t.tire_description as name,
          t.tire_size as size,
          t.image_url,
          t.terrain,
          t.construction_type,
          pf.id as flag_id,
          pf.hidden,
          pf.flagged,
          pf.flag_reason,
          pf.image_url as override_image_url
        FROM wp_tires t
        LEFT JOIN admin_product_flags pf ON pf.sku = t.sku AND pf.product_type = 'tire'
        WHERE (
          t.sku ILIKE $1 
          OR t.tire_description ILIKE $1
          OR t.brand_desc ILIKE $1
        )
        ORDER BY t.brand_desc, t.tire_description
        LIMIT $2
      `, [`%${query}%`, limit]);

      // Get distinct brands for filters
      const { rows: brandRows } = await pool.query(`
        SELECT DISTINCT brand_desc as brand FROM wp_tires WHERE brand_desc IS NOT NULL ORDER BY brand_desc LIMIT 100
      `);

      return NextResponse.json({
        products: rows.map(r => ({
          sku: r.sku,
          name: r.name || r.sku,
          brand: r.brand,
          size: r.size,
          terrain: r.terrain,
          construction: r.construction_type,
          imageUrl: r.override_image_url || r.image_url,
          supplier: "WheelPros",
          flagId: r.flag_id,
          hidden: r.hidden || false,
          flagged: r.flagged || false,
          flagReason: r.flag_reason,
        })),
        filters: { 
          brands: brandRows.map(r => r.brand),
          suppliers: ["WheelPros"],
        },
        total: rows.length,
      });
    }
  } catch (err: any) {
    console.error("[admin/products/search] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}
