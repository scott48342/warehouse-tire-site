/**
 * Check vehicle config coverage gaps
 */
const { Pool } = require('pg');
const pool = new Pool({connectionString: process.env.POSTGRES_URL});

async function main() {
  // Get current config coverage
  const configCount = await pool.query('SELECT COUNT(DISTINCT (year, make_key, model_key)) as count FROM vehicle_fitment_configurations');
  console.log('Current config coverage:', configCount.rows[0].count);
  
  // Get total vehicles in fitments table
  const fitmentCount = await pool.query('SELECT COUNT(DISTINCT (year, make, model)) as count FROM vehicle_fitments WHERE year >= 2015');
  console.log('Total vehicles (2015+):', fitmentCount.rows[0].count);
  
  // Find vehicles without configs
  const missing = await pool.query(`
    SELECT vf.year, vf.make, vf.model, COUNT(DISTINCT vf.modification_id) as trim_count
    FROM vehicle_fitments vf
    WHERE vf.year >= 2015
      AND NOT EXISTS (
        SELECT 1 FROM vehicle_fitment_configurations vfc
        WHERE vfc.year = vf.year
          AND vfc.make_key = LOWER(REPLACE(vf.make, ' ', '-'))
          AND vfc.model_key = LOWER(REPLACE(REPLACE(vf.model, ' ', '-'), '/', '-'))
      )
    GROUP BY vf.year, vf.make, vf.model
    ORDER BY vf.make, vf.model, vf.year
  `);
  
  console.log('\nVehicles without configs:', missing.rows.length);
  console.log('\nSample (first 50):');
  missing.rows.slice(0, 50).forEach(r => {
    console.log('  ' + r.year + ' ' + r.make + ' ' + r.model + ' (' + r.trim_count + ' trims)');
  });
  
  // Group by make for summary
  const byMake = {};
  missing.rows.forEach(r => {
    byMake[r.make] = (byMake[r.make] || 0) + 1;
  });
  
  console.log('\nBy Make:');
  Object.entries(byMake).sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([make, count]) => {
    console.log('  ' + make + ': ' + count + ' vehicles');
  });
  
  await pool.end();
}

main().catch(console.error);
