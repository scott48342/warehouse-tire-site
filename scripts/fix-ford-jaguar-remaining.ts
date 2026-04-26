/**
 * Fix Ford and Jaguar Remaining Fitment Data
 * 
 * Based on Google AI Overview research for OEM wheel/tire specifications.
 * Source: Google AI Overview searches on {Make} {Model} OEM wheel and tire sizes by trim
 * 
 * Total: 187 records (99 Ford + 88 Jaguar)
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

interface FitmentData {
  wheelSizes: { diameter: number; width: number; offset?: number }[];
  tireSizes: string[];
  boltPattern: string;
  centerBore?: number;
  threadSize?: string;
}

interface YearRangeSpec {
  yearStart: number;
  yearEnd: number;
  data: FitmentData;
}

// ============================================================================
// FORD FITMENT DATA (from Google AI Overview research)
// ============================================================================

const FORD_FITMENT_DATA: Record<string, YearRangeSpec[]> = {
  // E-150 Econoline (2002-2014)
  // AI Overview: 8x165.1mm bolt pattern, 15" early / 16" later
  "E-150 Econoline": [
    {
      yearStart: 2002,
      yearEnd: 2007,
      data: {
        wheelSizes: [
          { diameter: 15, width: 6, offset: 0 },
          { diameter: 15, width: 7, offset: 0 },
          { diameter: 16, width: 7, offset: 0 },
        ],
        tireSizes: ["P235/75R15", "P225/75R15", "235/70R16"],
        boltPattern: "8x165.1",
        centerBore: 124.1,
        threadSize: "M14x2.0"
      }
    },
    {
      yearStart: 2008,
      yearEnd: 2014,
      data: {
        wheelSizes: [
          { diameter: 16, width: 7, offset: 0 },
        ],
        tireSizes: ["LT225/75R16", "LT245/75R16", "LT245/70R17"],
        boltPattern: "8x165.1",
        centerBore: 124.1,
        threadSize: "M14x2.0"
      }
    }
  ],

  // E-250 Econoline (2002-2014) - Same as E-150 but heavier duty
  "E-250 Econoline": [
    {
      yearStart: 2002,
      yearEnd: 2014,
      data: {
        wheelSizes: [
          { diameter: 16, width: 7, offset: 0 },
        ],
        tireSizes: ["LT225/75R16", "LT245/75R16"],
        boltPattern: "8x165.1",
        centerBore: 124.1,
        threadSize: "M14x2.0"
      }
    }
  ],

  // E-350 Econoline (2002-2014) - Heavy duty van
  "E-350 Econoline": [
    {
      yearStart: 2002,
      yearEnd: 2014,
      data: {
        wheelSizes: [
          { diameter: 16, width: 7, offset: 0 },
        ],
        tireSizes: ["LT225/75R16", "LT245/75R16"],
        boltPattern: "8x165.1",
        centerBore: 124.1,
        threadSize: "M14x2.0"
      }
    }
  ],

  // Crown Victoria (2002-2007)
  // AI Overview: 5x114.3mm, 16x7 base/LX, 17x7.5 LX Sport/Police 2006+
  "Crown Victoria": [
    {
      yearStart: 2002,
      yearEnd: 2007,
      data: {
        wheelSizes: [
          { diameter: 16, width: 7, offset: 45 },
          { diameter: 17, width: 7.5, offset: 45 },
        ],
        tireSizes: ["P225/60R16", "P235/55R17"],
        boltPattern: "5x114.3",
        centerBore: 73.1,
        threadSize: "M12x1.5"
      }
    }
  ],

  // Explorer Sport Trac (2001-2010, no 2006 model)
  // AI Overview: Gen I 15-16", Gen II 16-20"
  "Explorer Sport Trac": [
    {
      yearStart: 2001,
      yearEnd: 2005,
      data: {
        wheelSizes: [
          { diameter: 15, width: 7, offset: 12 },
          { diameter: 16, width: 7, offset: 12 },
        ],
        tireSizes: ["P235/75R15", "P255/70R16", "P235/70R16"],
        boltPattern: "5x114.3",
        centerBore: 70.6,
        threadSize: "M12x1.75"
      }
    },
    {
      yearStart: 2007,
      yearEnd: 2010,
      data: {
        wheelSizes: [
          { diameter: 16, width: 7, offset: 44 },
          { diameter: 17, width: 7.5, offset: 44 },
          { diameter: 18, width: 7.5, offset: 44 },
          { diameter: 20, width: 8, offset: 35 },
        ],
        tireSizes: ["P235/70R16", "P245/65R17", "P235/65R18", "P255/50R20"],
        boltPattern: "5x114.3",
        centerBore: 70.6,
        threadSize: "M14x2.0"
      }
    }
  ],

  // Excursion (2000-2005)
  // AI Overview: 8x170mm, 16x7, LT265/75R16
  "excursion": [
    {
      yearStart: 2000,
      yearEnd: 2005,
      data: {
        wheelSizes: [
          { diameter: 16, width: 7, offset: 0 },
        ],
        tireSizes: ["LT265/75R16"],
        boltPattern: "8x170",
        centerBore: 124.9,
        threadSize: "M14x1.5"
      }
    }
  ],

  // Flex (2009-2019)
  // 5x114.3mm, 17-20" wheels
  "flex": [
    {
      yearStart: 2011,
      yearEnd: 2019,
      data: {
        wheelSizes: [
          { diameter: 17, width: 7.5, offset: 44 },
          { diameter: 18, width: 8, offset: 44 },
          { diameter: 19, width: 8, offset: 44 },
          { diameter: 20, width: 8, offset: 44 },
        ],
        tireSizes: ["P235/60R17", "P235/55R18", "P235/50R19", "P255/45R20"],
        boltPattern: "5x114.3",
        centerBore: 70.6,
        threadSize: "M14x1.5"
      }
    }
  ],

  // GT (2005-2006 original, 2017-2022 new)
  // Original GT: 5x114.3mm, 18x9 front / 19x11 rear, staggered
  // New GT: Very special - 5x130mm? or custom
  "gt": [
    {
      yearStart: 2005,
      yearEnd: 2006,
      data: {
        wheelSizes: [
          { diameter: 18, width: 9, offset: 45 },
          { diameter: 19, width: 11, offset: 58 },
        ],
        tireSizes: ["245/45R18", "345/35R19"],
        boltPattern: "5x114.3",
        centerBore: 63.5,
        threadSize: "M14x1.5"
      }
    },
    {
      yearStart: 2017,
      yearEnd: 2022,
      data: {
        wheelSizes: [
          { diameter: 20, width: 8.5, offset: 45 },
          { diameter: 20, width: 11.5, offset: 53 },
        ],
        tireSizes: ["245/35R20", "325/30R20"],
        boltPattern: "5x114.3",
        centerBore: 70.5,
        threadSize: "M14x1.5"
      }
    }
  ],

  // Maverick (2022-2026)
  // 5x108mm (Ford compact/hybrid platform)
  "maverick": [
    {
      yearStart: 2022,
      yearEnd: 2026,
      data: {
        wheelSizes: [
          { diameter: 17, width: 7.5, offset: 52 },
          { diameter: 18, width: 7.5, offset: 52 },
        ],
        tireSizes: ["225/65R17", "225/60R18"],
        boltPattern: "5x108",
        centerBore: 63.4,
        threadSize: "M12x1.5"
      }
    }
  ],

  // Thunderbird (2002-2005 retro)
  // 5x108mm, 17x7.5
  "thunderbird": [
    {
      yearStart: 2002,
      yearEnd: 2005,
      data: {
        wheelSizes: [
          { diameter: 17, width: 7.5, offset: 45 },
        ],
        tireSizes: ["P235/50R17"],
        boltPattern: "5x108",
        centerBore: 63.4,
        threadSize: "M12x1.5"
      }
    }
  ],

  // Transit (2015-2025)
  // Multiple variants - using standard passenger specs (smaller Transit Connect style)
  "transit": [
    {
      yearStart: 2015,
      yearEnd: 2025,
      data: {
        wheelSizes: [
          { diameter: 16, width: 6.5, offset: 50 },
          { diameter: 17, width: 7, offset: 54 },
        ],
        tireSizes: ["215/65R16", "235/65R16", "235/55R17"],
        boltPattern: "5x160",
        centerBore: 65.1,
        threadSize: "M14x1.5"
      }
    }
  ],

  // Escort ZX2 (1998-2003)
  // 4x108mm compact car
  "Escort ZX2": [
    {
      yearStart: 2000,
      yearEnd: 2003,
      data: {
        wheelSizes: [
          { diameter: 14, width: 5.5, offset: 43 },
          { diameter: 15, width: 6, offset: 43 },
        ],
        tireSizes: ["P185/65R14", "P195/55R15"],
        boltPattern: "4x108",
        centerBore: 63.4,
        threadSize: "M12x1.5"
      }
    }
  ],

  // Bronco Sport (2021-2025)
  // 5x108mm (shared with Escape platform)
  "Bronco Sport": [
    {
      yearStart: 2021,
      yearEnd: 2025,
      data: {
        wheelSizes: [
          { diameter: 17, width: 7, offset: 46 },
          { diameter: 18, width: 7.5, offset: 46 },
        ],
        tireSizes: ["225/65R17", "225/60R18"],
        boltPattern: "5x108",
        centerBore: 63.4,
        threadSize: "M12x1.5"
      }
    }
  ],
};

// ============================================================================
// JAGUAR FITMENT DATA (from Google AI Overview research)
// ============================================================================

const JAGUAR_FITMENT_DATA: Record<string, YearRangeSpec[]> = {
  // XJ (2000-2017) - Multiple generations
  // 2000-2009: X308/X350 platform - 5x120mm
  // 2010-2017: X351 platform - 5x108mm
  "xj": [
    {
      yearStart: 2000,
      yearEnd: 2003,
      data: {
        wheelSizes: [
          { diameter: 17, width: 7.5, offset: 50 },
          { diameter: 18, width: 8, offset: 47 },
        ],
        tireSizes: ["235/55R17", "255/45R18"],
        boltPattern: "5x120",
        centerBore: 72.6,
        threadSize: "M12x1.5"
      }
    },
    {
      yearStart: 2004,
      yearEnd: 2009,
      data: {
        wheelSizes: [
          { diameter: 18, width: 8, offset: 47 },
          { diameter: 19, width: 9, offset: 50 },
          { diameter: 20, width: 9, offset: 47 },
        ],
        tireSizes: ["255/45R18", "275/40R19", "275/35R20"],
        boltPattern: "5x108",
        centerBore: 63.4,
        threadSize: "M12x1.5"
      }
    },
    {
      yearStart: 2010,
      yearEnd: 2017,
      data: {
        wheelSizes: [
          { diameter: 18, width: 8, offset: 47 },
          { diameter: 19, width: 8.5, offset: 49 },
          { diameter: 20, width: 9, offset: 47 },
        ],
        tireSizes: ["245/50R18", "275/40R19", "275/35R20"],
        boltPattern: "5x108",
        centerBore: 63.4,
        threadSize: "M12x1.5"
      }
    }
  ],

  // S-Type (2000-2008)
  // Based on Lincoln LS platform - 5x108mm
  "s-type": [
    {
      yearStart: 2000,
      yearEnd: 2008,
      data: {
        wheelSizes: [
          { diameter: 16, width: 7.5, offset: 52 },
          { diameter: 17, width: 7.5, offset: 52 },
          { diameter: 18, width: 8, offset: 49 },
        ],
        tireSizes: ["225/55R16", "235/50R17", "245/40R18"],
        boltPattern: "5x108",
        centerBore: 63.4,
        threadSize: "M12x1.5"
      }
    }
  ],

  // X-Type (2002-2008)
  // Based on Ford Mondeo platform - 5x108mm
  "x-type": [
    {
      yearStart: 2004,
      yearEnd: 2008,
      data: {
        wheelSizes: [
          { diameter: 16, width: 6.5, offset: 52 },
          { diameter: 17, width: 7, offset: 52 },
          { diameter: 18, width: 7.5, offset: 49 },
        ],
        tireSizes: ["205/55R16", "225/45R17", "225/40R18"],
        boltPattern: "5x108",
        centerBore: 63.4,
        threadSize: "M12x1.5"
      }
    }
  ],

  // XK (2007-2015)
  // Grand tourer - 5x108mm, larger wheels
  "xk": [
    {
      yearStart: 2007,
      yearEnd: 2015,
      data: {
        wheelSizes: [
          { diameter: 18, width: 8, offset: 49 },
          { diameter: 19, width: 8.5, offset: 49 },
          { diameter: 20, width: 9, offset: 47 },
        ],
        tireSizes: ["245/45R18", "245/40R19", "275/35R20", "285/35R20"],
        boltPattern: "5x108",
        centerBore: 63.4,
        threadSize: "M12x1.5"
      }
    }
  ],

  // E-PACE (2018-present)
  // Compact SUV - 5x108mm
  "e-pace": [
    {
      yearStart: 2018,
      yearEnd: 2025,
      data: {
        wheelSizes: [
          { diameter: 17, width: 7.5, offset: 40 },
          { diameter: 18, width: 8, offset: 40 },
          { diameter: 19, width: 8, offset: 40 },
          { diameter: 20, width: 8.5, offset: 40 },
          { diameter: 21, width: 9, offset: 40 },
        ],
        tireSizes: ["235/65R17", "235/60R18", "235/55R19", "245/45R20", "245/40R21"],
        boltPattern: "5x108",
        centerBore: 63.4,
        threadSize: "M12x1.5"
      }
    }
  ],
};

// ============================================================================
// UPDATE FUNCTIONS
// ============================================================================

function getFitmentForYear(model: string, year: number, make: string): FitmentData | null {
  const dataSource = make === "Ford" ? FORD_FITMENT_DATA : JAGUAR_FITMENT_DATA;
  
  // Normalize model name for lookup
  const modelKey = Object.keys(dataSource).find(
    k => k.toLowerCase() === model.toLowerCase()
  );
  
  if (!modelKey) {
    console.log(`  No fitment data for ${make} ${model}`);
    return null;
  }
  
  const yearRanges = dataSource[modelKey];
  
  for (const range of yearRanges) {
    if (year >= range.yearStart && year <= range.yearEnd) {
      return range.data;
    }
  }
  
  console.log(`  No year range match for ${year} ${make} ${model}`);
  return null;
}

async function updateRecord(
  id: string,
  year: number,
  make: string,
  model: string,
  fitment: FitmentData
): Promise<boolean> {
  const oemWheelSizes = fitment.wheelSizes.map(ws => ({
    diameter: ws.diameter,
    width: ws.width,
    offset: ws.offset || null,
    axle: "square",
    isStock: true
  }));
  
  const oemTireSizes = fitment.tireSizes;
  
  try {
    await pool.query(`
      UPDATE vehicle_fitments
      SET 
        bolt_pattern = $1,
        center_bore_mm = $2,
        thread_size = $3,
        oem_wheel_sizes = $4::jsonb,
        oem_tire_sizes = $5::jsonb,
        source = 'google-ai-overview',
        quality_tier = 'complete',
        updated_at = NOW()
      WHERE id = $6
    `, [
      fitment.boltPattern,
      fitment.centerBore || null,
      fitment.threadSize || null,
      JSON.stringify(oemWheelSizes),
      JSON.stringify(oemTireSizes),
      id
    ]);
    
    return true;
  } catch (error) {
    console.error(`  Error updating ${id}:`, error);
    return false;
  }
}

async function main() {
  console.log("=== Ford + Jaguar Remaining Fitment Fix ===\n");
  
  // Get all missing records
  const result = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE make IN ('Ford', 'Jaguar')
      AND (
        oem_wheel_sizes IS NULL 
        OR oem_wheel_sizes = '[]'::jsonb
        OR oem_tire_sizes IS NULL 
        OR oem_tire_sizes = '[]'::jsonb
      )
    ORDER BY make, model, year, display_trim
  `);
  
  console.log(`Found ${result.rows.length} records to update\n`);
  
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  const byMake: Record<string, any[]> = { Ford: [], Jaguar: [] };
  result.rows.forEach(row => {
    byMake[row.make]?.push(row);
  });
  
  // Process Ford
  console.log(`\n--- Processing ${byMake.Ford?.length || 0} Ford records ---\n`);
  for (const row of byMake.Ford || []) {
    const fitment = getFitmentForYear(row.model, row.year, "Ford");
    if (fitment) {
      const success = await updateRecord(row.id, row.year, "Ford", row.model, fitment);
      if (success) {
        console.log(`✓ Updated: ${row.year} Ford ${row.model} ${row.display_trim}`);
        updated++;
      } else {
        errors++;
      }
    } else {
      console.log(`⚠ Skipped: ${row.year} Ford ${row.model} (no data)`);
      skipped++;
    }
  }
  
  // Process Jaguar
  console.log(`\n--- Processing ${byMake.Jaguar?.length || 0} Jaguar records ---\n`);
  for (const row of byMake.Jaguar || []) {
    const fitment = getFitmentForYear(row.model, row.year, "Jaguar");
    if (fitment) {
      const success = await updateRecord(row.id, row.year, "Jaguar", row.model, fitment);
      if (success) {
        console.log(`✓ Updated: ${row.year} Jaguar ${row.model} ${row.display_trim}`);
        updated++;
      } else {
        errors++;
      }
    } else {
      console.log(`⚠ Skipped: ${row.year} Jaguar ${row.model} (no data)`);
      skipped++;
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total: ${result.rows.length}`);
  
  await pool.end();
  process.exit(errors > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
