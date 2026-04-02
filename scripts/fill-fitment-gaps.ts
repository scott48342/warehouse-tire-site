/**
 * Fill Fitment Gaps by Platform Inheritance
 * 
 * For models with partial coverage, copies specs from existing years
 * to fill missing years within the same platform generation.
 * 
 * Run: npx tsx scripts/fill-fitment-gaps.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { vehicleFitments } from "../src/lib/fitment-db/schema";
import { sql, eq, and } from "drizzle-orm";
import * as fs from "fs";
import * as crypto from "crypto";

// Platform generations - defines which years share the same fitment specs
// Format: { make: { model: [[startYear, endYear], ...] } }
// Use ACTUAL database model slugs (verified from DB query)
const PLATFORM_GENERATIONS: Record<string, Record<string, [number, number][]>> = {
  ford: {
    "mustang": [[2005, 2014], [2015, 2023], [2024, 2026]], // S197, S550, S650
    "f-150": [[2004, 2008], [2009, 2014], [2015, 2020], [2021, 2026]],
    "f-250-super-duty": [[1999, 2007], [2008, 2010], [2011, 2016], [2017, 2026]],
    "f-350-super-duty": [[1999, 2007], [2008, 2010], [2011, 2016], [2017, 2026]],
    "explorer": [[2011, 2019], [2020, 2026]],
    "escape": [[2013, 2019], [2020, 2026]],
    "ranger": [[2019, 2026]],
    "bronco": [[2021, 2026]],
  },
  toyota: {
    "camry": [[2002, 2006], [2007, 2011], [2012, 2017], [2018, 2026]],
    "highlander": [[2001, 2007], [2008, 2013], [2014, 2019], [2020, 2026]],
    "sienna": [[2004, 2010], [2011, 2020], [2021, 2026]],
    "4runner": [[1996, 2002], [2003, 2009], [2010, 2026]],
    "rav4": [[1996, 2000], [2001, 2005], [2006, 2012], [2013, 2018], [2019, 2026]],
    "tacoma": [[1995, 2004], [2005, 2015], [2016, 2026]],
    "tundra": [[2000, 2006], [2007, 2021], [2022, 2026]],
    "sequoia": [[2001, 2007], [2008, 2022], [2023, 2026]],
  },
  honda: {
    "civic": [[2001, 2005], [2006, 2011], [2012, 2015], [2016, 2021], [2022, 2026]],
    "accord": [[2003, 2007], [2008, 2012], [2013, 2017], [2018, 2022], [2023, 2026]],
    "cr-v": [[1997, 2001], [2002, 2006], [2007, 2011], [2012, 2016], [2017, 2022], [2023, 2026]],
    "pilot": [[2003, 2008], [2009, 2015], [2016, 2022], [2023, 2026]],
  },
  chevrolet: {
    "silverado-1500": [[1999, 2006], [2007, 2013], [2014, 2018], [2019, 2026]],
    "silverado-2500hd": [[2001, 2007], [2007, 2014], [2015, 2019], [2020, 2026]],
    "silverado-3500hd": [[2001, 2007], [2007, 2014], [2015, 2019], [2020, 2026]],
    "tahoe": [[1995, 1999], [2000, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
    "suburban": [[1992, 1999], [2000, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
    "equinox": [[2005, 2009], [2010, 2017], [2018, 2026]],
    "traverse": [[2009, 2017], [2018, 2026]],
    "malibu": [[2004, 2007], [2008, 2012], [2013, 2015], [2016, 2026]],
    "camaro": [[2010, 2015], [2016, 2026]],
    "corvette": [[2005, 2013], [2014, 2019], [2020, 2026]],
    "colorado": [[2004, 2012], [2015, 2026]],
  },
  gmc: {
    "sierra-1500": [[1999, 2006], [2007, 2013], [2014, 2018], [2019, 2026]],
    "sierra-2500hd": [[2001, 2007], [2007, 2014], [2015, 2019], [2020, 2026]],
    "sierra-3500hd": [[2001, 2007], [2007, 2014], [2015, 2019], [2020, 2026]],
    "yukon": [[1995, 1999], [2000, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
    "yukon-xl": [[2000, 2006], [2007, 2014], [2015, 2020], [2021, 2026]],
    "acadia": [[2007, 2016], [2017, 2026]],
    "terrain": [[2010, 2017], [2018, 2026]],
    "canyon": [[2004, 2012], [2015, 2026]],
  },
  ram: {
    "1500": [[2002, 2008], [2009, 2018], [2019, 2026]],
    "2500": [[2003, 2009], [2010, 2018], [2019, 2026]],
    "3500": [[2003, 2009], [2010, 2018], [2019, 2026]],
  },
  hyundai: {
    "palisade": [[2020, 2026]],
    "elantra": [[2001, 2006], [2007, 2010], [2011, 2016], [2017, 2020], [2021, 2026]],
    "sonata": [[2002, 2005], [2006, 2010], [2011, 2014], [2015, 2019], [2020, 2026]],
    "tucson": [[2005, 2009], [2010, 2015], [2016, 2021], [2022, 2026]],
    "santa-fe": [[2001, 2006], [2007, 2012], [2013, 2018], [2019, 2026]],
  },
  kia: {
    "telluride": [[2020, 2026]],
    "forte": [[2010, 2013], [2014, 2018], [2019, 2026]],
    "k5": [[2011, 2015], [2016, 2020], [2021, 2026]],
    "sorento": [[2003, 2009], [2010, 2015], [2016, 2020], [2021, 2026]],
    "sportage": [[2005, 2010], [2011, 2016], [2017, 2022], [2023, 2026]],
  },
  subaru: {
    "outback": [[2000, 2004], [2005, 2009], [2010, 2014], [2015, 2019], [2020, 2026]],
    "forester": [[1998, 2002], [2003, 2008], [2009, 2013], [2014, 2018], [2019, 2026]],
    "crosstrek": [[2013, 2017], [2018, 2023], [2024, 2026]],
    "legacy": [[2000, 2004], [2005, 2009], [2010, 2014], [2015, 2019], [2020, 2026]],
    "wrx": [[2002, 2007], [2008, 2014], [2015, 2021], [2022, 2026]],
  },
  mazda: {
    "mazda3": [[2004, 2009], [2010, 2013], [2014, 2018], [2019, 2026]],
    "mazda6": [[2003, 2008], [2009, 2013], [2014, 2021]],
    "cx-5": [[2013, 2016], [2017, 2026]],
    "cx-9": [[2007, 2015], [2016, 2026]],
    "cx-30": [[2020, 2026]],
    "mx-5-miata": [[2006, 2015], [2016, 2026]],
  },
  mercedes: {  // Use "mercedes" not "mercedes-benz" - that's what's in the DB
    "c-class": [[2001, 2007], [2008, 2014], [2015, 2021], [2022, 2026]],
    "e-class": [[2003, 2009], [2010, 2016], [2017, 2023], [2024, 2026]],
    "gle": [[1998, 2005], [2006, 2011], [2012, 2019], [2020, 2026]],
    "glc": [[2016, 2022], [2023, 2026]],
    "gls": [[2017, 2019], [2020, 2026]],
    "s-class": [[1994, 1999], [2000, 2005], [2006, 2013], [2014, 2020], [2021, 2026]],
  },
  bmw: {
    "3-series": [[2006, 2011], [2012, 2018], [2019, 2026]],
    "5-series": [[2004, 2010], [2011, 2016], [2017, 2023], [2024, 2026]],
    "x3": [[2004, 2010], [2011, 2017], [2018, 2026]],
    "x5": [[2000, 2006], [2007, 2013], [2014, 2018], [2019, 2026]],
  },
  nissan: {
    "altima": [[2002, 2006], [2007, 2012], [2013, 2018], [2019, 2026]],
    "maxima": [[2000, 2003], [2004, 2008], [2009, 2014], [2016, 2026]],
    "sentra": [[2000, 2006], [2007, 2012], [2013, 2019], [2020, 2026]],
    "rogue": [[2008, 2013], [2014, 2020], [2021, 2026]],
    "pathfinder": [[2005, 2012], [2013, 2020], [2022, 2026]],
    "murano": [[2003, 2007], [2009, 2014], [2015, 2026]],
    "frontier": [[1998, 2004], [2005, 2021], [2022, 2026]],
    "titan": [[2004, 2015], [2016, 2026]],
    "armada": [[2004, 2015], [2017, 2026]],
  },
  jeep: {
    "wrangler": [[1997, 2006], [2007, 2017], [2018, 2026]],
    "grand-cherokee": [[1999, 2004], [2005, 2010], [2011, 2021], [2022, 2026]],
    "cherokee": [[2002, 2007], [2014, 2026]],
    "compass": [[2007, 2017], [2018, 2026]],
    "renegade": [[2015, 2026]],
    "gladiator": [[2020, 2026]],
  },
  dodge: {
    "challenger": [[2008, 2026]],
    "charger": [[2006, 2010], [2011, 2026]],
    "durango": [[1998, 2003], [2004, 2009], [2011, 2026]],
  },
  lexus: {
    "rx": [[1999, 2003], [2004, 2009], [2010, 2015], [2016, 2022], [2023, 2026]],
    "es": [[1997, 2001], [2002, 2006], [2007, 2012], [2013, 2018], [2019, 2026]],
    "gx": [[2003, 2009], [2010, 2026]],
    "nx": [[2015, 2021], [2022, 2026]],
    "is": [[1999, 2005], [2006, 2013], [2014, 2020], [2021, 2026]],
  },
  lincoln: {
    "navigator": [[1998, 2002], [2003, 2006], [2007, 2017], [2018, 2026]],
    "aviator": [[2003, 2005], [2020, 2026]],
  },
  tesla: {
    "model-s": [[2012, 2026]],
    "model-x": [[2016, 2026]],
    "model-3": [[2017, 2026]],
    "model-y": [[2020, 2026]],
    "cybertruck": [[2024, 2026]],
  },
  porsche: {
    "911": [[1999, 2004], [2005, 2011], [2012, 2019], [2020, 2026]],
    "cayenne": [[2003, 2010], [2011, 2017], [2019, 2026]],
    "macan": [[2015, 2026]],
    "panamera": [[2010, 2016], [2017, 2026]],
  },
  volkswagen: {
    "jetta": [[1999, 2005], [2006, 2010], [2011, 2018], [2019, 2026]],
    "passat": [[1998, 2005], [2006, 2010], [2012, 2019], [2020, 2026]],
    "tiguan": [[2009, 2017], [2018, 2026]],
    "atlas": [[2018, 2026]],
    "golf": [[1999, 2006], [2007, 2014], [2015, 2026]],
    "gti": [[1999, 2006], [2007, 2014], [2015, 2026]],
  },
};

interface GapToFill {
  make: string;
  model: string;
  targetYear: number;
  donorYear: number;
  generation: [number, number];
  trims: Array<{
    modificationId: string;
    displayTrim: string;
    boltPattern: string;
    centerBoreMm: string;
    threadSize: string | null;
    seatType: string | null;
    offsetMinMm: string | null;
    offsetMaxMm: string | null;
    oemWheelSizes: any[];
    oemTireSizes: any[];
  }>;
}

function generateModificationId(year: number, make: string, model: string, trim: string): string {
  const input = `${year}:${make}:${model}:${trim}`.toLowerCase();
  const hash = crypto.createHash("sha256").update(input).digest("hex").slice(0, 8);
  return `${year}-${trim.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${hash}`;
}

async function findGapsAndDonors(): Promise<GapToFill[]> {
  const gaps: GapToFill[] = [];
  
  for (const [make, models] of Object.entries(PLATFORM_GENERATIONS)) {
    for (const [model, generations] of Object.entries(models)) {
      // Get existing years for this make/model
      const existingYears = await db.execute(sql`
        SELECT DISTINCT year FROM vehicle_fitments
        WHERE make = ${make.toLowerCase()} AND model = ${model.toLowerCase()}
        ORDER BY year
      `);
      
      const hasYears = new Set((existingYears.rows as any[]).map(r => r.year));
      
      if (hasYears.size === 0) {
        console.log(`  ⚠️  ${make} ${model}: No existing data to inherit from`);
        continue;
      }
      
      // For each generation, find gaps and potential donors
      for (const [genStart, genEnd] of generations) {
        // Find a donor year within this generation
        let donorYear: number | null = null;
        for (let y = genEnd; y >= genStart; y--) {
          if (hasYears.has(y)) {
            donorYear = y;
            break;
          }
        }
        
        if (!donorYear) continue;
        
        // Get donor fitment data
        const donorData = await db.execute(sql`
          SELECT modification_id, display_trim, bolt_pattern, center_bore_mm,
                 thread_size, seat_type, offset_min_mm, offset_max_mm,
                 oem_wheel_sizes, oem_tire_sizes
          FROM vehicle_fitments
          WHERE make = ${make.toLowerCase()} 
            AND model = ${model.toLowerCase()} 
            AND year = ${donorYear}
        `);
        
        if (donorData.rows.length === 0) continue;
        
        // Find missing years in this generation
        for (let year = genStart; year <= genEnd; year++) {
          if (!hasYears.has(year)) {
            gaps.push({
              make: make.toLowerCase(),
              model: model.toLowerCase(),
              targetYear: year,
              donorYear,
              generation: [genStart, genEnd],
              trims: (donorData.rows as any[]).map(r => ({
                modificationId: generateModificationId(year, make, model, r.display_trim),
                displayTrim: r.display_trim,
                boltPattern: r.bolt_pattern,
                centerBoreMm: r.center_bore_mm,
                threadSize: r.thread_size,
                seatType: r.seat_type,
                offsetMinMm: r.offset_min_mm,
                offsetMaxMm: r.offset_max_mm,
                oemWheelSizes: r.oem_wheel_sizes || [],
                oemTireSizes: r.oem_tire_sizes || [],
              })),
            });
          }
        }
      }
    }
  }
  
  return gaps;
}

async function fillGaps(gaps: GapToFill[], dryRun: boolean = false): Promise<void> {
  let inserted = 0;
  let skipped = 0;
  
  for (const gap of gaps) {
    for (const trim of gap.trims) {
      // Check if already exists
      const existing = await db.execute(sql`
        SELECT 1 FROM vehicle_fitments
        WHERE year = ${gap.targetYear}
          AND make = ${gap.make}
          AND model = ${gap.model}
          AND display_trim = ${trim.displayTrim}
        LIMIT 1
      `);
      
      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }
      
      if (!dryRun) {
        await db.execute(sql`
          INSERT INTO vehicle_fitments (
            year, make, model, modification_id, raw_trim, display_trim, submodel,
            bolt_pattern, center_bore_mm, thread_size, seat_type,
            offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes,
            source, created_at, updated_at
          ) VALUES (
            ${gap.targetYear}, ${gap.make}, ${gap.model}, ${trim.modificationId},
            ${trim.displayTrim}, ${trim.displayTrim}, NULL,
            ${trim.boltPattern}, ${trim.centerBoreMm}, ${trim.threadSize}, ${trim.seatType},
            ${trim.offsetMinMm}, ${trim.offsetMaxMm},
            ${JSON.stringify(trim.oemWheelSizes)}::jsonb, ${JSON.stringify(trim.oemTireSizes)}::jsonb,
            ${"generation_inherit_" + gap.donorYear}, NOW(), NOW()
          )
        `);
      }
      inserted++;
    }
  }
  
  console.log(`\n${dryRun ? "[DRY RUN] Would insert" : "Inserted"}: ${inserted} records`);
  console.log(`Skipped (already exists): ${skipped} records`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  FILL FITMENT GAPS BY PLATFORM INHERITANCE");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(dryRun ? "  Mode: DRY RUN (no changes)" : "  Mode: LIVE INSERT");
  console.log();
  
  console.log("Finding gaps...");
  const gaps = await findGapsAndDonors();
  
  console.log(`\nFound ${gaps.length} year gaps to fill:`);
  
  // Group by make/model for summary
  const byModel = new Map<string, GapToFill[]>();
  for (const gap of gaps) {
    const key = `${gap.make}|${gap.model}`;
    if (!byModel.has(key)) byModel.set(key, []);
    byModel.get(key)!.push(gap);
  }
  
  for (const [key, modelGaps] of byModel) {
    const [make, model] = key.split("|");
    const years = modelGaps.map(g => g.targetYear).sort((a, b) => a - b);
    const trimCount = modelGaps[0].trims.length;
    console.log(`  ${make} ${model}: ${years.length} years × ${trimCount} trims = ${years.length * trimCount} records`);
    console.log(`    Years: ${years.join(", ")}`);
    console.log(`    Donor: ${modelGaps[0].donorYear}`);
  }
  
  const totalRecords = gaps.reduce((sum, g) => sum + g.trims.length, 0);
  console.log(`\nTotal records to insert: ${totalRecords}`);
  
  if (!dryRun) {
    console.log("\nInserting...");
    await fillGaps(gaps, false);
  } else {
    console.log("\nRun without --dry-run to insert records.");
    await fillGaps(gaps, true);
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
