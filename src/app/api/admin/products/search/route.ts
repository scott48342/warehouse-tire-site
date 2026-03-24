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
      // For tires - no local cache, but we can show already-flagged tires
      // and allow direct SKU entry via the Flagged view
      const { rows } = await pool.query(`
        SELECT 
          pf.id,
          pf.sku,
          pf.hidden,
          pf.flagged,
          pf.flag_reason,
          pf.image_url,
          pf.created_at,
          pf.updated_at
        FROM admin_product_flags pf
        WHERE pf.product_type = 'tire'
          AND pf.sku ILIKE $1
        ORDER BY pf.updated_at DESC
        LIMIT $2
      `, [`%${query}%`, limit]);

      return NextResponse.json({
        products: rows.map(r => ({
          sku: r.sku,
          name: `Tire SKU: ${r.sku}`,
          brand: null,
          size: null,
          imageUrl: r.image_url,
          supplier: "Tirewire",
          flagId: r.id,
          hidden: r.hidden || false,
          flagged: r.flagged || false,
          flagReason: r.flag_reason,
        })),
        filters: { brands: [], suppliers: [] },
        total: rows.length,
        message: rows.length === 0 
          ? "Tire catalog search not available. Use 'Flagged' view to add tire SKUs manually, or switch to Wheels."
          : null,
      });
    }
  } catch (err: any) {
    console.error("[admin/products/search] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}
