/**
 * Fix Chevrolet Vehicle Fitments
 * Updates missing tire sizes and wheel specs for Chevrolet vehicles
 * 
 * Vehicles:
 * - Corvette 2025 (E-Ray, Stingray, Z06, ZR1) - STAGGERED
 * - Blazer (2019-2026)
 * - Trailblazer (2021-2026)
 * - Suburban 1500 (2007-2014)
 * - Suburban 2500 (2007-2013)
 * - Express 1500 (1996-2014)
 * 
 * Source: Google AI Overview research
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
  // === 2025 CORVETTE E-RAY (STAGGERED 20/21) ===
  {
    make: "Chevrolet", model: "Corvette", years: [2024, 2025, 2026],
    trims: [
      {
        name: "E-Ray 1LZ",
        frontWheel: { diameter: 20, width: 10, offset: 35 },
        rearWheel: { diameter: 21, width: 13, offset: 40 },
        frontTire: "275/30ZR20",
        rearTire: "345/25ZR21",
        boltPattern: "5x120",
        isStaggered: true,
      },
      {
        name: "E-Ray 3LZ",
        frontWheel: { diameter: 20, width: 10, offset: 35 },
        rearWheel: { diameter: 21, width: 13, offset: 40 },
        frontTire: "275/30ZR20",
        rearTire: "345/25ZR21",
        boltPattern: "5x120",
        isStaggered: true,
      },
    ]
  },

  // === 2025 CORVETTE STINGRAY (STAGGERED 19/20) ===
  {
    make: "Chevrolet", model: "Corvette", years: [2020, 2021, 2022, 2023, 2024, 2025, 2026],
    trims: [
      {
        name: "Stingray 1LT",
        frontWheel: { diameter: 19, width: 8.5, offset: 45 },
        rearWheel: { diameter: 20, width: 11, offset: 52 },
        frontTire: "245/35ZR19",
        rearTire: "305/30ZR20",
        boltPattern: "5x120",
        isStaggered: true,
      },
      {
        name: "Stingray 2LT",
        frontWheel: { diameter: 19, width: 8.5, offset: 45 },
        rearWheel: { diameter: 20, width: 11, offset: 52 },
        frontTire: "245/35ZR19",
        rearTire: "305/30ZR20",
        boltPattern: "5x120",
        isStaggered: true,
      },
      {
        name: "Stingray 3LT",
        frontWheel: { diameter: 19, width: 8.5, offset: 45 },
        rearWheel: { diameter: 20, width: 11, offset: 52 },
        frontTire: "245/35ZR19",
        rearTire: "305/30ZR20",
        boltPattern: "5x120",
        isStaggered: true,
      },
    ]
  },

  // === 2025 CORVETTE Z06 (STAGGERED 20/21) ===
  {
    make: "Chevrolet", model: "Corvette", years: [2023, 2024, 2025, 2026],
    trims: [
      {
        name: "Z06 1LZ",
        frontWheel: { diameter: 20, width: 10, offset: 35 },
        rearWheel: { diameter: 21, width: 13, offset: 40 },
        frontTire: "275/30ZR20",
        rearTire: "345/25ZR21",
        boltPattern: "5x120",
        isStaggered: true,
      },
      {
        name: "Z06 3LZ",
        frontWheel: { diameter: 20, width: 10, offset: 35 },
        rearWheel: { diameter: 21, width: 13, offset: 40 },
        frontTire: "275/30ZR20",
        rearTire: "345/25ZR21",
        boltPattern: "5x120",
        isStaggered: true,
      },
    ]
  },

  // === 2025 CORVETTE ZR1 (STAGGERED 20/21) ===
  {
    make: "Chevrolet", model: "Corvette", years: [2025, 2026],
    trims: [
      {
        name: "ZR1",
        frontWheel: { diameter: 20, width: 10, offset: 35 },
        rearWheel: { diameter: 21, width: 13, offset: 40 },
        frontTire: "275/30ZR20",
        rearTire: "345/25ZR21",
        boltPattern: "5x120",
        isStaggered: true,
      },
      {
        name: "ZR1 1LZ",
        frontWheel: { diameter: 20, width: 10, offset: 35 },
        rearWheel: { diameter: 21, width: 13, offset: 40 },
        frontTire: "275/30ZR20",
        rearTire: "345/25ZR21",
        boltPattern: "5x120",
        isStaggered: true,
      },
      {
        name: "ZR1 3LZ",
        frontWheel: { diameter: 20, width: 10, offset: 35 },
        rearWheel: { diameter: 21, width: 13, offset: 40 },
        frontTire: "275/30ZR20",
        rearTire: "345/25ZR21",
        boltPattern: "5x120",
        isStaggered: true,
      },
    ]
  },

  // === CHEVROLET BLAZER (2019-2026) ===
  // Base trims - 18" wheels
  {
    make: "Chevrolet", model: "Blazer", years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    trims: [
      {
        name: "L",
        frontWheel: { diameter: 18, width: 8, offset: 50 },
        rearWheel: { diameter: 18, width: 8, offset: 50 },
        frontTire: "235/65R18",
        rearTire: "235/65R18",
        boltPattern: "6x120",
        isStaggered: false,
      },
      {
        name: "LS",
        frontWheel: { diameter: 18, width: 8, offset: 50 },
        rearWheel: { diameter: 18, width: 8, offset: 50 },
        frontTire: "235/65R18",
        rearTire: "235/65R18",
        boltPattern: "6x120",
        isStaggered: false,
      },
      {
        name: "LT",
        frontWheel: { diameter: 20, width: 8, offset: 50 },
        rearWheel: { diameter: 20, width: 8, offset: 50 },
        frontTire: "235/55R20",
        rearTire: "235/55R20",
        boltPattern: "6x120",
        isStaggered: false,
      },
      {
        name: "RS",
        frontWheel: { diameter: 21, width: 8.5, offset: 50 },
        rearWheel: { diameter: 21, width: 8.5, offset: 50 },
        frontTire: "265/45R21",
        rearTire: "265/45R21",
        boltPattern: "6x120",
        isStaggered: false,
      },
      {
        name: "Premier",
        frontWheel: { diameter: 21, width: 8.5, offset: 50 },
        rearWheel: { diameter: 21, width: 8.5, offset: 50 },
        frontTire: "265/45R21",
        rearTire: "265/45R21",
        boltPattern: "6x120",
        isStaggered: false,
      },
    ]
  },

  // === CHEVROLET TRAILBLAZER (2021-2026) ===
  {
    make: "Chevrolet", model: "Trailblazer", years: [2021, 2022, 2023, 2024, 2025, 2026],
    trims: [
      {
        name: "L",
        frontWheel: { diameter: 17, width: 7, offset: 45 },
        rearWheel: { diameter: 17, width: 7, offset: 45 },
        frontTire: "225/60R17",
        rearTire: "225/60R17",
        boltPattern: "5x105",
        isStaggered: false,
      },
      {
        name: "LS",
        frontWheel: { diameter: 17, width: 7, offset: 45 },
        rearWheel: { diameter: 17, width: 7, offset: 45 },
        frontTire: "225/60R17",
        rearTire: "225/60R17",
        boltPattern: "5x105",
        isStaggered: false,
      },
      {
        name: "LT",
        frontWheel: { diameter: 17, width: 7, offset: 45 },
        rearWheel: { diameter: 17, width: 7, offset: 45 },
        frontTire: "225/60R17",
        rearTire: "225/60R17",
        boltPattern: "5x105",
        isStaggered: false,
      },
      {
        name: "RS",
        frontWheel: { diameter: 19, width: 7.5, offset: 45 },
        rearWheel: { diameter: 19, width: 7.5, offset: 45 },
        frontTire: "245/45R19",
        rearTire: "245/45R19",
        boltPattern: "5x105",
        isStaggered: false,
      },
      {
        name: "ACTIV",
        frontWheel: { diameter: 17, width: 7, offset: 45 },
        rearWheel: { diameter: 17, width: 7, offset: 45 },
        frontTire: "225/60R17",
        rearTire: "225/60R17",
        boltPattern: "5x105",
        isStaggered: false,
      },
    ]
  },

  // === CHEVROLET SUBURBAN 1500 (2007-2014) ===
  {
    make: "Chevrolet", model: "Suburban 1500", years: [2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014],
    trims: [
      {
        name: "LS",
        frontWheel: { diameter: 17, width: 7.5, offset: 31 },
        rearWheel: { diameter: 17, width: 7.5, offset: 31 },
        frontTire: "265/70R17",
        rearTire: "265/70R17",
        boltPattern: "6x139.7",
        isStaggered: false,
      },
      {
        name: "LT",
        frontWheel: { diameter: 17, width: 7.5, offset: 31 },
        rearWheel: { diameter: 17, width: 7.5, offset: 31 },
        frontTire: "265/70R17",
        rearTire: "265/70R17",
        boltPattern: "6x139.7",
        isStaggered: false,
      },
      {
        name: "LTZ",
        frontWheel: { diameter: 20, width: 8.5, offset: 31 },
        rearWheel: { diameter: 20, width: 8.5, offset: 31 },
        frontTire: "275/55R20",
        rearTire: "275/55R20",
        boltPattern: "6x139.7",
        isStaggered: false,
      },
      {
        name: "Z71",
        frontWheel: { diameter: 18, width: 8, offset: 31 },
        rearWheel: { diameter: 18, width: 8, offset: 31 },
        frontTire: "265/65R18",
        rearTire: "265/65R18",
        boltPattern: "6x139.7",
        isStaggered: false,
      },
    ]
  },

  // === CHEVROLET SUBURBAN 2500 (2007-2013) ===
  {
    make: "Chevrolet", model: "Suburban 2500", years: [2007, 2008, 2009, 2010, 2011, 2012, 2013],
    trims: [
      {
        name: "LS",
        frontWheel: { diameter: 17, width: 7.5, offset: 31 },
        rearWheel: { diameter: 17, width: 7.5, offset: 31 },
        frontTire: "LT265/70R17",
        rearTire: "LT265/70R17",
        boltPattern: "8x165.1",
        isStaggered: false,
      },
      {
        name: "LT",
        frontWheel: { diameter: 17, width: 7.5, offset: 31 },
        rearWheel: { diameter: 17, width: 7.5, offset: 31 },
        frontTire: "LT265/70R17",
        rearTire: "LT265/70R17",
        boltPattern: "8x165.1",
        isStaggered: false,
      },
      {
        name: "Base",
        frontWheel: { diameter: 16, width: 6.5, offset: 28 },
        rearWheel: { diameter: 16, width: 6.5, offset: 28 },
        frontTire: "LT245/75R16",
        rearTire: "LT245/75R16",
        boltPattern: "8x165.1",
        isStaggered: false,
      },
    ]
  },

  // === CHEVROLET EXPRESS 1500 (1996-2002) ===
  {
    make: "Chevrolet", model: "Express 1500", years: [1996, 1997, 1998, 1999, 2000, 2001, 2002],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 15, width: 6, offset: 12 },
        rearWheel: { diameter: 15, width: 6, offset: 12 },
        frontTire: "215/75R15",
        rearTire: "215/75R15",
        boltPattern: "6x139.7",
        isStaggered: false,
      },
      {
        name: "Cargo",
        frontWheel: { diameter: 15, width: 7, offset: 13 },
        rearWheel: { diameter: 15, width: 7, offset: 13 },
        frontTire: "235/75R15",
        rearTire: "235/75R15",
        boltPattern: "6x139.7",
        isStaggered: false,
      },
      {
        name: "Passenger",
        frontWheel: { diameter: 15, width: 7, offset: 13 },
        rearWheel: { diameter: 15, width: 7, offset: 13 },
        frontTire: "235/75R15",
        rearTire: "235/75R15",
        boltPattern: "6x139.7",
        isStaggered: false,
      },
    ]
  },

  // === CHEVROLET EXPRESS 1500 (2003-2014) ===
  {
    make: "Chevrolet", model: "Express 1500", years: [2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 16, width: 6.5, offset: 28 },
        rearWheel: { diameter: 16, width: 6.5, offset: 28 },
        frontTire: "245/75R16",
        rearTire: "245/75R16",
        boltPattern: "6x139.7",
        isStaggered: false,
      },
      {
        name: "Cargo",
        frontWheel: { diameter: 17, width: 7.5, offset: 31 },
        rearWheel: { diameter: 17, width: 7.5, offset: 31 },
        frontTire: "245/70R17",
        rearTire: "245/70R17",
        boltPattern: "6x139.7",
        isStaggered: false,
      },
      {
        name: "Passenger",
        frontWheel: { diameter: 17, width: 7.5, offset: 31 },
        rearWheel: { diameter: 17, width: 7.5, offset: 31 },
        frontTire: "245/70R17",
        rearTire: "245/70R17",
        boltPattern: "6x139.7",
        isStaggered: false,
      },
      {
        name: "LS",
        frontWheel: { diameter: 16, width: 6.5, offset: 28 },
        rearWheel: { diameter: 16, width: 6.5, offset: 28 },
        frontTire: "235/75R16",
        rearTire: "235/75R16",
        boltPattern: "6x139.7",
        isStaggered: false,
      },
      {
        name: "LT",
        frontWheel: { diameter: 17, width: 7.5, offset: 31 },
        rearWheel: { diameter: 17, width: 7.5, offset: 31 },
        frontTire: "245/70R17",
        rearTire: "245/70R17",
        boltPattern: "6x139.7",
        isStaggered: false,
      },
    ]
  },
];

async function main() {
  console.log("Updating Chevrolet vehicle fitments...\n");

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

        // Check if record exists - try multiple matching strategies
        const existing = await db.execute(sql`
          SELECT id FROM vehicle_fitments 
          WHERE year = ${year} 
            AND LOWER(make) = ${vehicle.make.toLowerCase()} 
            AND (
              LOWER(model) = ${vehicle.model.toLowerCase()} 
              OR LOWER(model) = ${vehicle.model.toLowerCase().replace(/\s+/g, '-')}
              OR LOWER(model) LIKE ${vehicle.model.toLowerCase().split(' ')[0] + '%'}
            )
            AND (
              LOWER(display_trim) = ${trim.name.toLowerCase()} 
              OR LOWER(modification_id) = ${modificationId}
              OR LOWER(modification_id) LIKE ${'%' + trim.name.toLowerCase().replace(/\s+/g, '-') + '%'}
            )
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
              source = 'google-ai-overview',
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
  console.log(`Total processed: ${updatedCount + insertedCount} records`);

  await pool.end();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
