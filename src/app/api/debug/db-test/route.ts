import { NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { vehicleFitments } from "@/lib/fitment-db/schema";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const year = Number(url.searchParams.get("year") || 2022);
  const make = url.searchParams.get("make") || "ford";
  const model = url.searchParams.get("model") || "f-150";
  
  try {
    // Test 1: Simple count
    const countResult = await db
      .select()
      .from(vehicleFitments)
      .limit(1);
    
    // Test 2: Specific lookup
    const fitments = await db
      .select()
      .from(vehicleFitments)
      .where(
        and(
          eq(vehicleFitments.year, year),
          eq(vehicleFitments.make, make.toLowerCase()),
          eq(vehicleFitments.model, model.toLowerCase())
        )
      )
      .limit(5);
    
    return NextResponse.json({
      success: true,
      env: {
        isVercel: process.env.VERCEL === "1" || !!process.env.VERCEL_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        hasPostgresUrl: !!process.env.POSTGRES_URL,
      },
      tests: {
        anyRecord: countResult.length > 0,
        vehicleQuery: {
          year,
          make: make.toLowerCase(),
          model: model.toLowerCase(),
          found: fitments.length,
          samples: fitments.map(f => ({
            id: f.id,
            modificationId: f.modificationId,
            boltPattern: f.boltPattern,
          })),
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error?.message || String(error),
      stack: error?.stack?.split("\n").slice(0, 5),
      env: {
        isVercel: process.env.VERCEL === "1" || !!process.env.VERCEL_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        hasPostgresUrl: !!process.env.POSTGRES_URL,
      },
    }, { status: 500 });
  }
}
