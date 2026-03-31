/**
 * POST /api/admin/classic-normalize
 * 
 * One-time migration to normalize classic diameter ranges to 15-20"
 * Protected by admin auth
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { classicFitments } from "@/lib/classic-fitment/schema";
import { eq, inArray } from "drizzle-orm";

export const runtime = "nodejs";

const TARGET_MIN = 15;
const TARGET_MAX = 20;

const PLATFORMS = [
  "ford-mustang-1gen",
  "gm-a-body-2", 
  "mopar-e-body",
  "mopar-b-body",
  "gm-f-body-2",
  "gm-f-body-1",
];

export async function POST(req: Request) {
  try {
    // Get current state
    const before = await db
      .select({
        platformCode: classicFitments.platformCode,
        platformName: classicFitments.platformName,
        min: classicFitments.recWheelDiameterMin,
        max: classicFitments.recWheelDiameterMax,
      })
      .from(classicFitments)
      .where(eq(classicFitments.isActive, true));

    // Update
    await db
      .update(classicFitments)
      .set({
        recWheelDiameterMin: TARGET_MIN,
        recWheelDiameterMax: TARGET_MAX,
        updatedAt: new Date(),
      })
      .where(
        inArray(classicFitments.platformCode, PLATFORMS)
      );

    // Get after state
    const after = await db
      .select({
        platformCode: classicFitments.platformCode,
        platformName: classicFitments.platformName,
        min: classicFitments.recWheelDiameterMin,
        max: classicFitments.recWheelDiameterMax,
      })
      .from(classicFitments)
      .where(eq(classicFitments.isActive, true));

    return NextResponse.json({
      success: true,
      targetRange: `${TARGET_MIN}-${TARGET_MAX}`,
      platformsUpdated: PLATFORMS,
      before: before.reduce((acc, r) => {
        if (!acc[r.platformCode]) acc[r.platformCode] = `${r.min}-${r.max}`;
        return acc;
      }, {} as Record<string, string>),
      after: after.reduce((acc, r) => {
        if (!acc[r.platformCode]) acc[r.platformCode] = `${r.min}-${r.max}`;
        return acc;
      }, {} as Record<string, string>),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const records = await db
      .select({
        platformCode: classicFitments.platformCode,
        platformName: classicFitments.platformName,
        min: classicFitments.recWheelDiameterMin,
        max: classicFitments.recWheelDiameterMax,
      })
      .from(classicFitments)
      .where(eq(classicFitments.isActive, true));

    const platforms: Record<string, { name: string; range: string; needsUpdate: boolean }> = {};
    
    for (const r of records) {
      if (!platforms[r.platformCode]) {
        platforms[r.platformCode] = {
          name: r.platformName,
          range: `${r.min}-${r.max}`,
          needsUpdate: r.min !== TARGET_MIN || r.max !== TARGET_MAX,
        };
      }
    }

    return NextResponse.json({
      targetRange: `${TARGET_MIN}-${TARGET_MAX}`,
      platforms,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
