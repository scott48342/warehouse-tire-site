import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log('=== AUDIT: "BASE" TRIMS (2000-2026) ===\n');

  // Find records where display_trim is just "Base" or similar generic names
  const baseTrims = await pool.query(`
    SELECT year, make, model, display_trim, COUNT(*) as cnt
    FROM vehicle_fitments 
    WHERE year >= 2000 
      AND LOWER(display_trim) IN ('base', 'standard', 'default', '')
    GROUP BY year, make, model, display_trim
    ORDER BY make, model, year
  `);

  if (baseTrims.rows.length === 0) {
    console.log('✅ NO GENERIC "BASE" TRIMS FOUND');
    console.log('   All records have specific trim/submodel names.\n');
  } else {
    console.log(`❌ FOUND ${baseTrims.rows.length} RECORDS WITH GENERIC "BASE" TRIM:\n`);
    
    let currentMake = '';
    for (const r of baseTrims.rows) {
      if (r.make !== currentMake) {
        currentMake = r.make;
        console.log(`\n${r.make}:`);
      }
      console.log(`  ${r.year} ${r.model} [${r.display_trim || '(empty)'}] - ${r.cnt} record(s)`);
    }
  }

  // Check trim diversity - show makes/models that have only 1 trim
  console.log('\n\n=== TRIM DIVERSITY CHECK ===');
  console.log('Models with only 1 trim level (potential issues):\n');
  
  const singleTrim = await pool.query(`
    SELECT make, model, year, COUNT(DISTINCT display_trim) as trim_count, 
           STRING_AGG(DISTINCT display_trim, ', ') as trims
    FROM vehicle_fitments 
    WHERE year >= 2000
    GROUP BY make, model, year
    HAVING COUNT(DISTINCT display_trim) = 1
    ORDER BY make, model, year DESC
    LIMIT 50
  `);

  if (singleTrim.rows.length === 0) {
    console.log('✅ All models have multiple trim levels defined.');
  } else {
    let count = 0;
    for (const r of singleTrim.rows) {
      // Skip if the single trim is a valid specific trim (not Base)
      if (!['Base', 'Standard', ''].includes(r.trims)) continue;
      console.log(`  ${r.year} ${r.make} ${r.model}: "${r.trims}"`);
      count++;
    }
    if (count === 0) {
      console.log('✅ Single-trim models all have specific trim names (not "Base").');
    } else {
      console.log(`\n⚠️ ${count} year/model combos have only generic "Base" trim.`);
    }
  }

  // Show trim distribution for recent years
  console.log('\n\n=== TRIM COVERAGE (2024-2026) ===');
  const recentTrims = await pool.query(`
    SELECT year, COUNT(*) as records, COUNT(DISTINCT make || model || display_trim) as unique_trims
    FROM vehicle_fitments 
    WHERE year >= 2024
    GROUP BY year
    ORDER BY year
  `);

  for (const r of recentTrims.rows) {
    console.log(`  ${r.year}: ${r.records} records across ${r.unique_trims} unique Y/M/M/Trim combos`);
  }

  // Sample of trims to verify quality
  console.log('\n\n=== SAMPLE TRIM NAMES (2024) ===');
  const sample = await pool.query(`
    SELECT DISTINCT make, model, display_trim
    FROM vehicle_fitments 
    WHERE year = 2024
    ORDER BY make, model, display_trim
    LIMIT 40
  `);

  let lastMakeModel = '';
  for (const r of sample.rows) {
    const key = `${r.make} ${r.model}`;
    if (key !== lastMakeModel) {
      console.log(`\n${key}:`);
      lastMakeModel = key;
    }
    console.log(`  - ${r.display_trim}`);
  }

  await pool.end();
}

main();
