/**
 * Seed Missing Popular Models
 * 
 * Creates baseline fitment data for popular vehicles that are completely
 * missing from the database. Uses industry-known specifications.
 * 
 * Run: npx tsx scripts/seed-missing-models.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { vehicleFitments } from "../src/lib/fitment-db/schema";
import { sql } from "drizzle-orm";
import * as crypto from "crypto";

interface SeedSpec {
  make: string;
  model: string;
  years: [number, number]; // [startYear, endYear]
  boltPattern: string;
  centerBoreMm: number;
  threadSize: string;
  seatType: string;
  offsetRange: [number, number]; // [min, max]
  oemWheelSizes: Array<{ diameter: number; width: number; offset: number }>;
  oemTireSizes: string[];
}

// Known fitment specs for popular missing vehicles
const MISSING_VEHICLES: SeedSpec[] = [
  // Toyota
  {
    make: "toyota",
    model: "corolla",
    years: [2000, 2026],
    boltPattern: "5x114.3",
    centerBoreMm: 60.1,
    threadSize: "M12x1.5",
    seatType: "conical",
    offsetRange: [35, 50],
    oemWheelSizes: [
      { diameter: 15, width: 6, offset: 45 },
      { diameter: 16, width: 6.5, offset: 45 },
      { diameter: 17, width: 7, offset: 45 },
      { diameter: 18, width: 7.5, offset: 45 },
    ],
    oemTireSizes: ["195/65R15", "205/55R16", "215/45R17", "225/40R18"],
  },
  {
    make: "toyota",
    model: "prius",
    years: [2004, 2026],
    boltPattern: "5x114.3",
    centerBoreMm: 60.1,
    threadSize: "M12x1.5",
    seatType: "conical",
    offsetRange: [35, 50],
    oemWheelSizes: [
      { diameter: 15, width: 6, offset: 45 },
      { diameter: 17, width: 7, offset: 45 },
      { diameter: 19, width: 7.5, offset: 45 },
    ],
    oemTireSizes: ["195/65R15", "215/45R17", "195/50R19"],
  },
  
  // Honda
  {
    make: "honda",
    model: "odyssey",
    years: [2005, 2026],
    boltPattern: "5x120",
    centerBoreMm: 64.1,
    threadSize: "M14x1.5",
    seatType: "ball",
    offsetRange: [40, 55],
    oemWheelSizes: [
      { diameter: 18, width: 7.5, offset: 50 },
      { diameter: 19, width: 8, offset: 50 },
    ],
    oemTireSizes: ["235/60R18", "235/55R19"],
  },
  {
    make: "honda",
    model: "hr-v",
    years: [2016, 2026],
    boltPattern: "5x114.3",
    centerBoreMm: 64.1,
    threadSize: "M12x1.5",
    seatType: "ball",
    offsetRange: [45, 55],
    oemWheelSizes: [
      { diameter: 17, width: 7, offset: 50 },
      { diameter: 18, width: 7, offset: 50 },
    ],
    oemTireSizes: ["215/55R17", "225/50R18"],
  },
  {
    make: "honda",
    model: "ridgeline",
    years: [2006, 2026],
    boltPattern: "5x120",
    centerBoreMm: 64.1,
    threadSize: "M14x1.5",
    seatType: "ball",
    offsetRange: [35, 50],
    oemWheelSizes: [
      { diameter: 18, width: 8, offset: 45 },
      { diameter: 20, width: 8, offset: 45 },
    ],
    oemTireSizes: ["245/60R18", "275/45R20"],
  },
  
  // Ford
  {
    make: "ford",
    model: "edge",
    years: [2007, 2024],
    boltPattern: "5x108",
    centerBoreMm: 63.4,
    threadSize: "M14x1.5",
    seatType: "conical",
    offsetRange: [40, 55],
    oemWheelSizes: [
      { diameter: 18, width: 8, offset: 49 },
      { diameter: 19, width: 8, offset: 49 },
      { diameter: 20, width: 8, offset: 49 },
      { diameter: 21, width: 8.5, offset: 49 },
    ],
    oemTireSizes: ["235/60R18", "245/55R19", "255/45R20", "265/40R21"],
  },
  
  // Kia
  {
    make: "kia",
    model: "soul",
    years: [2010, 2026],
    boltPattern: "5x114.3",
    centerBoreMm: 67.1,
    threadSize: "M12x1.5",
    seatType: "conical",
    offsetRange: [40, 52],
    oemWheelSizes: [
      { diameter: 16, width: 6.5, offset: 47 },
      { diameter: 17, width: 7, offset: 47 },
      { diameter: 18, width: 7.5, offset: 47 },
    ],
    oemTireSizes: ["205/60R16", "215/55R17", "235/45R18"],
  },
  {
    make: "kia",
    model: "niro",
    years: [2017, 2026],
    boltPattern: "5x114.3",
    centerBoreMm: 67.1,
    threadSize: "M12x1.5",
    seatType: "conical",
    offsetRange: [40, 52],
    oemWheelSizes: [
      { diameter: 16, width: 6.5, offset: 47 },
      { diameter: 18, width: 7.5, offset: 47 },
    ],
    oemTireSizes: ["205/60R16", "225/45R18"],
  },
  
  // Hyundai
  {
    make: "hyundai",
    model: "kona",
    years: [2018, 2026],
    boltPattern: "5x114.3",
    centerBoreMm: 67.1,
    threadSize: "M12x1.5",
    seatType: "conical",
    offsetRange: [40, 52],
    oemWheelSizes: [
      { diameter: 17, width: 7, offset: 45 },
      { diameter: 18, width: 7.5, offset: 45 },
    ],
    oemTireSizes: ["215/55R17", "235/45R18"],
  },
  {
    make: "hyundai",
    model: "venue",
    years: [2020, 2026],
    boltPattern: "5x100",
    centerBoreMm: 54.1,
    threadSize: "M12x1.5",
    seatType: "conical",
    offsetRange: [35, 50],
    oemWheelSizes: [
      { diameter: 15, width: 6, offset: 47 },
      { diameter: 17, width: 6.5, offset: 47 },
    ],
    oemTireSizes: ["185/65R15", "205/55R17"],
  },
  
  // Subaru
  {
    make: "subaru",
    model: "impreza",
    years: [2000, 2026],
    boltPattern: "5x114.3",
    centerBoreMm: 56.1,
    threadSize: "M12x1.25",
    seatType: "conical",
    offsetRange: [48, 55],
    oemWheelSizes: [
      { diameter: 16, width: 6.5, offset: 48 },
      { diameter: 17, width: 7, offset: 48 },
      { diameter: 18, width: 7.5, offset: 48 },
    ],
    oemTireSizes: ["205/55R16", "205/50R17", "225/40R18"],
  },
  {
    make: "subaru",
    model: "ascent",
    years: [2019, 2026],
    boltPattern: "5x114.3",
    centerBoreMm: 56.1,
    threadSize: "M12x1.25",
    seatType: "conical",
    offsetRange: [45, 55],
    oemWheelSizes: [
      { diameter: 18, width: 7.5, offset: 50 },
      { diameter: 20, width: 8, offset: 50 },
    ],
    oemTireSizes: ["245/60R18", "255/50R20"],
  },
  {
    make: "subaru",
    model: "brz",
    years: [2013, 2026],
    boltPattern: "5x100",
    centerBoreMm: 56.1,
    threadSize: "M12x1.25",
    seatType: "conical",
    offsetRange: [45, 55],
    oemWheelSizes: [
      { diameter: 17, width: 7, offset: 48 },
      { diameter: 18, width: 7.5, offset: 48 },
    ],
    oemTireSizes: ["215/45R17", "215/40R18"],
  },
  
  // Mazda
  {
    make: "mazda",
    model: "mazda6",
    years: [2003, 2021],
    boltPattern: "5x114.3",
    centerBoreMm: 67.1,
    threadSize: "M12x1.5",
    seatType: "ball",
    offsetRange: [45, 55],
    oemWheelSizes: [
      { diameter: 17, width: 7.5, offset: 50 },
      { diameter: 19, width: 7.5, offset: 50 },
    ],
    oemTireSizes: ["225/55R17", "225/45R19"],
  },
  
  // Volkswagen
  {
    make: "volkswagen",
    model: "id.4",
    years: [2021, 2026],
    boltPattern: "5x112",
    centerBoreMm: 57.1,
    threadSize: "M14x1.5",
    seatType: "ball",
    offsetRange: [38, 48],
    oemWheelSizes: [
      { diameter: 19, width: 8, offset: 45 },
      { diameter: 20, width: 8.5, offset: 45 },
      { diameter: 21, width: 8.5, offset: 45 },
    ],
    oemTireSizes: ["235/55R19", "255/50R20", "255/45R21"],
  },
  {
    make: "volkswagen",
    model: "taos",
    years: [2022, 2026],
    boltPattern: "5x112",
    centerBoreMm: 57.1,
    threadSize: "M14x1.5",
    seatType: "ball",
    offsetRange: [40, 50],
    oemWheelSizes: [
      { diameter: 17, width: 7, offset: 45 },
      { diameter: 18, width: 7.5, offset: 45 },
    ],
    oemTireSizes: ["215/55R17", "215/50R18"],
  },
  
  // Nissan
  {
    make: "nissan",
    model: "leaf",
    years: [2011, 2026],
    boltPattern: "5x114.3",
    centerBoreMm: 66.1,
    threadSize: "M12x1.25",
    seatType: "conical",
    offsetRange: [40, 50],
    oemWheelSizes: [
      { diameter: 16, width: 6.5, offset: 47 },
      { diameter: 17, width: 7, offset: 47 },
    ],
    oemTireSizes: ["205/55R16", "215/50R17"],
  },
  {
    make: "nissan",
    model: "kicks",
    years: [2018, 2026],
    boltPattern: "5x114.3",
    centerBoreMm: 66.1,
    threadSize: "M12x1.25",
    seatType: "conical",
    offsetRange: [40, 52],
    oemWheelSizes: [
      { diameter: 17, width: 7, offset: 47 },
      { diameter: 18, width: 7, offset: 47 },
    ],
    oemTireSizes: ["205/55R17", "215/50R18"],
  },
];

function generateModificationId(year: number, make: string, model: string, trim: string): string {
  const input = `${year}:${make}:${model}:${trim}`.toLowerCase();
  const hash = crypto.createHash("sha256").update(input).digest("hex").slice(0, 8);
  return `${year}-${trim.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${hash}`;
}

async function seedMissingModels(dryRun: boolean = false): Promise<void> {
  let inserted = 0;
  let skipped = 0;
  
  for (const spec of MISSING_VEHICLES) {
    console.log(`\nProcessing ${spec.make} ${spec.model} (${spec.years[0]}-${spec.years[1]})...`);
    
    for (let year = spec.years[0]; year <= spec.years[1]; year++) {
      const modificationId = generateModificationId(year, spec.make, spec.model, "base");
      
      // Check if already exists
      const existing = await db.execute(sql`
        SELECT 1 FROM vehicle_fitments
        WHERE year = ${year}
          AND make = ${spec.make}
          AND model = ${spec.model}
        LIMIT 1
      `);
      
      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }
      
      const oemWheelSizes = spec.oemWheelSizes.map(ws => ({
        axle: "front",
        diameter: ws.diameter,
        width: ws.width,
        offset: ws.offset,
        isStock: true,
      }));
      
      if (!dryRun) {
        await db.execute(sql`
          INSERT INTO vehicle_fitments (
            year, make, model, modification_id, raw_trim, display_trim, submodel,
            bolt_pattern, center_bore_mm, thread_size, seat_type,
            offset_min_mm, offset_max_mm, oem_wheel_sizes, oem_tire_sizes,
            source, created_at, updated_at
          ) VALUES (
            ${year}, ${spec.make}, ${spec.model}, ${modificationId},
            'Base', 'Base', NULL,
            ${spec.boltPattern}, ${spec.centerBoreMm}, ${spec.threadSize}, ${spec.seatType},
            ${spec.offsetRange[0]}, ${spec.offsetRange[1]},
            ${JSON.stringify(oemWheelSizes)}::jsonb, ${JSON.stringify(spec.oemTireSizes)}::jsonb,
            'manual_seed_spec', NOW(), NOW()
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
  console.log("  SEED MISSING POPULAR MODELS");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(dryRun ? "  Mode: DRY RUN (no changes)" : "  Mode: LIVE INSERT");
  console.log();
  
  console.log(`Seeding ${MISSING_VEHICLES.length} vehicle models...`);
  
  await seedMissingModels(dryRun);
  
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
