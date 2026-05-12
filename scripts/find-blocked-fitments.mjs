/**
 * Find all vehicles in vehicle_fitments that are BLOCKED because
 * they don't exist in the legacy vehicles table
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function analyze() {
  // Count records in each table
  const vfCount = await pool.query(`SELECT COUNT(*) FROM vehicle_fitments WHERE certification_status = 'certified'`);
  const legacyCount = await pool.query(`SELECT COUNT(*) FROM vehicles`);
  
  console.log('=== TABLE COUNTS ===');
  console.log(`vehicle_fitments (certified): ${vfCount.rows[0].count}`);
  console.log(`vehicles (legacy): ${legacyCount.rows[0].count}`);

  // Find YMM combinations in vehicle_fitments that don't exist in vehicles
  const missing = await pool.query(`
    SELECT DISTINCT vf.year, vf.make, vf.model, COUNT(DISTINCT vf.display_trim) as trim_count
    FROM vehicle_fitments vf
    WHERE vf.certification_status = 'certified'
    AND NOT EXISTS (
      SELECT 1 FROM vehicles v
      WHERE v.year = vf.year
      AND LOWER(v.make) = LOWER(vf.make)
      AND (
        LOWER(v.model) = LOWER(vf.model)
        OR LOWER(REPLACE(v.model, '-', ' ')) = LOWER(REPLACE(vf.model, '-', ' '))
      )
    )
    GROUP BY vf.year, vf.make, vf.model
    ORDER BY vf.make, vf.model, vf.year
  `);

  console.log('\n=== BLOCKED VEHICLES (in vehicle_fitments but NOT in legacy vehicles) ===');
  console.log(`Total YMM combinations blocked: ${missing.rows.length}`);
  
  // Group by make for summary
  const byMake = {};
  for (const row of missing.rows) {
    if (!byMake[row.make]) byMake[row.make] = [];
    byMake[row.make].push(row);
  }

  console.log('\n--- By Make ---');
  for (const [make, rows] of Object.entries(byMake).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`${make}: ${rows.length} models blocked`);
  }

  console.log('\n--- Full List (first 100) ---');
  missing.rows.slice(0, 100).forEach(row => {
    console.log(`  ${row.year} ${row.make} ${row.model} (${row.trim_count} trims)`);
  });

  if (missing.rows.length > 100) {
    console.log(`  ... and ${missing.rows.length - 100} more`);
  }

  // Sample some popular vehicles to highlight
  console.log('\n--- Notable Blocked Vehicles ---');
  const notable = missing.rows.filter(r => 
    ['Camry', 'Accord', 'Civic', 'F-150', 'Silverado', 'RAV4', 'CR-V', 'Mustang', 'Corvette', 'Model 3', 'Model Y'].some(m => 
      r.model.toLowerCase().includes(m.toLowerCase())
    )
  );
  notable.forEach(row => {
    console.log(`  ⚠️  ${row.year} ${row.make} ${row.model} (${row.trim_count} trims)`);
  });

  await pool.end();
}

analyze().catch(e => { console.error(e); process.exit(1); });
