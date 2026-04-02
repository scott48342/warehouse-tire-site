const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  console.log('=== CHECKING POTENTIAL OVERLAPS ===\n');
  
  // Check RAM brand vs Dodge Ram
  console.log('--- RAM BRAND ---');
  const ramModels = await pool.query(`
    SELECT model, MIN(year) as min_yr, MAX(year) as max_yr, COUNT(*) as cnt
    FROM vehicle_fitments WHERE make = 'ram'
    GROUP BY model ORDER BY model
  `);
  ramModels.rows.forEach(r => console.log(`  ram ${r.model}: ${r.min_yr}-${r.max_yr} (${r.cnt})`));
  
  console.log('\n--- DODGE RAM ---');
  const dodgeRam = await pool.query(`
    SELECT model, MIN(year) as min_yr, MAX(year) as max_yr, COUNT(*) as cnt
    FROM vehicle_fitments WHERE make = 'dodge' AND model LIKE '%ram%' OR (make = 'dodge' AND model IN ('1500', '2500', '3500'))
    GROUP BY model ORDER BY model
  `);
  dodgeRam.rows.forEach(r => console.log(`  dodge ${r.model}: ${r.min_yr}-${r.max_yr} (${r.cnt})`));
  
  // Check Silverado HD variants
  console.log('\n--- CHEVY HD VARIANTS ---');
  const chevyHd = await pool.query(`
    SELECT model, MIN(year) as min_yr, MAX(year) as max_yr, COUNT(*) as cnt
    FROM vehicle_fitments WHERE make = 'chevrolet' AND model LIKE '%silverado%hd%'
    GROUP BY model ORDER BY model
  `);
  chevyHd.rows.forEach(r => console.log(`  ${r.model}: ${r.min_yr}-${r.max_yr} (${r.cnt})`));
  
  // Check GMC HD variants
  console.log('\n--- GMC HD VARIANTS ---');
  const gmcHd = await pool.query(`
    SELECT model, MIN(year) as min_yr, MAX(year) as max_yr, COUNT(*) as cnt
    FROM vehicle_fitments WHERE make = 'gmc' AND model LIKE '%sierra%hd%'
    GROUP BY model ORDER BY model
  `);
  gmcHd.rows.forEach(r => console.log(`  ${r.model}: ${r.min_yr}-${r.max_yr} (${r.cnt})`));
  
  // Check Ford Super Duty
  console.log('\n--- FORD F-250/F-350 ---');
  const fordHd = await pool.query(`
    SELECT model, MIN(year) as min_yr, MAX(year) as max_yr, COUNT(*) as cnt
    FROM vehicle_fitments WHERE make = 'ford' AND (model LIKE 'f-250%' OR model LIKE 'f-350%')
    GROUP BY model ORDER BY model
  `);
  fordHd.rows.forEach(r => console.log(`  ${r.model}: ${r.min_yr}-${r.max_yr} (${r.cnt})`));
  
  await pool.end();
}

check();
