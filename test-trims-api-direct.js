/**
 * Test the trims API directly by calling getTrimsWithCoverage
 */

// Mock the drizzle db connection
process.env.POSTGRES_URL = process.env.POSTGRES_URL || require('dotenv').config({ path: '.env.local' }).parsed?.POSTGRES_URL;

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const tierAVehicles = [
  { year: 2020, make: 'Ford', model: 'Mustang' },
  { year: 2020, make: 'ford', model: 'mustang' },  // lowercase
  { year: 2020, make: 'Chevrolet', model: 'Camaro' },
  { year: 2020, make: 'chevrolet', model: 'camaro' },  // lowercase
  { year: 2020, make: 'Dodge', model: 'Challenger' },
  { year: 2020, make: 'dodge', model: 'challenger' },  // lowercase
];

async function main() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('='.repeat(80));
  console.log('TESTING TRIMS API QUERY DIRECTLY');
  console.log('='.repeat(80));

  for (const v of tierAVehicles) {
    console.log(`\n${v.year} ${v.make} ${v.model}:`);
    
    // Simulate the normalization that happens in the API
    const normalizedMake = v.make.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    const normalizedModel = v.model.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    console.log(`   Normalized: ${normalizedMake} / ${normalizedModel}`);
    
    // Query using the exact same pattern as the coverage function
    const result = await pool.query(`
      SELECT DISTINCT modification_id, display_trim
      FROM vehicle_fitments
      WHERE year = $1 AND make = $2 AND model = $3
      ORDER BY display_trim
    `, [v.year, normalizedMake, normalizedModel]);
    
    if (result.rows.length === 0) {
      console.log(`   ❌ NO RESULTS`);
    } else {
      console.log(`   Found ${result.rows.length} trims:`);
      for (const r of result.rows) {
        console.log(`   • ${r.display_trim}`);
      }
    }
  }

  // Also test what would happen with a live HTTP request
  console.log('\n\n' + '='.repeat(80));
  console.log('CHECKING MODEL ALIAS BEHAVIOR');
  console.log('='.repeat(80));
  
  // Check if there are any model aliases that might affect this
  const aliasCheck = await pool.query(`
    SELECT DISTINCT make, model
    FROM vehicle_fitments
    WHERE (make = 'ford' AND model LIKE '%mustang%')
       OR (make = 'chevrolet' AND model LIKE '%camaro%')
       OR (make = 'dodge' AND model LIKE '%challenger%')
       OR (make = 'dodge' AND model LIKE '%charger%')
    ORDER BY make, model
  `);
  
  console.log('\nModel name patterns in database:');
  for (const r of aliasCheck.rows) {
    console.log(`   ${r.make}: "${r.model}"`);
  }

  await pool.end();
}

main().catch(console.error);
