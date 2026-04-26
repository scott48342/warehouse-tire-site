/**
 * Fix Other Makes Fitments
 * Updates missing tire sizes and wheel specs for Jaguar, Land Rover, Dodge, and Subaru
 * 
 * Vehicles:
 * - Jaguar XJ (2004-2019) - all trims
 * - Land Rover Range Rover Sport (2006-2026) - all trims
 * - Dodge Viper (2003-2017) - STAGGERED performance vehicle
 * - Subaru WRX STI (2015-2021)
 * - Subaru Impreza WRX STI (2014)
 * 
 * Source: Google AI Overview (approved research method)
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
  // ============================================================
  // DODGE VIPER (2003-2017) - STAGGERED PERFORMANCE VEHICLE
  // Google AI Overview: 6x114.3 bolt pattern, 71.6mm center bore
  // ============================================================
  
  // 2003-2010 Viper SRT-10 (ZB generation)
  {
    make: "Dodge", model: "Viper", years: [2003, 2004, 2005, 2006, 2008, 2009, 2010],
    trims: [
      {
        name: "SRT-10",
        frontWheel: { diameter: 18, width: 10, offset: 60 },
        rearWheel: { diameter: 19, width: 13, offset: 65 },
        frontTire: "275/35ZR18",
        rearTire: "345/30ZR19",
        boltPattern: "6x114.3", // CORRECTED from Google AI Overview
        isStaggered: true,
      },
    ]
  },
  // 2008-2010 Viper ACR
  {
    make: "Dodge", model: "Viper", years: [2008, 2009, 2010],
    trims: [
      {
        name: "SRT-10 ACR",
        frontWheel: { diameter: 18, width: 10, offset: 60 },
        rearWheel: { diameter: 19, width: 13, offset: 65 },
        frontTire: "275/35ZR18",
        rearTire: "345/30ZR19",
        boltPattern: "6x114.3",
        isStaggered: true,
      },
    ]
  },
  // 2013-2017 Viper (VX generation) - Google AI Overview data
  // Standard models: 18" front, 19" rear (18x10.5 front, 19x13 rear)
  // ACR models: 19" front and rear (19x11 front, 19x13 rear)
  {
    make: "Dodge", model: "Viper", years: [2013, 2014, 2015, 2016, 2017],
    trims: [
      {
        name: "SRT",
        frontWheel: { diameter: 18, width: 10.5, offset: 51 }, // ~50.8mm from AI Overview
        rearWheel: { diameter: 19, width: 13, offset: 71 }, // ~71.1mm from AI Overview
        frontTire: "295/30ZR18",
        rearTire: "355/30ZR19",
        boltPattern: "6x114.3",
        isStaggered: true,
      },
      {
        name: "GTS",
        frontWheel: { diameter: 18, width: 10.5, offset: 51 },
        rearWheel: { diameter: 19, width: 13, offset: 71 },
        frontTire: "295/30ZR18",
        rearTire: "355/30ZR19",
        boltPattern: "6x114.3",
        isStaggered: true,
      },
      {
        name: "GTC",
        frontWheel: { diameter: 18, width: 10.5, offset: 51 },
        rearWheel: { diameter: 19, width: 13, offset: 71 },
        frontTire: "295/30ZR18",
        rearTire: "355/30ZR19",
        boltPattern: "6x114.3",
        isStaggered: true,
      },
      {
        name: "TA",
        frontWheel: { diameter: 18, width: 10.5, offset: 51 },
        rearWheel: { diameter: 19, width: 13, offset: 71 },
        frontTire: "295/30ZR18",
        rearTire: "355/30ZR19",
        boltPattern: "6x114.3",
        isStaggered: true,
      },
      {
        name: "TA 2.0",
        frontWheel: { diameter: 18, width: 10.5, offset: 51 },
        rearWheel: { diameter: 19, width: 13, offset: 71 },
        frontTire: "295/30ZR18",
        rearTire: "355/30ZR19",
        boltPattern: "6x114.3",
        isStaggered: true,
      },
    ]
  },
  // ACR models (2016-2017) - 19" front wheels
  {
    make: "Dodge", model: "Viper", years: [2016, 2017],
    trims: [
      {
        name: "ACR",
        frontWheel: { diameter: 19, width: 11, offset: 30 },
        rearWheel: { diameter: 19, width: 13, offset: 35 },
        frontTire: "295/25ZR19",
        rearTire: "355/30ZR19",
        boltPattern: "6x114.3",
        isStaggered: true, // Different widths
      },
      {
        name: "ACR Extreme",
        frontWheel: { diameter: 19, width: 11, offset: 30 },
        rearWheel: { diameter: 19, width: 13, offset: 35 },
        frontTire: "295/25ZR19",
        rearTire: "355/30ZR19",
        boltPattern: "6x114.3",
        isStaggered: true,
      },
    ]
  },

  // ============================================================
  // JAGUAR XJ (2010-2019) - X351 Platform
  // Google AI Overview: 5x108 bolt pattern, 63.4mm hub bore, STAGGERED
  // ============================================================
  
  {
    make: "Jaguar", model: "XJ", years: [2010, 2011, 2012, 2013, 2014, 2015],
    trims: [
      // 18" square setup (lower trims)
      {
        name: "Base",
        frontWheel: { diameter: 18, width: 8, offset: 50.5 },
        rearWheel: { diameter: 18, width: 8, offset: 50.5 },
        frontTire: "245/50R18",
        rearTire: "245/50R18",
        boltPattern: "5x108",
        isStaggered: false,
      },
      // 19" staggered (Portfolio/Premium)
      {
        name: "Portfolio",
        frontWheel: { diameter: 19, width: 9, offset: 49 },
        rearWheel: { diameter: 19, width: 10, offset: 46 },
        frontTire: "245/45R19",
        rearTire: "275/40R19",
        boltPattern: "5x108",
        isStaggered: true,
      },
      {
        name: "XJL",
        frontWheel: { diameter: 19, width: 9, offset: 49 },
        rearWheel: { diameter: 19, width: 10, offset: 46 },
        frontTire: "245/45R19",
        rearTire: "275/40R19",
        boltPattern: "5x108",
        isStaggered: true,
      },
      // 20" staggered (Supercharged/Supersport)
      {
        name: "Supercharged",
        frontWheel: { diameter: 20, width: 9, offset: 49 },
        rearWheel: { diameter: 20, width: 10, offset: 46 },
        frontTire: "245/40ZR20",
        rearTire: "275/35ZR20",
        boltPattern: "5x108",
        isStaggered: true,
      },
      {
        name: "Supersport",
        frontWheel: { diameter: 20, width: 9, offset: 49 },
        rearWheel: { diameter: 20, width: 10, offset: 46 },
        frontTire: "245/40ZR20",
        rearTire: "275/35ZR20",
        boltPattern: "5x108",
        isStaggered: true,
      },
    ]
  },
  // 2016-2019 XJ (X351 refresh)
  {
    make: "Jaguar", model: "XJ", years: [2016, 2017, 2018, 2019],
    trims: [
      {
        name: "R-Sport",
        frontWheel: { diameter: 19, width: 9, offset: 49 },
        rearWheel: { diameter: 19, width: 10, offset: 46 },
        frontTire: "245/45R19",
        rearTire: "275/40R19",
        boltPattern: "5x108",
        isStaggered: true,
      },
      {
        name: "Portfolio",
        frontWheel: { diameter: 19, width: 9, offset: 49 },
        rearWheel: { diameter: 19, width: 10, offset: 46 },
        frontTire: "245/45R19",
        rearTire: "275/40R19",
        boltPattern: "5x108",
        isStaggered: true,
      },
      {
        name: "Supercharged",
        frontWheel: { diameter: 20, width: 9, offset: 49 },
        rearWheel: { diameter: 20, width: 10, offset: 46 },
        frontTire: "245/40ZR20",
        rearTire: "275/35ZR20",
        boltPattern: "5x108",
        isStaggered: true,
      },
      {
        name: "XJR575",
        frontWheel: { diameter: 20, width: 9, offset: 49 },
        rearWheel: { diameter: 20, width: 10, offset: 46 },
        frontTire: "245/40ZR20",
        rearTire: "275/35ZR20",
        boltPattern: "5x108",
        isStaggered: true,
      },
    ]
  },
  // Earlier Jaguar XJ (2004-2009) X350 platform - 5x120.65 bolt pattern
  {
    make: "Jaguar", model: "XJ", years: [2004, 2005, 2006, 2007, 2008, 2009],
    trims: [
      {
        name: "XJ8",
        frontWheel: { diameter: 18, width: 8, offset: 45 },
        rearWheel: { diameter: 18, width: 8, offset: 45 },
        frontTire: "235/50R18",
        rearTire: "235/50R18",
        boltPattern: "5x120.65",
        isStaggered: false,
      },
      {
        name: "Vanden Plas",
        frontWheel: { diameter: 18, width: 8, offset: 45 },
        rearWheel: { diameter: 18, width: 8, offset: 45 },
        frontTire: "235/50R18",
        rearTire: "235/50R18",
        boltPattern: "5x120.65",
        isStaggered: false,
      },
      {
        name: "Super V8",
        frontWheel: { diameter: 19, width: 8.5, offset: 49 },
        rearWheel: { diameter: 19, width: 8.5, offset: 49 },
        frontTire: "255/40R19",
        rearTire: "255/40R19",
        boltPattern: "5x120.65",
        isStaggered: false,
      },
    ]
  },

  // ============================================================
  // LAND ROVER RANGE ROVER SPORT (2014-2022) - L494 Platform
  // Google AI Overview: 5x120 bolt pattern, M14x1.5 lugs
  // ============================================================
  
  {
    make: "Land Rover", model: "Range Rover Sport", years: [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022],
    trims: [
      // 19" (SE base)
      {
        name: "SE",
        frontWheel: { diameter: 19, width: 8, offset: 45 },
        rearWheel: { diameter: 19, width: 8, offset: 45 },
        frontTire: "235/65R19",
        rearTire: "235/65R19",
        boltPattern: "5x120",
        isStaggered: false,
      },
      // 20" (HSE standard)
      {
        name: "HSE",
        frontWheel: { diameter: 20, width: 8.5, offset: 47 },
        rearWheel: { diameter: 20, width: 8.5, offset: 47 },
        frontTire: "255/55R20",
        rearTire: "255/55R20",
        boltPattern: "5x120",
        isStaggered: false,
      },
      // 21" (HSE Dynamic/Autobiography)
      {
        name: "HSE Dynamic",
        frontWheel: { diameter: 21, width: 9.5, offset: 49 },
        rearWheel: { diameter: 21, width: 9.5, offset: 49 },
        frontTire: "275/45R21",
        rearTire: "275/45R21",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "Autobiography",
        frontWheel: { diameter: 21, width: 9.5, offset: 49 },
        rearWheel: { diameter: 21, width: 9.5, offset: 49 },
        frontTire: "275/45R21",
        rearTire: "275/45R21",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "Supercharged",
        frontWheel: { diameter: 21, width: 9.5, offset: 49 },
        rearWheel: { diameter: 21, width: 9.5, offset: 49 },
        frontTire: "275/45R21",
        rearTire: "275/45R21",
        boltPattern: "5x120",
        isStaggered: false,
      },
      // 22" (SVR/High performance)
      {
        name: "SVR",
        frontWheel: { diameter: 22, width: 9.5, offset: 45 },
        rearWheel: { diameter: 22, width: 9.5, offset: 45 },
        frontTire: "295/40R22",
        rearTire: "295/40R22",
        boltPattern: "5x120",
        isStaggered: false,
      },
    ]
  },
  // Earlier Range Rover Sport (2006-2013) L320 platform
  {
    make: "Land Rover", model: "Range Rover Sport", years: [2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013],
    trims: [
      {
        name: "HSE",
        frontWheel: { diameter: 19, width: 8, offset: 57 },
        rearWheel: { diameter: 19, width: 8, offset: 57 },
        frontTire: "255/50R19",
        rearTire: "255/50R19",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "Supercharged",
        frontWheel: { diameter: 20, width: 9, offset: 53 },
        rearWheel: { diameter: 20, width: 9, offset: 53 },
        frontTire: "275/40R20",
        rearTire: "275/40R20",
        boltPattern: "5x120",
        isStaggered: false,
      },
    ]
  },
  // 2023-2026 Range Rover Sport (L461) - New generation
  {
    make: "Land Rover", model: "Range Rover Sport", years: [2023, 2024, 2025, 2026],
    trims: [
      {
        name: "SE",
        frontWheel: { diameter: 21, width: 9.5, offset: 45 },
        rearWheel: { diameter: 21, width: 9.5, offset: 45 },
        frontTire: "275/50R21",
        rearTire: "275/50R21",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "Dynamic SE",
        frontWheel: { diameter: 22, width: 9.5, offset: 45 },
        rearWheel: { diameter: 22, width: 9.5, offset: 45 },
        frontTire: "285/45R22",
        rearTire: "285/45R22",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "Autobiography",
        frontWheel: { diameter: 22, width: 9.5, offset: 45 },
        rearWheel: { diameter: 22, width: 9.5, offset: 45 },
        frontTire: "285/45R22",
        rearTire: "285/45R22",
        boltPattern: "5x120",
        isStaggered: false,
      },
      {
        name: "SV",
        frontWheel: { diameter: 23, width: 10, offset: 42 },
        rearWheel: { diameter: 23, width: 10, offset: 42 },
        frontTire: "285/40R23",
        rearTire: "285/40R23",
        boltPattern: "5x120",
        isStaggered: false,
      },
    ]
  },

  // ============================================================
  // SUBARU WRX STI (2015-2021)
  // Google AI Overview: 5x114.3 bolt pattern, 56.1mm hub bore, +55mm offset
  // ============================================================
  
  // 2015-2017: 18" wheels (245/40R18)
  {
    make: "Subaru", model: "WRX STI", years: [2015, 2016, 2017],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 18, width: 8.5, offset: 55 },
        rearWheel: { diameter: 18, width: 8.5, offset: 55 },
        frontTire: "245/40R18",
        rearTire: "245/40R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Limited",
        frontWheel: { diameter: 18, width: 8.5, offset: 55 },
        rearWheel: { diameter: 18, width: 8.5, offset: 55 },
        frontTire: "245/40R18",
        rearTire: "245/40R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Launch Edition",
        frontWheel: { diameter: 18, width: 8.5, offset: 55 },
        rearWheel: { diameter: 18, width: 8.5, offset: 55 },
        frontTire: "245/40R18",
        rearTire: "245/40R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
  // 2018-2021: 19" wheels (245/35R19) - upgraded Brembo brakes
  {
    make: "Subaru", model: "WRX STI", years: [2018, 2019, 2020, 2021],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 19, width: 8.5, offset: 55 },
        rearWheel: { diameter: 19, width: 8.5, offset: 55 },
        frontTire: "245/35R19",
        rearTire: "245/35R19",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Limited",
        frontWheel: { diameter: 19, width: 8.5, offset: 55 },
        rearWheel: { diameter: 19, width: 8.5, offset: 55 },
        frontTire: "245/35R19",
        rearTire: "245/35R19",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Series.Gray",
        frontWheel: { diameter: 19, width: 8.5, offset: 55 },
        rearWheel: { diameter: 19, width: 8.5, offset: 55 },
        frontTire: "245/35R19",
        rearTire: "245/35R19",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
  // 2014 Impreza WRX STI (final year as Impreza-badged)
  {
    make: "Subaru", model: "Impreza WRX STI", years: [2014],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 18, width: 8.5, offset: 55 },
        rearWheel: { diameter: 18, width: 8.5, offset: 55 },
        frontTire: "245/40R18",
        rearTire: "245/40R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "Limited",
        frontWheel: { diameter: 18, width: 8.5, offset: 55 },
        rearWheel: { diameter: 18, width: 8.5, offset: 55 },
        frontTire: "245/40R18",
        rearTire: "245/40R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
];

async function main() {
  console.log("Updating fitments for Jaguar, Land Rover, Dodge, and Subaru...\n");
  console.log("Source: Google AI Overview\n");

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
        
        // Rear wheel
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
            AND (LOWER(display_trim) = ${trim.name.toLowerCase()} OR LOWER(modification_id) LIKE ${'%' + trim.name.toLowerCase().replace(/\s+/g, '-') + '%'})
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
  console.log(`\nVehicles covered (from Google AI Overview):`);
  console.log(`- Dodge Viper (2003-2017): STAGGERED - 6x114.3 bolt pattern, 18"/19" combo`);
  console.log(`- Jaguar XJ (2004-2019): 5x108 (2010+) or 5x120.65 (2004-2009), staggered 19"/20"`);
  console.log(`- Land Rover Range Rover Sport (2006-2026): 5x120, 19"-23" by trim`);
  console.log(`- Subaru WRX STI (2015-2021): 5x114.3, 18" (2015-2017) or 19" (2018-2021)`);
  console.log(`- Subaru Impreza WRX STI (2014): 5x114.3, 18" wheels`);

  await pool.end();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
