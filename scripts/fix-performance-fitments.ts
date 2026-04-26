/**
 * Fix Performance Vehicle Fitments
 * Updates missing tire sizes and wheel specs for high-priority Tier A vehicles
 * 
 * Vehicles:
 * - Ford Mustang Shelby GT500 (2007-2022)
 * - Ford Mustang Mach 1 (2021-2023)
 * - Ford Mustang Shelby GT350 (2015-2020)
 * - Ford F-450 Super Duty (2000-2026)
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { sql } from "drizzle-orm";

const { Pool } = pg;

// Load .env.local
const envPath = resolve(process.cwd(), ".env.local");
const envContent = readFileSync(envPath, "utf8");
for (const line of envContent.split("\n")) {
  const eqIdx = line.indexOf("=");
  if (eqIdx > 0) {
    const key = line.substring(0, eqIdx).trim();
    let val = line.substring(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool);

// Fitment data from Google AI Overview research
const fitmentData = [
  // === FORD MUSTANG SHELBY GT500 ===
  // 2020-2022 (S650)
  {
    make: "Ford", model: "Mustang Shelby GT500", years: [2020, 2021, 2022],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 20, width: 11, offset: 32 },
        rearWheel: { diameter: 20, width: 11, offset: 50 },
        frontTire: "305/30R20",
        rearTire: "315/30R20",
        boltPattern: "5x114.3",
        isStaggered: false, // Same diameter, slightly different width
      },
      {
        name: "Carbon Fiber Track Pack",
        frontWheel: { diameter: 20, width: 11, offset: 32 },
        rearWheel: { diameter: 20, width: 11.5, offset: 48 },
        frontTire: "305/30R20",
        rearTire: "315/30R20",
        boltPattern: "5x114.3",
        isStaggered: true,
      },
    ]
  },
  // 2013-2014 GT500
  {
    make: "Ford", model: "Mustang Shelby GT500", years: [2013, 2014],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 19, width: 9.5, offset: 44 },
        rearWheel: { diameter: 20, width: 11.5, offset: 50 },
        frontTire: "265/40R19",
        rearTire: "285/35R20",
        boltPattern: "5x114.3",
        isStaggered: true,
      },
    ]
  },
  // 2010-2012 GT500
  {
    make: "Ford", model: "Mustang Shelby GT500", years: [2010, 2011, 2012],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 19, width: 9.5, offset: 45 },
        rearWheel: { diameter: 19, width: 9.5, offset: 45 },
        frontTire: "255/40R19",
        rearTire: "285/35R19",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
  // 2007-2009 GT500
  {
    make: "Ford", model: "Mustang Shelby GT500", years: [2007, 2008, 2009],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 18, width: 9.5, offset: null },
        rearWheel: { diameter: 18, width: 9.5, offset: null },
        frontTire: "255/45R18",
        rearTire: "285/40R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },

  // === FORD MUSTANG MACH 1 ===
  // 2021-2023
  {
    make: "Ford", model: "Mustang Mach 1", years: [2021, 2022, 2023],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 19, width: 9.5, offset: 45 },
        rearWheel: { diameter: 19, width: 10, offset: 52.5 },
        frontTire: "255/40R19",
        rearTire: "275/40R19",
        boltPattern: "5x114.3",
        isStaggered: true,
      },
      {
        name: "Handling Package",
        frontWheel: { diameter: 19, width: 10.5, offset: 24 },
        rearWheel: { diameter: 19, width: 11, offset: 48 },
        frontTire: "305/30R19",
        rearTire: "315/30R19",
        boltPattern: "5x114.3",
        isStaggered: true,
      },
    ]
  },

  // === FORD MUSTANG SHELBY GT350 ===
  // 2015-2020
  {
    make: "Ford", model: "Mustang Shelby GT350", years: [2015, 2016, 2017, 2018, 2019, 2020],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 19, width: 10.5, offset: 30 },
        rearWheel: { diameter: 19, width: 11, offset: 60 },
        frontTire: "295/35R19",
        rearTire: "305/35R19",
        boltPattern: "5x114.3",
        isStaggered: true,
      },
      {
        name: "GT350R",
        frontWheel: { diameter: 19, width: 11, offset: 24 },
        rearWheel: { diameter: 19, width: 11.5, offset: 56 },
        frontTire: "305/30R19",
        rearTire: "315/30R19",
        boltPattern: "5x114.3",
        isStaggered: true,
      },
    ]
  },

  // === FORD F-450 SUPER DUTY (DRW) ===
  // 2017-2026
  {
    make: "Ford", model: "F-450 Super Duty", years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    trims: [
      {
        name: "DRW",
        frontWheel: { diameter: 19.5, width: 6, offset: 136 },
        rearWheel: { diameter: 19.5, width: 6, offset: 136 },
        frontTire: "LT225/70R19.5",
        rearTire: "LT225/70R19.5",
        boltPattern: "10x225",
        isStaggered: false,
      },
    ]
  },
  // 2008-2016 F-450
  {
    make: "Ford", model: "F-450 Super Duty", years: [2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016],
    trims: [
      {
        name: "DRW",
        frontWheel: { diameter: 19.5, width: 6, offset: 136 },
        rearWheel: { diameter: 19.5, width: 6, offset: 136 },
        frontTire: "LT225/70R19.5",
        rearTire: "LT225/70R19.5",
        boltPattern: "10x225",
        isStaggered: false,
      },
    ]
  },
];

async function main() {
  console.log("Updating performance vehicle fitments...\n");

  let updatedCount = 0;
  let insertedCount = 0;

  for (const vehicle of fitmentData) {
    for (const year of vehicle.years) {
      for (const trim of vehicle.trims) {
        // Build wheel sizes JSON
        const oemWheelSizes = [];
        
        // Front wheel
        oemWheelSizes.push({
          position: "front",
          diameter: trim.frontWheel.diameter,
          width: trim.frontWheel.width,
          offset: trim.frontWheel.offset,
          boltPattern: trim.boltPattern,
        });
        
        // Rear wheel (if staggered or different)
        oemWheelSizes.push({
          position: "rear",
          diameter: trim.rearWheel.diameter,
          width: trim.rearWheel.width,
          offset: trim.rearWheel.offset,
          boltPattern: trim.boltPattern,
        });

        // Build tire sizes JSON
        const oemTireSizes = [
          { position: "front", size: trim.frontTire },
          { position: "rear", size: trim.rearTire },
        ];

        // Generate modification_id
        const modificationId = `${year}-${vehicle.make}-${vehicle.model}-${trim.name}`.toLowerCase().replace(/\s+/g, '-');

        // Check if record exists
        const existing = await db.execute(sql`
          SELECT id FROM vehicle_fitments 
          WHERE year = ${year} 
            AND LOWER(make) = ${vehicle.make.toLowerCase()} 
            AND (LOWER(model) = ${vehicle.model.toLowerCase()} OR LOWER(model) = ${vehicle.model.toLowerCase().replace(/\s+/g, '-')})
            AND (LOWER(display_trim) = ${trim.name.toLowerCase()} OR LOWER(modification_id) = ${modificationId})
          LIMIT 1
        `);

        const wheelSizesJson = JSON.stringify(oemWheelSizes);
        const tireSizesJson = JSON.stringify(oemTireSizes);

        if (existing.rows.length > 0) {
          // Update existing record
          await db.execute(sql`
            UPDATE vehicle_fitments SET
              oem_wheel_sizes = ${wheelSizesJson}::jsonb,
              oem_tire_sizes = ${tireSizesJson}::jsonb,
              quality_tier = 'complete',
              updated_at = NOW()
            WHERE id = ${(existing.rows[0] as any).id}
          `);
          console.log(`  Updated: ${year} ${vehicle.make} ${vehicle.model} ${trim.name}`);
          updatedCount++;
        } else {
          // Insert new record
          await db.execute(sql`
            INSERT INTO vehicle_fitments (
              year, make, model, modification_id, display_trim,
              oem_wheel_sizes, oem_tire_sizes, quality_tier, source,
              created_at, updated_at
            ) VALUES (
              ${year}, ${vehicle.make}, ${vehicle.model}, ${modificationId}, ${trim.name},
              ${wheelSizesJson}::jsonb, ${tireSizesJson}::jsonb, 'complete', 'google-ai-overview',
              NOW(), NOW()
            )
          `);
          console.log(`  Inserted: ${year} ${vehicle.make} ${vehicle.model} ${trim.name}`);
          insertedCount++;
        }
      }
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Updated: ${updatedCount} records`);
  console.log(`Inserted: ${insertedCount} records`);

  await pool.end();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
