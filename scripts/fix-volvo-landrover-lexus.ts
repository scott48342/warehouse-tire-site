/**
 * Fix Volvo, Land Rover, and Lexus Fitments
 * Updates missing tire sizes and wheel specs for 147 records
 * 
 * Makes covered:
 * - VOLVO: S80, S40, S70, V50, V90, C40, XC40, XC60, XC90, EX30, EX40, EX90
 * - LAND ROVER: Discovery, Discovery Sport, Range Rover Sport, Range Rover Velar
 * - LEXUS: RC F (staggered), LC (staggered), RC, UX
 * 
 * Source: OEM specifications (Google AI Overview research method)
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

// ============================================================================
// FITMENT DATA - Based on OEM specifications
// ============================================================================

interface WheelSpec {
  diameter: number;
  width: number;
  offset: number;
}

interface TrimSpec {
  name: string;
  frontWheel: WheelSpec;
  rearWheel: WheelSpec;
  frontTire: string;
  rearTire: string;
  boltPattern: string;
  centerBore?: number;
  isStaggered: boolean;
}

interface VehicleSpec {
  make: string;
  model: string;
  years: number[];
  trims: TrimSpec[];
}

const fitmentData: VehicleSpec[] = [
  // ============================================================================
  // VOLVO VEHICLES
  // All modern Volvos: 5x108 bolt pattern, 63.3mm center bore
  // ============================================================================

  // VOLVO S80 - First Gen (1999-2006): 16"/17" wheels
  {
    make: "Volvo", model: "s80", years: [2000, 2001, 2002, 2003, 2004, 2005, 2006],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 17, width: 7.5, offset: 43 },
        rearWheel: { diameter: 17, width: 7.5, offset: 43 },
        frontTire: "225/50R17",
        rearTire: "225/50R17",
        boltPattern: "5x108",
        centerBore: 63.3,
        isStaggered: false,
      },
    ]
  },
  // VOLVO S80 - Second Gen (2007-2016): 17"/18" wheels
  {
    make: "Volvo", model: "s80", years: [2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 18, width: 8, offset: 44 },
        rearWheel: { diameter: 18, width: 8, offset: 44 },
        frontTire: "245/45R18",
        rearTire: "245/45R18",
        boltPattern: "5x108",
        centerBore: 63.3,
        isStaggered: false,
      },
    ]
  },

  // VOLVO S40 - First Gen (2000-2004): 15"/16" wheels
  {
    make: "Volvo", model: "s40", years: [2000, 2001, 2002, 2003, 2004],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 16, width: 6.5, offset: 43 },
        rearWheel: { diameter: 16, width: 6.5, offset: 43 },
        frontTire: "205/55R16",
        rearTire: "205/55R16",
        boltPattern: "5x108",
        centerBore: 63.3,
        isStaggered: false,
      },
    ]
  },
  // VOLVO S40 - Second Gen (2004-2012): 16"/17" wheels
  {
    make: "Volvo", model: "s40", years: [2005, 2006, 2007, 2008, 2009, 2010, 2011],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 17, width: 7, offset: 49 },
        rearWheel: { diameter: 17, width: 7, offset: 49 },
        frontTire: "215/50R17",
        rearTire: "215/50R17",
        boltPattern: "5x108",
        centerBore: 63.3,
        isStaggered: false,
      },
    ]
  },

  // VOLVO S70 (1998-2000)
  {
    make: "Volvo", model: "s70", years: [2000],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 16, width: 6.5, offset: 43 },
        rearWheel: { diameter: 16, width: 6.5, offset: 43 },
        frontTire: "205/55R16",
        rearTire: "205/55R16",
        boltPattern: "5x108",
        centerBore: 63.3,
        isStaggered: false,
      },
    ]
  },

  // VOLVO V50 (2004-2012)
  {
    make: "Volvo", model: "v50", years: [2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 17, width: 7, offset: 49 },
        rearWheel: { diameter: 17, width: 7, offset: 49 },
        frontTire: "215/50R17",
        rearTire: "215/50R17",
        boltPattern: "5x108",
        centerBore: 63.3,
        isStaggered: false,
      },
    ]
  },

  // VOLVO V90 (2018-2021) - all trims share same base specs
  {
    make: "Volvo", model: "v90", years: [2018, 2019, 2021],
    trims: [
      {
        name: "T5",
        frontWheel: { diameter: 19, width: 8, offset: 42 },
        rearWheel: { diameter: 19, width: 8, offset: 42 },
        frontTire: "245/45R19",
        rearTire: "245/45R19",
        boltPattern: "5x108",
        centerBore: 63.3,
        isStaggered: false,
      },
      {
        name: "T6",
        frontWheel: { diameter: 19, width: 8, offset: 42 },
        rearWheel: { diameter: 19, width: 8, offset: 42 },
        frontTire: "245/45R19",
        rearTire: "245/45R19",
        boltPattern: "5x108",
        centerBore: 63.3,
        isStaggered: false,
      },
      {
        name: "T8",
        frontWheel: { diameter: 19, width: 8, offset: 42 },
        rearWheel: { diameter: 19, width: 8, offset: 42 },
        frontTire: "245/45R19",
        rearTire: "245/45R19",
        boltPattern: "5x108",
        centerBore: 63.3,
        isStaggered: false,
      },
      {
        name: "Cross Country",
        frontWheel: { diameter: 19, width: 8, offset: 42 },
        rearWheel: { diameter: 19, width: 8, offset: 42 },
        frontTire: "245/45R19",
        rearTire: "245/45R19",
        boltPattern: "5x108",
        centerBore: 63.3,
        isStaggered: false,
      },
      {
        name: "T5, T6, T8, Cross Country",
        frontWheel: { diameter: 19, width: 8, offset: 42 },
        rearWheel: { diameter: 19, width: 8, offset: 42 },
        frontTire: "245/45R19",
        rearTire: "245/45R19",
        boltPattern: "5x108",
        centerBore: 63.3,
        isStaggered: false,
      },
    ]
  },

  // VOLVO C40 Recharge (2022+) - Electric crossover coupe
  {
    make: "Volvo", model: "c40", years: [2021, 2022, 2023, 2024, 2025],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 19, width: 8, offset: 42 },
        rearWheel: { diameter: 19, width: 8, offset: 42 },
        frontTire: "235/50R19",
        rearTire: "235/50R19",
        boltPattern: "5x108",
        centerBore: 63.3,
        isStaggered: false,
      },
    ]
  },

  // VOLVO XC40 (2019+)
  {
    make: "Volvo", model: "xc40", years: [2023, 2024, 2025, 2026],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 19, width: 8, offset: 42 },
        rearWheel: { diameter: 19, width: 8, offset: 42 },
        frontTire: "235/50R19",
        rearTire: "235/50R19",
        boltPattern: "5x108",
        centerBore: 63.3,
        isStaggered: false,
      },
    ]
  },

  // VOLVO XC60 (2018+)
  {
    make: "Volvo", model: "xc60", years: [2026],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 19, width: 8, offset: 42 },
        rearWheel: { diameter: 19, width: 8, offset: 42 },
        frontTire: "255/45R19",
        rearTire: "255/45R19",
        boltPattern: "5x108",
        centerBore: 63.3,
        isStaggered: false,
      },
    ]
  },

  // VOLVO XC90 (2016+)
  {
    make: "Volvo", model: "xc90", years: [2026],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 20, width: 9, offset: 40 },
        rearWheel: { diameter: 20, width: 9, offset: 40 },
        frontTire: "255/45R20",
        rearTire: "255/45R20",
        boltPattern: "5x108",
        centerBore: 63.3,
        isStaggered: false,
      },
    ]
  },

  // VOLVO EX30 (2024+) - Entry electric SUV
  {
    make: "Volvo", model: "ex30", years: [2025, 2026],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 19, width: 7.5, offset: 45 },
        rearWheel: { diameter: 19, width: 7.5, offset: 45 },
        frontTire: "235/50R19",
        rearTire: "235/50R19",
        boltPattern: "5x108",
        centerBore: 63.3,
        isStaggered: false,
      },
    ]
  },

  // VOLVO EX40 (2025+) - Renamed C40/XC40 EV
  {
    make: "Volvo", model: "ex40", years: [2025, 2026],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 19, width: 8, offset: 42 },
        rearWheel: { diameter: 19, width: 8, offset: 42 },
        frontTire: "235/50R19",
        rearTire: "235/50R19",
        boltPattern: "5x108",
        centerBore: 63.3,
        isStaggered: false,
      },
    ]
  },

  // VOLVO EX90 (2024+) - Flagship electric SUV
  {
    make: "Volvo", model: "ex90", years: [2025, 2026],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 21, width: 9.5, offset: 36 },
        rearWheel: { diameter: 21, width: 9.5, offset: 36 },
        frontTire: "265/45R21",
        rearTire: "265/45R21",
        boltPattern: "5x108",
        centerBore: 63.3,
        isStaggered: false,
      },
    ]
  },

  // ============================================================================
  // LAND ROVER VEHICLES
  // Discovery/Range Rover use 5x120 with 72.6mm center bore
  // Discovery Sport/Velar use 5x108 with 63.4mm center bore
  // ============================================================================

  // LAND ROVER DISCOVERY LR3 (2005-2009) & LR4 (2010-2016)
  // Note: In US market, "Discovery" was called "LR3" (2005-2009) and "LR4" (2010-2016)
  {
    make: "Land Rover", model: "Discovery", years: [2005, 2006, 2007, 2008, 2009],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 18, width: 8, offset: 53 },
        rearWheel: { diameter: 18, width: 8, offset: 53 },
        frontTire: "255/55R18",
        rearTire: "255/55R18",
        boltPattern: "5x120",
        centerBore: 72.6,
        isStaggered: false,
      },
    ]
  },
  {
    make: "Land Rover", model: "Discovery", years: [2010, 2011],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 19, width: 8, offset: 53 },
        rearWheel: { diameter: 19, width: 8, offset: 53 },
        frontTire: "255/55R19",
        rearTire: "255/55R19",
        boltPattern: "5x120",
        centerBore: 72.6,
        isStaggered: false,
      },
    ]
  },

  // LAND ROVER DISCOVERY SPORT (2015+) - Uses 5x108 bolt pattern
  {
    make: "Land Rover", model: "Discovery Sport", years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 19, width: 8, offset: 45 },
        rearWheel: { diameter: 19, width: 8, offset: 45 },
        frontTire: "235/55R19",
        rearTire: "235/55R19",
        boltPattern: "5x108",
        centerBore: 63.4,
        isStaggered: false,
      },
    ]
  },

  // LAND ROVER RANGE ROVER SPORT - First Gen (2006-2013)
  {
    make: "Land Rover", model: "Range Rover Sport", years: [2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 20, width: 9.5, offset: 53 },
        rearWheel: { diameter: 20, width: 9.5, offset: 53 },
        frontTire: "275/45R20",
        rearTire: "275/45R20",
        boltPattern: "5x120",
        centerBore: 72.6,
        isStaggered: false,
      },
    ]
  },

  // LAND ROVER RANGE ROVER VELAR (2018+) - Uses 5x108 bolt pattern
  {
    make: "Land Rover", model: "Range Rover Velar", years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 20, width: 9, offset: 42 },
        rearWheel: { diameter: 20, width: 9, offset: 42 },
        frontTire: "255/50R20",
        rearTire: "255/50R20",
        boltPattern: "5x108",
        centerBore: 63.4,
        isStaggered: false,
      },
    ]
  },

  // ============================================================================
  // LEXUS VEHICLES
  // All Lexus: 5x114.3 bolt pattern, 60.1mm center bore
  // RC F and LC are STAGGERED performance vehicles
  // ============================================================================

  // LEXUS RC F (2015-2025) - STAGGERED performance coupe
  // Front: 19x9 with 255/35ZR19 | Rear: 19x10 with 275/35ZR19
  {
    make: "Lexus", model: "RC F", years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 19, width: 9, offset: 50 },
        rearWheel: { diameter: 19, width: 10, offset: 48 },
        frontTire: "255/35ZR19",
        rearTire: "275/35ZR19",
        boltPattern: "5x114.3",
        centerBore: 60.1,
        isStaggered: true,
      },
    ]
  },

  // LEXUS LC 500/500h (2018+) - STAGGERED grand tourer
  // LC 500: 21x9 front / 21x10.5 rear with 245/40RF21 / 275/35RF21
  {
    make: "Lexus", model: "lc", years: [2018, 2019],
    trims: [
      {
        name: "LC 500",
        frontWheel: { diameter: 21, width: 9, offset: 25 },
        rearWheel: { diameter: 21, width: 10.5, offset: 38 },
        frontTire: "245/40RF21",
        rearTire: "275/35RF21",
        boltPattern: "5x114.3",
        centerBore: 60.1,
        isStaggered: true,
      },
      {
        name: "LC 500h",
        frontWheel: { diameter: 20, width: 8.5, offset: 32 },
        rearWheel: { diameter: 20, width: 9.5, offset: 40 },
        frontTire: "245/45RF20",
        rearTire: "275/40RF20",
        boltPattern: "5x114.3",
        centerBore: 60.1,
        isStaggered: true,
      },
      {
        name: "LC 500, LC 500h",
        frontWheel: { diameter: 21, width: 9, offset: 25 },
        rearWheel: { diameter: 21, width: 10.5, offset: 38 },
        frontTire: "245/40RF21",
        rearTire: "275/35RF21",
        boltPattern: "5x114.3",
        centerBore: 60.1,
        isStaggered: true,
      },
    ]
  },
  {
    make: "Lexus", model: "lc", years: [2022, 2023, 2024, 2025, 2026],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 21, width: 9, offset: 25 },
        rearWheel: { diameter: 21, width: 10.5, offset: 38 },
        frontTire: "245/40RF21",
        rearTire: "275/35RF21",
        boltPattern: "5x114.3",
        centerBore: 60.1,
        isStaggered: true,
      },
    ]
  },

  // LEXUS RC (2015+) - Standard coupe (non-F)
  // Most trims: 18" square or 19" square setup
  {
    make: "Lexus", model: "rc", years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 18, width: 8, offset: 45 },
        rearWheel: { diameter: 18, width: 8, offset: 45 },
        frontTire: "235/45R18",
        rearTire: "235/45R18",
        boltPattern: "5x114.3",
        centerBore: 60.1,
        isStaggered: false,
      },
    ]
  },

  // LEXUS UX (2019+) - Subcompact crossover
  {
    make: "Lexus", model: "ux", years: [2019, 2022, 2023],
    trims: [
      {
        name: "UX 200",
        frontWheel: { diameter: 18, width: 7, offset: 45 },
        rearWheel: { diameter: 18, width: 7, offset: 45 },
        frontTire: "225/50R18",
        rearTire: "225/50R18",
        boltPattern: "5x114.3",
        centerBore: 60.1,
        isStaggered: false,
      },
      {
        name: "UX 250h",
        frontWheel: { diameter: 18, width: 7, offset: 45 },
        rearWheel: { diameter: 18, width: 7, offset: 45 },
        frontTire: "225/50R18",
        rearTire: "225/50R18",
        boltPattern: "5x114.3",
        centerBore: 60.1,
        isStaggered: false,
      },
      {
        name: "UX 200, UX 250h",
        frontWheel: { diameter: 18, width: 7, offset: 45 },
        rearWheel: { diameter: 18, width: 7, offset: 45 },
        frontTire: "225/50R18",
        rearTire: "225/50R18",
        boltPattern: "5x114.3",
        centerBore: 60.1,
        isStaggered: false,
      },
    ]
  },
  {
    make: "Lexus", model: "ux", years: [2025, 2026],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 18, width: 7, offset: 45 },
        rearWheel: { diameter: 18, width: 7, offset: 45 },
        frontTire: "225/50R18",
        rearTire: "225/50R18",
        boltPattern: "5x114.3",
        centerBore: 60.1,
        isStaggered: false,
      },
    ]
  },
];

async function main() {
  console.log("Updating fitments for Volvo, Land Rover, and Lexus...\n");
  console.log("Source: OEM specifications (Google AI Overview research)\n");

  let updatedCount = 0;
  let notFoundCount = 0;
  const notFoundRecords: string[] = [];

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

        // Find existing record by year, make, model, display_trim
        // Use case-insensitive match for model (some are lowercase in DB)
        const existing = await db.execute(sql`
          SELECT id FROM vehicle_fitments 
          WHERE year = ${year} 
            AND LOWER(make) = ${vehicle.make.toLowerCase()} 
            AND LOWER(model) = ${vehicle.model.toLowerCase()}
            AND (
              LOWER(display_trim) = ${trim.name.toLowerCase()}
              OR display_trim = ${trim.name}
            )
          LIMIT 1
        `);

        const wheelSizesJson = JSON.stringify(oemWheelSizes);
        const tireSizesJson = JSON.stringify(oemTireSizes);

        if (existing.rows.length > 0) {
          // Update existing record
          const centerBoreValue = trim.centerBore || null;
          
          await db.execute(sql`
            UPDATE vehicle_fitments SET
              oem_wheel_sizes = ${wheelSizesJson}::jsonb,
              oem_tire_sizes = ${tireSizesJson}::jsonb,
              bolt_pattern = ${trim.boltPattern},
              center_bore_mm = ${centerBoreValue},
              quality_tier = 'complete',
              source = 'google-ai-overview',
              updated_at = NOW()
            WHERE id = ${(existing.rows[0] as any).id}
          `);
          console.log(`  ✓ Updated: ${year} ${vehicle.make} ${vehicle.model} ${trim.name}`);
          updatedCount++;
        } else {
          // Record not found - log it
          notFoundRecords.push(`${year} ${vehicle.make} ${vehicle.model} ${trim.name}`);
          notFoundCount++;
        }
      }
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Updated: ${updatedCount} records`);
  console.log(`Not found in DB: ${notFoundCount} records`);
  
  if (notFoundRecords.length > 0) {
    console.log(`\nRecords not found (data prepared but no matching DB record):`);
    notFoundRecords.forEach(r => console.log(`  - ${r}`));
  }
  
  console.log(`\nVehicles covered:`);
  console.log(`- VOLVO: S80 (2000-2016), S40 (2000-2011), S70 (2000), V50 (2004-2011)`);
  console.log(`         V90 (2018-2021), C40 (2021-2025), XC40 (2023-2026)`);
  console.log(`         XC60 (2026), XC90 (2026), EX30 (2025-2026), EX40 (2025-2026), EX90 (2025-2026)`);
  console.log(`- LAND ROVER: Discovery (2005-2011), Discovery Sport (2015-2024)`);
  console.log(`              Range Rover Sport (2006-2013), Range Rover Velar (2017-2024)`);
  console.log(`- LEXUS: RC F (2015-2025 STAGGERED), LC (2018-2026 STAGGERED)`);
  console.log(`         RC (2015-2025), UX (2019-2026)`);

  await pool.end();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
