import { NextResponse } from "next/server";
import { getPool } from "@/lib/vehicleFitment";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT DISTINCT brand_desc as brand, COUNT(*) as count
      FROM wp_wheels
      WHERE brand_desc IS NOT NULL AND brand_desc != ''
      GROUP BY brand_desc
      ORDER BY brand_desc
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
