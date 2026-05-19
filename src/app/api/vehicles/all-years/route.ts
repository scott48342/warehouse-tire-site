/**
 * All Vehicle Years API
 * 
 * GET /api/vehicles/all-years
 * 
 * Returns all years that have fitment data in the database.
 * Used for YMM selectors that start with year selection.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { vehicleFitments } from "@/lib/fitment-db/schema";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  try {
    const results = await db
      .selectDistinct({ year: vehicleFitments.year })
      .from(vehicleFitments)
      .orderBy(sql`${vehicleFitments.year} DESC`);
    
    const years = results.map(r => r.year).filter(y => y != null);
    
    console.log(`[all-years] DB: ${years.length} years`);
    
    return NextResponse.json({
      years,
      count: years.length,
    }, {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });
    
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[all-years] DB error:`, message);
    
    // Fallback to reasonable year range
    const currentYear = new Date().getFullYear();
    const fallbackYears = Array.from({ length: 30 }, (_, i) => currentYear + 1 - i);
    
    return NextResponse.json({
      years: fallbackYears,
      count: fallbackYears.length,
      source: "fallback",
    }, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }
}
