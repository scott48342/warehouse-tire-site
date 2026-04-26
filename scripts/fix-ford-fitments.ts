/**
 * Fix Ford Vehicle Fitments
 * Updates missing tire sizes and wheel specs for Ford vehicles
 * 
 * Vehicles covered:
 * - Ford Mustang (2000-2007) - Base/V6, GT, Cobra, Mach 1, Shelby GT500
 * - Ford Mustang Mach 1 (2003-2004)
 * - Ford Mustang Shelby GT500 (2007, 2023)
 * - Ford F-450 Super Duty (2000-2026) - SRW and DRW configurations
 * - Ford Fiesta (2011-2019) - S, SE, Titanium, ST trims
 * - Ford Taurus (2000-2017) - All trims
 * 
 * Source: google-ai-overview (manufacturer specifications)
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

interface TrimSpec {
  name: string;
  frontWheel: { diameter: number; width: number; offset: number | null };
  rearWheel: { diameter: number; width: number; offset: number | null };
  frontTire: string;
  rearTire: string;
  boltPattern: string;
  isStaggered: boolean;
}

interface VehicleSpec {
  make: string;
  model: string;
  years: number[];
  trims: TrimSpec[];
}

// Ford OEM Fitment Data
const fitmentData: VehicleSpec[] = [
  // =============================================================================
  // FORD MUSTANG - 4TH GENERATION (SN-95, 1999-2004)
  // =============================================================================
  
  // Mustang Base/V6 (2000-2004)
  {
    make: "Ford", model: "Mustang", years: [2000, 2001, 2002, 2003, 2004],
    trims: [
      {
        name: "Base/V6",
        frontWheel: { diameter: 16, width: 7.5, offset: 43 },
        rearWheel: { diameter: 16, width: 7.5, offset: 43 },
        frontTire: "225/55R16",
        rearTire: "225/55R16",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
  
  // Mustang GT (2000-2004)
  {
    make: "Ford", model: "Mustang", years: [2000, 2001, 2002, 2003, 2004],
    trims: [
      {
        name: "GT",
        frontWheel: { diameter: 17, width: 8, offset: 30 },
        rearWheel: { diameter: 17, width: 8, offset: 30 },
        frontTire: "245/45ZR17",
        rearTire: "245/45ZR17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
  
  // Mustang SVT Cobra (2001)
  {
    make: "Ford", model: "Mustang", years: [2001],
    trims: [
      {
        name: "Cobra",
        frontWheel: { diameter: 17, width: 8, offset: 30 },
        rearWheel: { diameter: 17, width: 9, offset: 32 },
        frontTire: "245/45ZR17",
        rearTire: "275/40ZR17",
        boltPattern: "5x114.3",
        isStaggered: true,
      },
    ]
  },
  
  // Mustang SVT Cobra "Terminator" (2003-2004) - Supercharged
  {
    make: "Ford", model: "Mustang", years: [2003, 2004],
    trims: [
      {
        name: "Cobra",
        frontWheel: { diameter: 17, width: 9, offset: 24 },
        rearWheel: { diameter: 17, width: 10.5, offset: 27 },
        frontTire: "275/40ZR17",
        rearTire: "285/40ZR17",
        boltPattern: "5x114.3",
        isStaggered: true,
      },
    ]
  },
  
  // Mustang Mach 1 (2003-2004)
  {
    make: "Ford", model: "Mustang Mach 1", years: [2003, 2004],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 17, width: 8, offset: 30 },
        rearWheel: { diameter: 17, width: 9, offset: 25 },
        frontTire: "245/45ZR17",
        rearTire: "275/40ZR17",
        boltPattern: "5x114.3",
        isStaggered: true,
      },
    ]
  },
  
  // =============================================================================
  // FORD MUSTANG - 5TH GENERATION (S197, 2005-2014)
  // =============================================================================
  
  // Mustang Base/V6 (2005-2007)
  {
    make: "Ford", model: "Mustang", years: [2005, 2006, 2007],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 16, width: 7, offset: 43 },
        rearWheel: { diameter: 16, width: 7, offset: 43 },
        frontTire: "215/65R16",
        rearTire: "215/65R16",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
      {
        name: "V6",
        frontWheel: { diameter: 16, width: 7, offset: 43 },
        rearWheel: { diameter: 16, width: 7, offset: 43 },
        frontTire: "215/65R16",
        rearTire: "215/65R16",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
  
  // Mustang GT (2005-2007)
  {
    make: "Ford", model: "Mustang", years: [2005, 2006, 2007],
    trims: [
      {
        name: "GT",
        frontWheel: { diameter: 18, width: 8, offset: 44 },
        rearWheel: { diameter: 18, width: 8, offset: 44 },
        frontTire: "235/50ZR18",
        rearTire: "235/50ZR18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
  
  // Mustang Shelby GT500 (2007)
  {
    make: "Ford", model: "Mustang", years: [2007],
    trims: [
      {
        name: "Shelby GT500",
        frontWheel: { diameter: 18, width: 9.5, offset: 30 },
        rearWheel: { diameter: 18, width: 9.5, offset: 30 },
        frontTire: "255/45ZR18",
        rearTire: "285/40ZR18",
        boltPattern: "5x114.3",
        isStaggered: false, // Same wheels, staggered tires only
      },
    ]
  },
  
  // Mustang Shelby GT500 (2007) - as separate model record
  {
    make: "Ford", model: "Mustang Shelby GT500", years: [2007],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 18, width: 9.5, offset: 30 },
        rearWheel: { diameter: 18, width: 9.5, offset: 30 },
        frontTire: "255/45ZR18",
        rearTire: "285/40ZR18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
  
  // Mustang Shelby GT500 (2023 - S650)
  {
    make: "Ford", model: "Mustang Shelby GT500", years: [2023],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 20, width: 11, offset: 32 },
        rearWheel: { diameter: 20, width: 11, offset: 50 },
        frontTire: "305/30ZR20",
        rearTire: "315/30ZR20",
        boltPattern: "5x114.3",
        isStaggered: false, // Same diameter
      },
    ]
  },
  
  // =============================================================================
  // FORD F-450 SUPER DUTY (2000-2026)
  // =============================================================================
  
  // F-450 (2000-2007) - SRW/DRW base
  {
    make: "Ford", model: "F-450 Super Duty", years: [2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 17, width: 6.5, offset: 136 },
        rearWheel: { diameter: 17, width: 6.5, offset: 136 },
        frontTire: "LT235/80R17",
        rearTire: "LT235/80R17",
        boltPattern: "8x170",
        isStaggered: false,
      },
    ]
  },
  
  // F-450 (2008-2016) - SRW standard
  {
    make: "Ford", model: "F-450 Super Duty", years: [2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 17, width: 6.5, offset: 130 },
        rearWheel: { diameter: 17, width: 6.5, offset: 130 },
        frontTire: "LT245/75R17",
        rearTire: "LT245/75R17",
        boltPattern: "8x170",
        isStaggered: false,
      },
    ]
  },
  
  // F-450 (2017-2026) - Current Generation
  {
    make: "Ford", model: "F-450 Super Duty", years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 17, width: 7.5, offset: 115 },
        rearWheel: { diameter: 17, width: 7.5, offset: 115 },
        frontTire: "LT245/75R17",
        rearTire: "LT245/75R17",
        boltPattern: "8x170",
        isStaggered: false,
      },
    ]
  },
  
  // =============================================================================
  // FORD FIESTA (2011-2019)
  // =============================================================================
  
  // Fiesta S/SE (2011-2019) - Base wheels
  {
    make: "Ford", model: "Fiesta", years: [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019],
    trims: [
      {
        name: "S",
        frontWheel: { diameter: 15, width: 6, offset: 50 },
        rearWheel: { diameter: 15, width: 6, offset: 50 },
        frontTire: "185/60R15",
        rearTire: "185/60R15",
        boltPattern: "4x108",
        isStaggered: false,
      },
      {
        name: "SE",
        frontWheel: { diameter: 15, width: 6, offset: 50 },
        rearWheel: { diameter: 15, width: 6, offset: 50 },
        frontTire: "185/60R15",
        rearTire: "185/60R15",
        boltPattern: "4x108",
        isStaggered: false,
      },
      {
        name: "S, SE",
        frontWheel: { diameter: 15, width: 6, offset: 50 },
        rearWheel: { diameter: 15, width: 6, offset: 50 },
        frontTire: "185/60R15",
        rearTire: "185/60R15",
        boltPattern: "4x108",
        isStaggered: false,
      },
    ]
  },
  
  // Fiesta Titanium (2011-2019)
  {
    make: "Ford", model: "Fiesta", years: [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019],
    trims: [
      {
        name: "Titanium",
        frontWheel: { diameter: 16, width: 6.5, offset: 50 },
        rearWheel: { diameter: 16, width: 6.5, offset: 50 },
        frontTire: "195/50R16",
        rearTire: "195/50R16",
        boltPattern: "4x108",
        isStaggered: false,
      },
      {
        name: "Titanium, ST",
        frontWheel: { diameter: 17, width: 7, offset: 48 },
        rearWheel: { diameter: 17, width: 7, offset: 48 },
        frontTire: "205/40R17",
        rearTire: "205/40R17",
        boltPattern: "4x108",
        isStaggered: false,
      },
    ]
  },
  
  // Fiesta ST (2014-2019)
  {
    make: "Ford", model: "Fiesta", years: [2014, 2015, 2016, 2017, 2018, 2019],
    trims: [
      {
        name: "ST",
        frontWheel: { diameter: 17, width: 7, offset: 48 },
        rearWheel: { diameter: 17, width: 7, offset: 48 },
        frontTire: "205/40R17",
        rearTire: "205/40R17",
        boltPattern: "4x108",
        isStaggered: false,
      },
    ]
  },
  
  // =============================================================================
  // FORD TAURUS (2000-2017)
  // =============================================================================
  
  // Taurus (2000-2007) - 4th Generation
  {
    make: "Ford", model: "Taurus", years: [2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 16, width: 6.5, offset: 44 },
        rearWheel: { diameter: 16, width: 6.5, offset: 44 },
        frontTire: "215/60R16",
        rearTire: "215/60R16",
        boltPattern: "5x108",
        isStaggered: false,
      },
    ]
  },
  
  // Taurus (2008-2009) - 5th Generation (rebadged Five Hundred)
  {
    make: "Ford", model: "Taurus", years: [2008, 2009],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 17, width: 7, offset: 45 },
        rearWheel: { diameter: 17, width: 7, offset: 45 },
        frontTire: "215/60R17",
        rearTire: "215/60R17",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
  
  // Taurus (2010-2017) - 6th Generation
  {
    make: "Ford", model: "Taurus", years: [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017],
    trims: [
      {
        name: "Base",
        frontWheel: { diameter: 18, width: 8, offset: 45 },
        rearWheel: { diameter: 18, width: 8, offset: 45 },
        frontTire: "235/55R18",
        rearTire: "235/55R18",
        boltPattern: "5x114.3",
        isStaggered: false,
      },
    ]
  },
];

// Lowercase model variants to check
const modelVariants: Record<string, string[]> = {
  "mustang": ["mustang"],
  "mustang mach 1": ["mustang mach 1", "mustang-mach-1"],
  "mustang shelby gt500": ["mustang shelby gt500", "mustang-shelby-gt500", "shelby gt500"],
  "f-450 super duty": ["f-450 super duty", "f-450-super-duty", "f450 super duty"],
  "fiesta": ["fiesta"],
  "taurus": ["taurus"],
};

async function main() {
  console.log("=".repeat(80));
  console.log("Ford Vehicle Fitment Update Script");
  console.log("Source: google-ai-overview (manufacturer specifications)");
  console.log("=".repeat(80));
  console.log("");

  let updatedCount = 0;
  let insertedCount = 0;
  let skippedCount = 0;

  for (const vehicle of fitmentData) {
    for (const year of vehicle.years) {
      for (const trim of vehicle.trims) {
        // Build wheel sizes JSON
        const oemWheelSizes = [];
        
        oemWheelSizes.push({
          position: "front",
          diameter: trim.frontWheel.diameter,
          width: trim.frontWheel.width,
          offset: trim.frontWheel.offset,
          boltPattern: trim.boltPattern,
        });
        
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

        // Generate modification_id variants
        const modificationId = `${year}-${vehicle.make}-${vehicle.model}-${trim.name}`.toLowerCase().replace(/\s+/g, '-');
        
        // Get model variants to match
        const modelKey = vehicle.model.toLowerCase();
        const variants = modelVariants[modelKey] || [modelKey];
        
        // Build SQL for matching models
        const modelConditions = variants.map(v => 
          `LOWER(model) = '${v.replace(/'/g, "''")}'`
        ).join(' OR ');
        
        // Build SQL for matching trims
        const trimName = trim.name.toLowerCase();
        const trimConditions = [
          `LOWER(display_trim) = '${trimName.replace(/'/g, "''")}'`,
          `LOWER(modification_id) LIKE '%${trimName.replace(/'/g, "''").replace(/\s+/g, '-')}%'`,
          `modification_id IS NULL`,
        ].join(' OR ');

        // Check if record exists with missing tire sizes
        const checkQuery = `
          SELECT id, year, make, model, display_trim, modification_id, oem_tire_sizes
          FROM vehicle_fitments 
          WHERE year = ${year} 
            AND LOWER(make) = '${vehicle.make.toLowerCase()}'
            AND (${modelConditions})
            AND (${trimConditions})
            AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]' OR oem_tire_sizes::text = 'null')
          LIMIT 1
        `;

        const existing = await db.execute(sql.raw(checkQuery));

        const wheelSizesJson = JSON.stringify(oemWheelSizes);
        const tireSizesJson = JSON.stringify(oemTireSizes);

        if (existing.rows.length > 0) {
          const row = existing.rows[0] as any;
          // Update existing record
          await db.execute(sql`
            UPDATE vehicle_fitments SET
              oem_wheel_sizes = ${wheelSizesJson}::jsonb,
              oem_tire_sizes = ${tireSizesJson}::jsonb,
              quality_tier = 'complete',
              source = 'google-ai-overview',
              updated_at = NOW()
            WHERE id = ${row.id}
          `);
          console.log(`✓ Updated: ${year} ${vehicle.make} ${vehicle.model} ${trim.name}`);
          console.log(`  Wheels: ${trim.frontWheel.diameter}x${trim.frontWheel.width} ${trim.boltPattern}`);
          console.log(`  Tires: ${trim.frontTire} / ${trim.rearTire}`);
          updatedCount++;
        } else {
          // Check if any matching record exists (even with data)
          const existsQuery = `
            SELECT id FROM vehicle_fitments 
            WHERE year = ${year} 
              AND LOWER(make) = '${vehicle.make.toLowerCase()}'
              AND (${modelConditions})
              AND (${trimConditions})
            LIMIT 1
          `;
          const existsCheck = await db.execute(sql.raw(existsQuery));
          
          if (existsCheck.rows.length > 0) {
            // Record exists but already has data
            skippedCount++;
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
            console.log(`+ Inserted: ${year} ${vehicle.make} ${vehicle.model} ${trim.name}`);
            console.log(`  Wheels: ${trim.frontWheel.diameter}x${trim.frontWheel.width} ${trim.boltPattern}`);
            console.log(`  Tires: ${trim.frontTire} / ${trim.rearTire}`);
            insertedCount++;
          }
        }
      }
    }
  }

  console.log("");
  console.log("=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`Updated:  ${updatedCount} records`);
  console.log(`Inserted: ${insertedCount} records`);
  console.log(`Skipped:  ${skippedCount} records (already had data)`);
  console.log(`Total:    ${updatedCount + insertedCount} records modified`);

  await pool.end();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
