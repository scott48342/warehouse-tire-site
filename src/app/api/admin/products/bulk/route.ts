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
 * Bulk actions on products
 * 
 * Actions:
 * - hide: Hide selected products from search
 * - unhide: Unhide selected products
 * - flag: Flag selected products for review
 * - unflag: Remove flag from selected products
 * - setImage: Set image URL for selected products
 */
export async function POST(req: Request) {
  const body = await req.json();
  const { action, productType, skus, imageUrl, flagReason } = body;

  if (!action || !productType || !skus || !Array.isArray(skus) || skus.length === 0) {
    return NextResponse.json({ 
      error: "action, productType, and skus[] required" 
    }, { status: 400 });
  }

  if (skus.length > 100) {
    return NextResponse.json({ 
      error: "Maximum 100 SKUs per bulk action" 
    }, { status: 400 });
  }

  const validActions = ["hide", "unhide", "flag", "unflag", "setImage"];
  if (!validActions.includes(action)) {
    return NextResponse.json({ 
      error: `Invalid action. Valid: ${validActions.join(", ")}` 
    }, { status: 400 });
  }

  const pool = getPool();
  try {
    // Ensure columns exist
    await pool.query(`
      ALTER TABLE admin_product_flags ADD COLUMN IF NOT EXISTS image_url TEXT
    `).catch(() => {});

    let updated = 0;

    for (const sku of skus) {
      let updateFields: Record<string, any> = {};

      switch (action) {
        case "hide":
          updateFields = { hidden: true };
          break;
        case "unhide":
          updateFields = { hidden: false };
          break;
        case "flag":
          updateFields = { flagged: true, flag_reason: flagReason || "Bulk flagged" };
          break;
        case "unflag":
          updateFields = { flagged: false };
          break;
        case "setImage":
          if (!imageUrl) {
            return NextResponse.json({ error: "imageUrl required for setImage action" }, { status: 400 });
          }
          updateFields = { image_url: imageUrl };
          break;
      }

      // Upsert the flag record
      const setClauses = Object.entries(updateFields)
        .map(([k], i) => `${k} = $${i + 3}`)
        .join(", ");
      
      const values = [productType, sku, ...Object.values(updateFields)];

      await pool.query(`
        INSERT INTO admin_product_flags (product_type, sku, ${Object.keys(updateFields).join(", ")}, updated_at)
        VALUES ($1, $2, ${Object.values(updateFields).map((_, i) => `$${i + 3}`).join(", ")}, now())
        ON CONFLICT (product_type, sku) DO UPDATE SET
          ${setClauses},
          updated_at = now()
      `, values);

      updated++;
    }

    // Log the bulk action
    await pool.query(`
      INSERT INTO admin_logs (log_type, details)
      VALUES ('bulk_product_action', $1)
    `, [JSON.stringify({ action, productType, skuCount: skus.length, skus: skus.slice(0, 10) })]);

    return NextResponse.json({
      ok: true,
      action,
      updated,
      message: `${action} applied to ${updated} product(s)`,
    });
  } catch (err: any) {
    console.error("[admin/products/bulk] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await pool.end();
  }
}
