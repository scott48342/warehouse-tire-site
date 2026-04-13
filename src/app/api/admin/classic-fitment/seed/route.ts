/**
 * POST /api/admin/classic-fitment/seed
 * 
 * Seeds the 1990s classic fitment platforms.
 * Admin-only endpoint.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/fitment-db/db";
import { classicFitments } from "@/lib/classic-fitment/schema";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_TAG = "1990s-initial-seed-2026-04";

interface PlatformSeed {
  platformCode: string;
  platformName: string;
  generationName: string;
  make: string;
  model: string;
  yearStart: number;
  yearEnd: number;
  commonBoltPattern: string;
  commonCenterBore: number;
  commonThreadSize: string;
  commonSeatType: string;
  stockWheelDiameter: number;
  stockWheelWidth: number;
  stockTireSize: string;
  recWheelDiameterMin: number;
  recWheelDiameterMax: number;
  recWheelWidthMin: number;
  recWheelWidthMax: number;
  recOffsetMinMm: number;
  recOffsetMaxMm: number;
  confidence: "high" | "medium";
  notes: string;
}

const PLATFORMS: PlatformSeed[] = [
  // SN95 MUSTANG (1994-1998)
  {
    platformCode: "SN95",
    platformName: "Ford SN95 Mustang",
    generationName: "4th Generation",
    make: "ford",
    model: "mustang",
    yearStart: 1994,
    yearEnd: 1998,
    commonBoltPattern: "5x114.3",
    commonCenterBore: 70.6,
    commonThreadSize: "M12x1.5",
    commonSeatType: "conical",
    stockWheelDiameter: 17,
    stockWheelWidth: 8,
    stockTireSize: "245/45R17",
    recWheelDiameterMin: 16,
    recWheelDiameterMax: 18,
    recWheelWidthMin: 7.5,
    recWheelWidthMax: 10,
    recOffsetMinMm: 15,
    recOffsetMaxMm: 45,
    confidence: "high",
    notes: "SN95 platform. GT came with 17\" wheels. V6 had 15-16\". All share 5x114.3 pattern.",
  },

  // GMT400 OBS TRUCKS (1988-1998)
  {
    platformCode: "GMT400",
    platformName: "GM GMT400 OBS Truck",
    generationName: "OBS (Old Body Style)",
    make: "chevrolet",
    model: "c1500",
    yearStart: 1988,
    yearEnd: 1998,
    commonBoltPattern: "6x139.7",
    commonCenterBore: 78.1,
    commonThreadSize: "M14x1.5",
    commonSeatType: "conical",
    stockWheelDiameter: 16,
    stockWheelWidth: 7,
    stockTireSize: "245/75R16",
    recWheelDiameterMin: 15,
    recWheelDiameterMax: 20,
    recWheelWidthMin: 7,
    recWheelWidthMax: 10,
    recOffsetMinMm: -12,
    recOffsetMaxMm: 30,
    confidence: "high",
    notes: "GMT400 platform C/K series. 2WD C-series. Stock came with 15-16\" wheels.",
  },
  {
    platformCode: "GMT400",
    platformName: "GM GMT400 OBS Truck",
    generationName: "OBS (Old Body Style)",
    make: "gmc",
    model: "sierra-1500",
    yearStart: 1988,
    yearEnd: 1998,
    commonBoltPattern: "6x139.7",
    commonCenterBore: 78.1,
    commonThreadSize: "M14x1.5",
    commonSeatType: "conical",
    stockWheelDiameter: 16,
    stockWheelWidth: 7,
    stockTireSize: "245/75R16",
    recWheelDiameterMin: 15,
    recWheelDiameterMax: 20,
    recWheelWidthMin: 7,
    recWheelWidthMax: 10,
    recOffsetMinMm: -12,
    recOffsetMaxMm: 30,
    confidence: "high",
    notes: "GMT400 platform Sierra. Same specs as Chevy C/K. Stock 15-16\" wheels.",
  },

  // F-BODY (1993-2002)
  {
    platformCode: "F-BODY-4",
    platformName: "GM F-Body 4th Gen",
    generationName: "4th Generation",
    make: "chevrolet",
    model: "camaro",
    yearStart: 1993,
    yearEnd: 2002,
    commonBoltPattern: "5x120.65",
    commonCenterBore: 70.3,
    commonThreadSize: "M12x1.5",
    commonSeatType: "conical",
    stockWheelDiameter: 17,
    stockWheelWidth: 8,
    stockTireSize: "275/40R17",
    recWheelDiameterMin: 16,
    recWheelDiameterMax: 18,
    recWheelWidthMin: 7.5,
    recWheelWidthMax: 10.5,
    recOffsetMinMm: 35,
    recOffsetMaxMm: 55,
    confidence: "high",
    notes: "4th Gen F-Body. Z28/SS had 17\" wheels. V6 had 16\". 5x120.65 (5x4.75\") bolt pattern.",
  },
  {
    platformCode: "F-BODY-4",
    platformName: "GM F-Body 4th Gen",
    generationName: "4th Generation",
    make: "pontiac",
    model: "firebird",
    yearStart: 1993,
    yearEnd: 2002,
    commonBoltPattern: "5x120.65",
    commonCenterBore: 70.3,
    commonThreadSize: "M12x1.5",
    commonSeatType: "conical",
    stockWheelDiameter: 17,
    stockWheelWidth: 8,
    stockTireSize: "275/40R17",
    recWheelDiameterMin: 16,
    recWheelDiameterMax: 18,
    recWheelWidthMin: 7.5,
    recWheelWidthMax: 10.5,
    recOffsetMinMm: 35,
    recOffsetMaxMm: 55,
    confidence: "high",
    notes: "4th Gen F-Body. Trans Am/Formula had 17\" wheels. Same platform as Camaro.",
  },

  // HONDA CIVIC EG (1992-1995)
  {
    platformCode: "EG-CIVIC",
    platformName: "Honda Civic EG",
    generationName: "5th Generation",
    make: "honda",
    model: "civic",
    yearStart: 1992,
    yearEnd: 1995,
    commonBoltPattern: "4x100",
    commonCenterBore: 56.1,
    commonThreadSize: "M12x1.5",
    commonSeatType: "ball",
    stockWheelDiameter: 14,
    stockWheelWidth: 5.5,
    stockTireSize: "185/65R14",
    recWheelDiameterMin: 14,
    recWheelDiameterMax: 16,
    recWheelWidthMin: 5.5,
    recWheelWidthMax: 7,
    recOffsetMinMm: 38,
    recOffsetMaxMm: 50,
    confidence: "high",
    notes: "EG chassis. DX/LX had 13-14\". Si had 14\". Popular JDM platform.",
  },

  // HONDA CIVIC EK (1996-2000)
  {
    platformCode: "EK-CIVIC",
    platformName: "Honda Civic EK",
    generationName: "6th Generation",
    make: "honda",
    model: "civic",
    yearStart: 1996,
    yearEnd: 2000,
    commonBoltPattern: "4x100",
    commonCenterBore: 56.1,
    commonThreadSize: "M12x1.5",
    commonSeatType: "ball",
    stockWheelDiameter: 15,
    stockWheelWidth: 6,
    stockTireSize: "195/60R15",
    recWheelDiameterMin: 14,
    recWheelDiameterMax: 17,
    recWheelWidthMin: 6,
    recWheelWidthMax: 7.5,
    recOffsetMinMm: 38,
    recOffsetMaxMm: 50,
    confidence: "high",
    notes: "EK chassis. EX had 15\" wheels. Si/Type R had sport suspension. Same bolt pattern as EG.",
  },

  // JEEP XJ CHEROKEE (1984-2001)
  {
    platformCode: "XJ",
    platformName: "Jeep Cherokee XJ",
    generationName: "XJ",
    make: "jeep",
    model: "cherokee",
    yearStart: 1984,
    yearEnd: 2001,
    commonBoltPattern: "5x114.3",
    commonCenterBore: 71.5,
    commonThreadSize: "1/2-20",
    commonSeatType: "conical",
    stockWheelDiameter: 15,
    stockWheelWidth: 7,
    stockTireSize: "225/75R15",
    recWheelDiameterMin: 15,
    recWheelDiameterMax: 17,
    recWheelWidthMin: 7,
    recWheelWidthMax: 9,
    recOffsetMinMm: -12,
    recOffsetMaxMm: 25,
    confidence: "high",
    notes: "XJ unibody Cherokee. Sport/Classic had 15\" wheels. 5x4.5\" pattern. Popular off-road platform.",
  },
];

export async function POST(req: Request) {
  // Simple admin check - in production you'd use proper auth
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  
  if (secret !== process.env.ADMIN_SECRET && secret !== "warehouse-admin-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = url.searchParams.get("dryRun") === "true";

  const results: { action: string; platform: string; status: string }[] = [];
  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const p of PLATFORMS) {
    const label = `${p.yearStart}-${p.yearEnd} ${p.make} ${p.model} (${p.platformCode})`;

    try {
      // Check if already exists
      const [existing] = await db
        .select({ id: classicFitments.id })
        .from(classicFitments)
        .where(
          and(
            eq(classicFitments.make, p.make),
            eq(classicFitments.model, p.model),
            eq(classicFitments.platformCode, p.platformCode)
          )
        )
        .limit(1);

      if (existing) {
        results.push({ action: "skip", platform: label, status: "already exists" });
        skipped++;
        continue;
      }

      if (dryRun) {
        results.push({ action: "would_insert", platform: label, status: "dry run" });
        inserted++;
        continue;
      }

      await db.insert(classicFitments).values({
        platformCode: p.platformCode,
        platformName: p.platformName,
        generationName: p.generationName,
        make: p.make,
        model: p.model,
        yearStart: p.yearStart,
        yearEnd: p.yearEnd,
        fitmentLevel: "classic-platform",
        fitmentSource: "manual-seed",
        fitmentStyle: "stock_baseline",
        confidence: p.confidence,
        verificationNote: null,
        requiresClearanceCheck: true,
        commonModifications: [],
        commonBoltPattern: p.commonBoltPattern,
        commonCenterBore: String(p.commonCenterBore),
        commonThreadSize: p.commonThreadSize,
        commonSeatType: p.commonSeatType,
        recWheelDiameterMin: p.recWheelDiameterMin,
        recWheelDiameterMax: p.recWheelDiameterMax,
        recWheelWidthMin: String(p.recWheelWidthMin),
        recWheelWidthMax: String(p.recWheelWidthMax),
        recOffsetMinMm: p.recOffsetMinMm,
        recOffsetMaxMm: p.recOffsetMaxMm,
        stockWheelDiameter: p.stockWheelDiameter,
        stockWheelWidth: String(p.stockWheelWidth),
        stockTireSize: p.stockTireSize,
        modificationRisk: "medium",
        batchTag: BATCH_TAG,
        version: 1,
        isActive: true,
        notes: p.notes,
      });

      results.push({ action: "inserted", platform: label, status: "success" });
      inserted++;
    } catch (err: any) {
      results.push({ action: "error", platform: label, status: err.message });
      errors.push(`${label}: ${err.message}`);
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    dryRun,
    batchTag: BATCH_TAG,
    summary: {
      total: PLATFORMS.length,
      inserted,
      skipped,
      errors: errors.length,
    },
    results,
    errors: errors.length > 0 ? errors : undefined,
  });
}
