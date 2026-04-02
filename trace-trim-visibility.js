/**
 * Trace Tier A Trim Visibility End-to-End
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const tierAVehicles = [
  { year: 2020, make: 'ford', model: 'mustang' },
  { year: 2020, make: 'chevrolet', model: 'camaro' },
  { year: 2020, make: 'dodge', model: 'challenger' },
  { year: 2020, make: 'dodge', model: 'charger' },
];

async function main() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('='.repeat(80));
  console.log('TIER A TRIM VISIBILITY TRACE');
  console.log('='.repeat(80));

  for (const v of tierAVehicles) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`${v.year} ${v.make.toUpperCase()} ${v.model.toUpperCase()}`);
    console.log(`${'─'.repeat(80)}`);

    // 1. What's in vehicle_fitments?
    console.log('\n1️⃣ DATABASE (vehicle_fitments):');
    const dbRes = await pool.query(`
      SELECT 
        modification_id,
        display_trim,
        raw_trim,
        bolt_pattern,
        source,
        jsonb_array_length(oem_wheel_sizes) as wheels
      FROM vehicle_fitments
      WHERE year = $1 AND make = $2 AND model = $3
      ORDER BY display_trim
    `, [v.year, v.make, v.model]);
    
    if (dbRes.rows.length === 0) {
      console.log('   ❌ NO RECORDS FOUND');
    } else {
      console.log(`   Found ${dbRes.rows.length} trim records:`);
      for (const r of dbRes.rows) {
        console.log(`   • ${r.display_trim} (mod_id: ${r.modification_id?.substring(0,20)}..., ${r.wheels} wheels, ${r.source})`);
      }
    }

    // 2. What does the trims API return? (simulate the query)
    console.log('\n2️⃣ TRIMS API QUERY (what /api/vehicles/trims would return):');
    const trimsRes = await pool.query(`
      SELECT DISTINCT display_trim as trim, modification_id
      FROM vehicle_fitments
      WHERE year = $1 AND make = $2 AND model = $3
      ORDER BY display_trim
    `, [v.year, v.make, v.model]);
    
    if (trimsRes.rows.length === 0) {
      console.log('   ❌ NO TRIMS');
    } else {
      console.log(`   Returns ${trimsRes.rows.length} trims:`);
      for (const r of trimsRes.rows) {
        console.log(`   • "${r.trim}" (mod: ${r.modification_id?.substring(0,25)}...)`);
      }
    }

    // 3. Check if there's a "Base" that might be catching all
    const baseCheck = await pool.query(`
      SELECT display_trim, modification_id, source
      FROM vehicle_fitments
      WHERE year = $1 AND make = $2 AND model = $3
        AND (display_trim = 'Base' OR display_trim IS NULL OR display_trim = '')
    `, [v.year, v.make, v.model]);
    
    if (baseCheck.rows.length > 0) {
      console.log('\n   ⚠️ HAS "Base" RECORD:');
      for (const r of baseCheck.rows) {
        console.log(`      mod_id: ${r.modification_id}, source: ${r.source}`);
      }
    }
  }

  // 4. Check the trims API route logic
  console.log('\n\n' + '='.repeat(80));
  console.log('TRIMS API ROUTE ANALYSIS');
  console.log('='.repeat(80));
  
  // Read the trims route file
  const fs = require('fs');
  const trimsRoutePath = './src/app/api/vehicles/trims/route.ts';
  
  if (fs.existsSync(trimsRoutePath)) {
    const content = fs.readFileSync(trimsRoutePath, 'utf8');
    
    // Check for DISTINCT queries
    const hasDistinct = content.includes('DISTINCT');
    const hasGroupBy = content.includes('GROUP BY');
    const usesDisplayTrim = content.includes('display_trim');
    const usesRawTrim = content.includes('raw_trim');
    
    console.log('\nTrims route file analysis:');
    console.log(`   Uses DISTINCT: ${hasDistinct}`);
    console.log(`   Uses GROUP BY: ${hasGroupBy}`);
    console.log(`   Uses display_trim: ${usesDisplayTrim}`);
    console.log(`   Uses raw_trim: ${usesRawTrim}`);
    
    // Find the main SELECT query
    const selectMatch = content.match(/SELECT[\s\S]*?FROM\s+vehicle_fitments/i);
    if (selectMatch) {
      console.log('\n   Main query pattern:');
      console.log(`   ${selectMatch[0].substring(0, 200)}...`);
    }
  } else {
    console.log('   Trims route file not found at expected path');
  }

  await pool.end();
}

main().catch(console.error);
