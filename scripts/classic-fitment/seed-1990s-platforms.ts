/**
 * Seed 1990s Classic Fitment Platforms
 * 
 * Initial 10 vehicles per spec:
 * - Mustang: 1995 GT, 1998 Cobra (SN95)
 * - OBS Trucks: 1995 C1500, 1997 Sierra 1500 (GMT400)
 * - F-Body: 1998 Camaro Z28, 1999 Firebird Trans Am
 * - Honda Civic: 1995 DX (EG), 1998 EX (EK)
 * - Jeep XJ: 1998 Cherokee Sport, 1999 Cherokee Classic
 * 
 * Usage:
 *   npx tsx scripts/classic-fitment/seed-1990s-platforms.ts --dry-run
 *   npx tsx scripts/classic-fitment/seed-1990s-platforms.ts
 */

import { db } from "../../src/lib/fitment-db/db";
import { classicFitments } from "../../src/lib/classic-fitment/schema";
import { eq, and } from "drizzle-orm";

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
  // ═══════════════════════════════════════════════════════════════════════════
  // SN95 MUSTANG (1994-1998)
  // ═══════════════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════════════
  // GMT400 OBS TRUCKS (1988-1998)
  // ═══════════════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════════════
  // F-BODY (1993-2002)
  // ═══════════════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════════════
  // HONDA CIVIC EG (1992-1995)
  // ═══════════════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════════════
  // HONDA CIVIC EK (1996-2000)
  // ═══════════════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════════════
  // JEEP XJ CHEROKEE (1984-2001)
  // ═══════════════════════════════════════════════════════════════════════════
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

async function seed(dryRun: boolean) {
  console.log(`\n=== 1990s Classic Fitment Seed (${dryRun ? "DRY RUN" : "LIVE"}) ===\n`);
  console.log(`Batch tag: ${BATCH_TAG}`);
  console.log(`Platforms to seed: ${PLATFORMS.length}\n`);

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const p of PLATFORMS) {
    const label = `${p.yearStart}-${p.yearEnd} ${p.make} ${p.model} (${p.platformCode})`;

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
      console.log(`⏭️  SKIP (exists): ${label}`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`🔵 WOULD INSERT: ${label}`);
      console.log(`   Bolt: ${p.commonBoltPattern}, CB: ${p.commonCenterBore}mm`);
      console.log(`   Stock: ${p.stockWheelDiameter}x${p.stockWheelWidth} / ${p.stockTireSize}`);
      console.log(`   Safe range: ${p.recWheelDiameterMin}-${p.recWheelDiameterMax}" dia, ${p.recOffsetMinMm} to ${p.recOffsetMaxMm}mm offset`);
      inserted++;
      continue;
    }

    try {
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

      console.log(`✅ INSERTED: ${label}`);
      inserted++;
    } catch (err: any) {
      console.error(`❌ ERROR: ${label}: ${err.message}`);
      errors.push(`${label}: ${err.message}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log("\nErrors:");
    errors.forEach((e) => console.log(`  - ${e}`));
  }

  return { inserted, skipped, errors };
}

// Main
const dryRun = process.argv.includes("--dry-run");
seed(dryRun)
  .then(() => {
    console.log("\nDone.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
