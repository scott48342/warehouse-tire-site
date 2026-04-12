/**
 * Fix ALL Cross-Generation Contamination
 * 
 * Updates records that inherited wrong-era tire sizes with correct modern sizes
 */

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import pg from "pg";
const { Pool } = pg;

// Correct tire sizes by vehicle and generation
const CORRECT_SIZES: Record<string, Record<string, string[]>> = {
  // Corvette C6 (2005-2013) - front 18", rear 19"
  "chevrolet/corvette": {
    "2005-2013": ["P245/40ZR18", "P285/35ZR19", "P325/30ZR19"],
  },
  
  // Corvette C7 (2014-2019) - front 19", rear 20"
  "chevrolet/corvette/c7": {
    "2014-2019": ["P245/35ZR19", "P285/30ZR20", "P335/25ZR20"],
  },
  
  // Mercedes S-Class W221 (2006-2013) - 17"/18"/19"/20"
  "mercedes/s-class": {
    "2006-2013": ["245/50R17", "255/45R18", "255/40R19", "275/35R20"],
  },
  
  // Mercedes S-Class W222 (2014-2020) - 18"/19"/20"
  "mercedes/s-class/w222": {
    "2014-2020": ["245/50R18", "255/45R19", "255/40R20", "275/35R20"],
  },
  
  // Silverado/Sierra K2XX (2014-2018) - 17"/18"/20"/22"
  "chevrolet/silverado-1500": {
    "2014-2018": ["265/70R17", "275/65R18", "275/55R20", "285/45R22"],
  },
  "gmc/sierra-1500": {
    "2014-2018": ["265/70R17", "275/65R18", "275/55R20", "285/45R22"],
  },
  
  // F-150 13th gen (2015-2020) - 17"/18"/20"/22"
  "ford/f-150": {
    "2014-2020": ["265/70R17", "275/65R18", "275/55R20", "275/45R22"],
  },
};

function getCorrectSizes(make: string, model: string, year: number): string[] | null {
  const key = `${make}/${model}`;
  
  // Check for Corvette generations
  if (model === "corvette") {
    if (year >= 2014) {
      return CORRECT_SIZES["chevrolet/corvette/c7"]?.["2014-2019"] || null;
    } else if (year >= 2005) {
      return CORRECT_SIZES["chevrolet/corvette"]?.["2005-2013"] || null;
    }
  }
  
  // Check for S-Class generations
  if (model === "s-class") {
    if (year >= 2014) {
      return CORRECT_SIZES["mercedes/s-class/w222"]?.["2014-2020"] || null;
    } else if (year >= 2006) {
      return CORRECT_SIZES["mercedes/s-class"]?.["2006-2013"] || null;
    }
  }
  
  // Check other vehicles
  const vehicleSizes = CORRECT_SIZES[key];
  if (vehicleSizes) {
    for (const [range, sizes] of Object.entries(vehicleSizes)) {
      const [start, end] = range.split('-').map(Number);
      if (year >= start && year <= end) {
        return sizes;
      }
    }
  }
  
  return null;
}

function extractRimDiameter(tireSize: string): number | null {
  if (!tireSize) return null;
  const match = String(tireSize).toUpperCase().match(/R(\d{2}(?:\.\d)?)/);
  if (match) return Math.floor(parseFloat(match[1]));
  return null;
}

function getMinDiameter(tireSizes: string[]): number {
  const diameters = tireSizes.map(extractRimDiameter).filter((d): d is number => d !== null);
  return diameters.length > 0 ? Math.min(...diameters) : 0;
}

function getExpectedMinDiameter(year: number, model: string): number {
  const modelLower = model.toLowerCase();
  
  if (modelLower.includes('corvette')) {
    if (year >= 2014) return 18;
    if (year >= 2005) return 17;
    return 15;
  }
  
  if (modelLower.includes('silverado') || modelLower.includes('sierra') || 
      modelLower.includes('f-150') || modelLower.includes('1500')) {
    if (year >= 2014) return 17;
    return 15;
  }
  
  if (modelLower.includes('s-class')) {
    if (year >= 2014) return 17;
    if (year >= 2006) return 16;
    return 15;
  }
  
  return 15;
}

async function fix() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: false });
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("         FIXING ALL CROSS-GENERATION CONTAMINATION              ");
  console.log("═══════════════════════════════════════════════════════════════\n");

  let fixed = 0;
  let skipped = 0;
  let noFix = 0;

  try {
    // Find all contaminated records
    const { rows } = await pool.query(`
      SELECT id, year, make, model, display_trim, oem_tire_sizes, source
      FROM vehicle_fitments
      WHERE source LIKE '%inherit%'
        AND year >= 2005
      ORDER BY make, model, year
    `);

    console.log(`Checking ${rows.length} inherit records...\n`);

    for (const row of rows) {
      const tireSizes = (row.oem_tire_sizes || []) as string[];
      const minDia = getMinDiameter(tireSizes);
      const expectedMin = getExpectedMinDiameter(row.year, row.model);
      
      // Check if contaminated
      if (minDia < expectedMin) {
        const correctSizes = getCorrectSizes(row.make, row.model, row.year);
        
        if (correctSizes) {
          await pool.query(`
            UPDATE vehicle_fitments 
            SET oem_tire_sizes = $1::jsonb,
                source = 'fix_cross_gen',
                updated_at = NOW()
            WHERE id = $2
          `, [JSON.stringify(correctSizes), row.id]);
          
          console.log(`✅ ${row.year} ${row.make} ${row.model} "${row.display_trim}"`);
          console.log(`   ${minDia}" → ${getMinDiameter(correctSizes)}"+`);
          fixed++;
        } else {
          console.log(`⚠️ ${row.year} ${row.make} ${row.model} "${row.display_trim}" - no fix defined`);
          noFix++;
        }
      } else {
        skipped++;
      }
    }

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("                         SUMMARY                                ");
    console.log("═══════════════════════════════════════════════════════════════\n");
    console.log(`Total checked: ${rows.length}`);
    console.log(`Fixed: ${fixed}`);
    console.log(`Skipped (not contaminated): ${skipped}`);
    console.log(`No fix defined: ${noFix}`);

  } finally {
    await pool.end();
  }
}

fix().catch(console.error);
