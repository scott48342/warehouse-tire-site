/**
 * DEBUG: Check raw DB values for a make
 * GET /api/vehicles/debug?make=buick&year=2022
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const make = url.searchParams.get("make") || "buick";
  const yearStr = url.searchParams.get("year");
  const year = yearStr ? parseInt(yearStr, 10) : undefined;

  try {
    // Raw query to see exact values
    const raw = await db.execute(sql`
      SELECT DISTINCT make, model, year 
      FROM vehicle_fitments 
      WHERE make ILIKE ${`%${make}%`}
      ${year ? sql`AND year = ${year}` : sql``}
      ORDER BY year DESC, model
      LIMIT 50
    `);

    // Count total records
    const count = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM vehicle_fitments 
      WHERE make ILIKE ${`%${make}%`}
      ${year ? sql`AND year = ${year}` : sql``}
    `);

    // Check for NULL/empty models
    const nullModels = await db.execute(sql`
      SELECT DISTINCT year, make, model 
      FROM vehicle_fitments 
      WHERE make ILIKE ${`%${make}%`}
      AND (model IS NULL OR model = '')
      LIMIT 20
    `);

    return NextResponse.json({
      query: { make, year },
      totalRecords: count.rows[0]?.cnt,
      sampleRecords: raw.rows,
      nullOrEmptyModels: nullModels.rows,
    });
  } catch (err: any) {
    return NextResponse.json({ 
      error: err.message,
      stack: err.stack?.split("\n").slice(0, 5),
    }, { status: 500 });
  }
}
