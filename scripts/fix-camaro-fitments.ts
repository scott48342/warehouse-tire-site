/**
 * Fix Chevrolet Camaro Fitments
 * Updates missing tire sizes and wheel specs for all Camaro trims
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

// Camaro fitment data from Google AI Overview
const fitmentData = [
  // === 6TH GEN CAMARO (2016-2024) ===
  {
    make: "Chevrolet", model: "Camaro", years: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
    trims: [
      {
        name: "LS",
        frontWheel: { diameter: 18, width: 8, offset: 35 },
        rearWheel: { diameter: 18, width: 8, offset: 35 },
        frontTire: "245/50R18",
        rearTire: "245/50R18",
        boltPattern: "5x120",
      },
      {
        name: "LT",
        frontWheel: { diameter: 18, width: 8, offset: 35 },
        rearWheel: { diameter: 18, width: 8, offset: 35 },
        frontTire: "245/50R18",
        rearTire: "245/50R18",
        boltPattern: "5x120",
      },
      {
        name: "SS",
        frontWheel: { diameter: 20, width: 8.5, offset: 30 },
        rearWheel: { diameter: 20, width: 9.5, offset: 35 },
        frontTire: "245/40R20",
        rearTire: "275/35R20",
        boltPattern: "5x120",
      },
      {
        name: "LT1",
        frontWheel: { diameter: 20, width: 8.5, offset: 30 },
        rearWheel: { diameter: 20, width: 9.5, offset: 35 },
        frontTire: "245/40R20",
        rearTire: "275/35R20",
        boltPattern: "5x120",
      },
      {
        name: "SS 1LE",
        frontWheel: { diameter: 20, width: 10, offset: 23 },
        rearWheel: { diameter: 20, width: 11, offset: 43 },
        frontTire: "285/30R20",
        rearTire: "305/30R20",
        boltPattern: "5x120",
      },
      {
        name: "ZL1",
        frontWheel: { diameter: 20, width: 10, offset: 23 },
        rearWheel: { diameter: 20, width: 11, offset: 43 },
        frontTire: "285/30R20",
        rearTire: "305/30R20",
        boltPattern: "5x120",
      },
      {
        name: "ZL1 1LE",
        frontWheel: { diameter: 19, width: 11, offset: 31 },
        rearWheel: { diameter: 19, width: 11.5, offset: 35 },
        frontTire: "305/30R19",
        rearTire: "325/30R19",
        boltPattern: "5x120",
      },
    ]
  },
  
  // === 5TH GEN CAMARO (2010-2015) ===
  {
    make: "Chevrolet", model: "Camaro", years: [2010, 2011, 2012, 2013, 2014, 2015],
    trims: [
      {
        name: "LS",
        frontWheel: { diameter: 18, width: 8, offset: 45 },
        rearWheel: { diameter: 18, width: 8, offset: 45 },
        frontTire: "245/55R18",
        rearTire: "245/55R18",
        boltPattern: "5x120",
      },
      {
        name: "LT",
        frontWheel: { diameter: 18, width: 8, offset: 45 },
        rearWheel: { diameter: 18, width: 8, offset: 45 },
        frontTire: "245/55R18",
        rearTire: "245/55R18",
        boltPattern: "5x120",
      },
      {
        name: "SS",
        frontWheel: { diameter: 20, width: 8, offset: 35 },
        rearWheel: { diameter: 20, width: 9, offset: 40 },
        frontTire: "245/45R20",
        rearTire: "275/40R20",
        boltPattern: "5x120",
      },
      {
        name: "Z/28",
        frontWheel: { diameter: 19, width: 11, offset: 30 },
        rearWheel: { diameter: 19, width: 11.5, offset: 40 },
        frontTire: "305/30R19",
        rearTire: "305/30R19",
        boltPattern: "5x120",
      },
    ]
  },
];

async function main() {
  console.log("Updating Chevrolet Camaro fitments...\n");

  let updatedCount = 0;
  let insertedCount = 0;

  for (const vehicle of fitmentData) {
    for (const year of vehicle.years) {
      for (const trim of vehicle.trims) {
        // Skip Z/28 for years that didn't have it (only 2014-2015)
        if (trim.name === "Z/28" && (year < 2014 || year > 2015)) {
          continue;
        }

        // Build wheel sizes JSON
        const oemWheelSizes = [
          {
            position: "front",
            diameter: trim.frontWheel.diameter,
            width: trim.frontWheel.width,
            offset: trim.frontWheel.offset,
            boltPattern: trim.boltPattern,
          },
          {
            position: "rear",
            diameter: trim.rearWheel.diameter,
            width: trim.rearWheel.width,
            offset: trim.rearWheel.offset,
            boltPattern: trim.boltPattern,
          },
        ];

        // Build tire sizes JSON
        const oemTireSizes = [
          { position: "front", size: trim.frontTire },
          { position: "rear", size: trim.rearTire },
        ];

        // Generate modification_id
        const modificationId = `${year}-${vehicle.make}-${vehicle.model}-${trim.name}`.toLowerCase().replace(/[\/\s]+/g, '-');

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
