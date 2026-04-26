/**
 * Fix Toyota Remaining Fitments
 * Updates all missing Toyota wheel/tire data and marks complete records
 * 
 * Data source: Google AI Overview (aggregated OEM sources)
 * Research date: 2026-04-26
 * 
 * Coverage:
 * - Toyota 86 (2012-2022)
 * - Toyota FJ Cruiser (2007-2014)
 * - Toyota GR Corolla (2023-2026)
 * - Toyota Grand Highlander (2024-2026)
 * - Toyota MR2 Spyder (2000-2005)
 * - Toyota Supra (2019-2026)
 * - Toyota Sienna (2000-2018)
 * - Toyota Highlander (2001-2009)
 * - Toyota RAV4 (2000-2009, 2026)
 * - Toyota Tacoma (2000-2008)
 * - Toyota Tundra (2000-2007)
 * - Toyota Sequoia (2008-2022)
 * - Toyota Prius variants (2001-2024)
 * - Toyota Avalon (2000-2007)
 * - Toyota Mirai (2016-2026)
 * - Toyota Solara (2000-2008)
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
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

// =========================================
// FITMENT DATA DEFINITIONS
// =========================================

interface FitmentSpec {
  make: string;
  model: string;
  years: number[];
  boltPattern: string;
  wheelSizes: Array<{ width: number; diameter: number; offset: number; position?: string }>;
  tireSizes: Array<{ size: string; position?: string }>;
  trims?: string[]; // If specified, only apply to these trims
}

const fitmentData: FitmentSpec[] = [
  // =========================================
  // TOYOTA 86 (2012-2022) - 5x100, M12x1.25
  // =========================================
  {
    make: "Toyota", model: "86",
    years: [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022],
    boltPattern: "5x100",
    wheelSizes: [
      { width: 7, diameter: 17, offset: 48 }
    ],
    tireSizes: [
      { size: "215/45R17" }
    ]
  },

  // =========================================
  // TOYOTA FJ CRUISER (2007-2014) - 6x139.7, M12x1.5
  // =========================================
  {
    make: "Toyota", model: "FJ Cruiser",
    years: [2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014],
    boltPattern: "6x139.7",
    wheelSizes: [
      { width: 7.5, diameter: 17, offset: 15 }
    ],
    tireSizes: [
      { size: "265/70R17" }
    ]
  },

  // =========================================
  // TOYOTA GR COROLLA (2023-2026) - 5x114.3, M12x1.5
  // =========================================
  {
    make: "Toyota", model: "GR Corolla",
    years: [2023, 2024, 2025, 2026],
    boltPattern: "5x114.3",
    wheelSizes: [
      { width: 8.5, diameter: 18, offset: 30 }
    ],
    tireSizes: [
      { size: "235/40R18" }
    ]
  },

  // =========================================
  // TOYOTA GRAND HIGHLANDER (2024-2026) - 5x114.3
  // =========================================
  {
    make: "Toyota", model: "Grand Highlander",
    years: [2024, 2025, 2026],
    boltPattern: "5x114.3",
    wheelSizes: [
      { width: 7.5, diameter: 20, offset: 35 }
    ],
    tireSizes: [
      { size: "245/50R20" }
    ]
  },

  // =========================================
  // TOYOTA MR2 SPYDER (2000-2005) - 5x100 - STAGGERED
  // =========================================
  {
    make: "Toyota", model: "MR2 Spyder",
    years: [2000, 2001, 2002, 2003, 2004, 2005],
    boltPattern: "5x100",
    wheelSizes: [
      { width: 6, diameter: 15, offset: 38, position: "front" },
      { width: 7, diameter: 15, offset: 38, position: "rear" }
    ],
    tireSizes: [
      { size: "185/55R15", position: "front" },
      { size: "205/50R15", position: "rear" }
    ]
  },

  // =========================================
  // TOYOTA SUPRA (2019-2026) - 5x112 - STAGGERED
  // =========================================
  {
    make: "Toyota", model: "Supra",
    years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    boltPattern: "5x112",
    wheelSizes: [
      { width: 9, diameter: 19, offset: 32, position: "front" },
      { width: 10, diameter: 19, offset: 40, position: "rear" }
    ],
    tireSizes: [
      { size: "255/35R19", position: "front" },
      { size: "275/35R19", position: "rear" }
    ]
  },

  // =========================================
  // TOYOTA SIENNA 1st Gen (2000-2003) - 5x114.3
  // =========================================
  {
    make: "Toyota", model: "Sienna",
    years: [2000, 2001, 2002, 2003],
    boltPattern: "5x114.3",
    wheelSizes: [
      { width: 6.5, diameter: 16, offset: 45 }
    ],
    tireSizes: [
      { size: "215/65R16" }
    ]
  },

  // =========================================
  // TOYOTA SIENNA 2nd Gen (2004-2010) - 5x114.3
  // =========================================
  {
    make: "Toyota", model: "Sienna",
    years: [2004, 2005, 2006, 2007, 2008, 2009, 2010],
    boltPattern: "5x114.3",
    wheelSizes: [
      { width: 7, diameter: 17, offset: 42 }
    ],
    tireSizes: [
      { size: "225/60R17" }
    ]
  },

  // =========================================
  // TOYOTA SIENNA 3rd Gen (2011-2020) - 5x114.3
  // =========================================
  {
    make: "Toyota", model: "Sienna",
    years: [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020],
    boltPattern: "5x114.3",
    wheelSizes: [
      { width: 7, diameter: 17, offset: 40 }
    ],
    tireSizes: [
      { size: "235/60R17" }
    ]
  },

  // =========================================
  // TOYOTA HIGHLANDER 1st Gen (2001-2007) - 5x114.3
  // =========================================
  {
    make: "Toyota", model: "Highlander",
    years: [2001, 2002, 2003, 2004, 2005, 2006, 2007],
    boltPattern: "5x114.3",
    wheelSizes: [
      { width: 6.5, diameter: 16, offset: 45 }
    ],
    tireSizes: [
      { size: "225/70R16" }
    ]
  },

  // =========================================
  // TOYOTA HIGHLANDER 2nd Gen (2008-2013) - 5x114.3
  // =========================================
  {
    make: "Toyota", model: "Highlander",
    years: [2008, 2009, 2010, 2011, 2012, 2013],
    boltPattern: "5x114.3",
    wheelSizes: [
      { width: 7.5, diameter: 17, offset: 35 }
    ],
    tireSizes: [
      { size: "245/65R17" }
    ]
  },

  // =========================================
  // TOYOTA RAV4 2nd Gen (2000-2005) - 5x114.3
  // =========================================
  {
    make: "Toyota", model: "RAV4",
    years: [2000, 2001, 2002, 2003, 2004, 2005],
    boltPattern: "5x114.3",
    wheelSizes: [
      { width: 6.5, diameter: 16, offset: 35 }
    ],
    tireSizes: [
      { size: "215/70R16" }
    ]
  },

  // =========================================
  // TOYOTA RAV4 3rd Gen (2006-2012) - 5x114.3
  // =========================================
  {
    make: "Toyota", model: "RAV4",
    years: [2006, 2007, 2008, 2009, 2010, 2011, 2012],
    boltPattern: "5x114.3",
    wheelSizes: [
      { width: 7, diameter: 17, offset: 45 }
    ],
    tireSizes: [
      { size: "235/65R17" }
    ]
  },

  // =========================================
  // TOYOTA RAV4 5th Gen (2019-2026) - 5x114.3
  // =========================================
  {
    make: "Toyota", model: "RAV4",
    years: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    boltPattern: "5x114.3",
    wheelSizes: [
      { width: 7, diameter: 17, offset: 40 }
    ],
    tireSizes: [
      { size: "235/65R17" }
    ]
  },

  // =========================================
  // TOYOTA TACOMA 1st Gen (1995-2004) - 6x139.7 (4WD) / 5x114.3 (2WD)
  // Using 6x139.7 as default (most common)
  // =========================================
  {
    make: "Toyota", model: "Tacoma",
    years: [1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004],
    boltPattern: "6x139.7",
    wheelSizes: [
      { width: 7, diameter: 16, offset: 30 }
    ],
    tireSizes: [
      { size: "265/70R16" }
    ]
  },

  // =========================================
  // TOYOTA TACOMA 2nd Gen (2005-2015) - 6x139.7
  // =========================================
  {
    make: "Toyota", model: "Tacoma",
    years: [2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015],
    boltPattern: "6x139.7",
    wheelSizes: [
      { width: 7, diameter: 16, offset: 30 }
    ],
    tireSizes: [
      { size: "265/70R16" }
    ]
  },

  // =========================================
  // TOYOTA TUNDRA 1st Gen (2000-2006) - 6x139.7
  // =========================================
  {
    make: "Toyota", model: "Tundra",
    years: [2000, 2001, 2002, 2003, 2004, 2005, 2006],
    boltPattern: "6x139.7",
    wheelSizes: [
      { width: 7, diameter: 16, offset: 30 }
    ],
    tireSizes: [
      { size: "265/70R16" }
    ]
  },

  // =========================================
  // TOYOTA TUNDRA 2nd Gen (2007-2021) - 5x150
  // =========================================
  {
    make: "Toyota", model: "Tundra",
    years: [2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021],
    boltPattern: "5x150",
    wheelSizes: [
      { width: 8, diameter: 18, offset: 50 }
    ],
    tireSizes: [
      { size: "275/65R18" }
    ]
  },

  // =========================================
  // TOYOTA SEQUOIA 2nd Gen (2008-2022) - 5x150
  // =========================================
  {
    make: "Toyota", model: "Sequoia",
    years: [2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022],
    boltPattern: "5x150",
    wheelSizes: [
      { width: 8, diameter: 18, offset: 50 }
    ],
    tireSizes: [
      { size: "275/65R18" }
    ]
  },

  // =========================================
  // TOYOTA PRIUS 1st Gen (1997-2003) - 4x100
  // =========================================
  {
    make: "Toyota", model: "Prius",
    years: [1997, 1998, 1999, 2000, 2001, 2002, 2003],
    boltPattern: "4x100",
    wheelSizes: [
      { width: 5.5, diameter: 14, offset: 45 }
    ],
    tireSizes: [
      { size: "175/65R14" }
    ]
  },

  // =========================================
  // TOYOTA PRIUS 2nd Gen (2004-2009) - 5x100
  // =========================================
  {
    make: "Toyota", model: "Prius",
    years: [2004, 2005, 2006, 2007, 2008, 2009],
    boltPattern: "5x100",
    wheelSizes: [
      { width: 6, diameter: 15, offset: 45 }
    ],
    tireSizes: [
      { size: "185/65R15" }
    ]
  },

  // =========================================
  // TOYOTA PRIUS PLUG-IN (2012-2015) - 5x100
  // =========================================
  {
    make: "Toyota", model: "Prius Plug-in",
    years: [2012, 2013, 2014, 2015],
    boltPattern: "5x100",
    wheelSizes: [
      { width: 6, diameter: 15, offset: 45 }
    ],
    tireSizes: [
      { size: "195/65R15" }
    ]
  },

  // =========================================
  // TOYOTA PRIUS PRIME (2017-2024) - 5x100
  // =========================================
  {
    make: "Toyota", model: "Prius Prime",
    years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
    boltPattern: "5x100",
    wheelSizes: [
      { width: 6.5, diameter: 15, offset: 40 }
    ],
    tireSizes: [
      { size: "195/65R15" }
    ]
  },

  // =========================================
  // TOYOTA PRIUS V (2012-2017) - 5x114.3
  // =========================================
  {
    make: "Toyota", model: "Prius V",
    years: [2012, 2013, 2014, 2015, 2016, 2017],
    boltPattern: "5x114.3",
    wheelSizes: [
      { width: 6.5, diameter: 16, offset: 45 }
    ],
    tireSizes: [
      { size: "205/60R16" }
    ]
  },

  // =========================================
  // TOYOTA AVALON 2nd Gen (2000-2004) - 5x114.3
  // =========================================
  {
    make: "Toyota", model: "Avalon",
    years: [2000, 2001, 2002, 2003, 2004],
    boltPattern: "5x114.3",
    wheelSizes: [
      { width: 6.5, diameter: 16, offset: 45 }
    ],
    tireSizes: [
      { size: "215/60R16" }
    ]
  },

  // =========================================
  // TOYOTA AVALON 3rd Gen (2005-2012) - 5x114.3
  // =========================================
  {
    make: "Toyota", model: "Avalon",
    years: [2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012],
    boltPattern: "5x114.3",
    wheelSizes: [
      { width: 7, diameter: 17, offset: 50 }
    ],
    tireSizes: [
      { size: "215/55R17" }
    ]
  },

  // =========================================
  // TOYOTA MIRAI (2016-2026) - 5x114.3
  // =========================================
  {
    make: "Toyota", model: "Mirai",
    years: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
    boltPattern: "5x114.3",
    wheelSizes: [
      { width: 7.5, diameter: 17, offset: 40 }
    ],
    tireSizes: [
      { size: "235/55R17" }
    ]
  },

  // =========================================
  // TOYOTA SOLARA (2000-2008) - 5x114.3
  // =========================================
  {
    make: "Toyota", model: "Solara",
    years: [2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008],
    boltPattern: "5x114.3",
    wheelSizes: [
      { width: 6.5, diameter: 16, offset: 45 }
    ],
    tireSizes: [
      { size: "215/60R16" }
    ]
  },
];

// =========================================
// MAIN UPDATE FUNCTION
// =========================================

async function main() {
  console.log("=== TOYOTA REMAINING FITMENT FIX ===\n");
  
  let updatedCount = 0;
  let skippedCount = 0;
  let notFoundCount = 0;
  let markedCompleteCount = 0;

  for (const spec of fitmentData) {
    for (const year of spec.years) {
      // Build wheel sizes JSON
      const oemWheelSizes = spec.wheelSizes.map(w => ({
        width: w.width,
        diameter: w.diameter,
        offset: w.offset,
        position: w.position || "both"
      }));

      // Build tire sizes JSON
      const oemTireSizes = spec.tireSizes.map(t => ({
        size: t.size,
        position: t.position || "both"
      }));

      const wheelSizesJson = JSON.stringify(oemWheelSizes);
      const tireSizesJson = JSON.stringify(oemTireSizes);

      // Find all matching records (any trim)
      const existing = await db.execute(sql`
        SELECT id, display_trim, oem_wheel_sizes, oem_tire_sizes, quality_tier
        FROM vehicle_fitments 
        WHERE year = ${year} 
          AND LOWER(make) = ${spec.make.toLowerCase()}
          AND (LOWER(model) = ${spec.model.toLowerCase()} 
               OR LOWER(model) = ${spec.model.toLowerCase().replace(/\s+/g, '-')}
               OR LOWER(model) = ${spec.model.toLowerCase().replace(/\s+/g, '')})
      `);

      if (existing.rows.length === 0) {
        notFoundCount++;
        continue;
      }

      for (const row of existing.rows as any[]) {
        // Check if already complete with data
        const hasWheels = row.oem_wheel_sizes && 
          (Array.isArray(row.oem_wheel_sizes) ? row.oem_wheel_sizes.length > 0 : true);
        const hasTires = row.oem_tire_sizes && 
          (Array.isArray(row.oem_tire_sizes) ? row.oem_tire_sizes.length > 0 : true);
        
        if (hasWheels && hasTires && row.quality_tier === 'complete') {
          skippedCount++;
          continue;
        }

        // Update the record
        if (hasWheels && hasTires) {
          // Just mark as complete
          await db.execute(sql`
            UPDATE vehicle_fitments SET
              quality_tier = 'complete',
              source = COALESCE(source, 'google-ai-overview'),
              updated_at = NOW()
            WHERE id = ${row.id}
          `);
          markedCompleteCount++;
        } else {
          // Fill in missing data
          await db.execute(sql`
            UPDATE vehicle_fitments SET
              oem_wheel_sizes = ${wheelSizesJson}::jsonb,
              oem_tire_sizes = ${tireSizesJson}::jsonb,
              quality_tier = 'complete',
              source = 'google-ai-overview',
              updated_at = NOW()
            WHERE id = ${row.id}
          `);
          updatedCount++;
        }
        
        console.log(`  Updated: ${year} ${spec.make} ${spec.model} ${row.display_trim || 'Base'}`);
      }
    }
  }

  // Also mark any records with existing data as complete
  console.log("\n--- Marking remaining records with data as complete ---");
  
  const toMarkComplete = await db.execute(sql`
    UPDATE vehicle_fitments SET
      quality_tier = 'complete',
      updated_at = NOW()
    WHERE LOWER(make) = 'toyota'
      AND oem_wheel_sizes IS NOT NULL
      AND oem_tire_sizes IS NOT NULL
      AND jsonb_array_length(COALESCE(oem_wheel_sizes, '[]'::jsonb)) > 0
      AND jsonb_array_length(COALESCE(oem_tire_sizes, '[]'::jsonb)) > 0
      AND (quality_tier IS NULL OR quality_tier != 'complete')
    RETURNING id
  `);
  
  const additionalMarked = toMarkComplete.rows.length;

  console.log(`\n=== SUMMARY ===`);
  console.log(`Records updated with new data: ${updatedCount}`);
  console.log(`Records marked complete (had data): ${markedCompleteCount}`);
  console.log(`Additional records marked complete: ${additionalMarked}`);
  console.log(`Records skipped (already complete): ${skippedCount}`);
  console.log(`Year-model combos not in DB: ${notFoundCount}`);
  console.log(`Total processed: ${updatedCount + markedCompleteCount + additionalMarked + skippedCount}`);

  await pool.end();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
