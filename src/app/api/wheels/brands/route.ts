import { NextResponse } from "next/server";
import { getPool } from "@/lib/vehicleFitment";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const pool = getPool();

    // Union brands from all three wheel suppliers:
    // WheelPros (wp_wheels), Wheel-1 (wheel1_products), WSI (wsi_wheels)
    const result = await pool.query(`
      -- Deduplicate by UPPER() key; MIN(display) picks shortest/cleanest display name
      SELECT MIN(brand) AS brand, SUM(cnt) AS count
      FROM (
        -- WheelPros (source of truth for brand name casing)
        SELECT TRIM(brand_desc) AS brand, UPPER(TRIM(brand_desc)) AS key, COUNT(*) AS cnt
        FROM wp_wheels
        WHERE brand_desc IS NOT NULL AND brand_desc != ''
        GROUP BY TRIM(brand_desc), UPPER(TRIM(brand_desc))

        UNION ALL

        -- Wheel-1
        SELECT TRIM(brand) AS brand, UPPER(TRIM(brand)) AS key, COUNT(*) AS cnt
        FROM wheel1_products
        WHERE brand IS NOT NULL AND brand != ''
        GROUP BY TRIM(brand), UPPER(TRIM(brand))

        UNION ALL

        -- WSI Wholesale
        SELECT TRIM(brand) AS brand, UPPER(TRIM(brand)) AS key, COUNT(*) AS cnt
        FROM wsi_wheels
        WHERE brand IS NOT NULL AND brand != ''
        GROUP BY TRIM(brand), UPPER(TRIM(brand))
      ) combined
      GROUP BY key
      ORDER BY key
    `);

    return NextResponse.json({
      brands: result.rows.map((r: { brand: string; count: string }) => ({
        name: r.brand,
        count: parseInt(r.count, 10),
      })),
    });
  } catch (error) {
    console.error("Error fetching wheel brands:", error);
    return NextResponse.json({ error: "Failed to fetch brands" }, { status: 500 });
  }
}
