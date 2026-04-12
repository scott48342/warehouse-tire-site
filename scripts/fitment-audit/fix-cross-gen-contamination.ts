/**
 * Fix Cross-Generation Contamination
 * 
 * Fixes records where inheritance copied wrong-era tire sizes
 */

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import pg from "pg";
const { Pool } = pg;

// Correct tire sizes for known contaminated vehicles
const FIXES: Array<{
  year: number;
  make: string;
  model: string;
  correctSizes: string[];
}> = [
  // C7 Corvette (2014-2019) - was showing 15" from C3/C4 era
  { year: 2014, make: "chevrolet", model: "corvette", correctSizes: ["P245/35ZR19", "P285/30ZR20", "P335/25ZR20"] },
  { year: 2015, make: "chevrolet", model: "corvette", correctSizes: ["P245/35ZR19", "P285/30ZR20", "P335/25ZR20"] },
  { year: 2016, make: "chevrolet", model: "corvette", correctSizes: ["P245/35ZR19", "P285/30ZR20", "P335/25ZR20"] },
  { year: 2017, make: "chevrolet", model: "corvette", correctSizes: ["P245/35ZR19", "P285/30ZR20", "P335/25ZR20"] },
  { year: 2018, make: "chevrolet", model: "corvette", correctSizes: ["P245/35ZR19", "P285/30ZR20", "P335/25ZR20"] },
  { year: 2019, make: "chevrolet", model: "corvette", correctSizes: ["P245/35ZR19", "P285/30ZR20", "P335/25ZR20"] },
];

async function fix() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: false });
  
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("         FIXING CROSS-GENERATION CONTAMINATION                  ");
  console.log("═══════════════════════════════════════════════════════════════\n");

  let totalFixed = 0;

  try {
    // First, find all contaminated records
    const { rows: contaminated } = await pool.query(`
      SELECT id, year, make, model, display_trim, oem_tire_sizes, source
      FROM vehicle_fitments
      WHERE source LIKE '%inherit%'
        AND oem_tire_sizes::text LIKE '%R15%'
        AND year >= 2010
      ORDER BY year, make, model
    `);

    console.log(`Found ${contaminated.length} contaminated records:\n`);

    for (const record of contaminated) {
      console.log(`${record.year} ${record.make} ${record.model} "${record.display_trim}"`);
      console.log(`  Current: ${(record.oem_tire_sizes || []).join(", ")}`);
      
      // Find the correct sizes for this vehicle
      const fix = FIXES.find(f => 
        f.year === record.year && 
        f.make === record.make && 
        f.model === record.model
      );
      
      if (fix) {
        await pool.query(`
          UPDATE vehicle_fitments 
          SET oem_tire_sizes = $1::jsonb,
              source = 'fix_cross_gen_contamination',
              updated_at = NOW()
          WHERE id = $2
        `, [JSON.stringify(fix.correctSizes), record.id]);
        
        console.log(`  Fixed → ${fix.correctSizes.join(", ")}`);
        totalFixed++;
      } else {
        console.log(`  ⚠️ No fix defined - needs manual review`);
      }
      console.log("");
    }

    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`SUMMARY: Fixed ${totalFixed}/${contaminated.length} records`);
    console.log("═══════════════════════════════════════════════════════════════");

  } finally {
    await pool.end();
  }
}

fix().catch(console.error);
