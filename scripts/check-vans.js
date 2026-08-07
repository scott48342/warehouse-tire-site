require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const r = await pool.query(`
    SELECT make, model, COUNT(*) as cnt, MIN(year) as min_y, MAX(year) as max_y 
    FROM vehicle_fitments 
    WHERE (make = 'Chevrolet' AND model ILIKE '%express%') 
       OR (make = 'GMC' AND model ILIKE '%savana%')
       OR (make = 'Dodge' AND model ILIKE '%caravan%')
       OR (make = 'Lincoln' AND model ILIKE '%town%')
       OR (make = 'Ford' AND model ILIKE 'E-%')
       OR (make = 'Jeep' AND model ILIKE '%patriot%')
    GROUP BY make, model ORDER BY make, model
  `);
  console.log('Van/Added Vehicle Records:\n');
  r.rows.forEach(row => console.log(`  ${row.make} ${row.model}: ${row.min_y}-${row.max_y} (${row.cnt} records)`));
  
  // Total domestic
  const total = await pool.query(`
    SELECT COUNT(*) as cnt FROM vehicle_fitments 
    WHERE make IN ('Ford', 'Chevrolet', 'Dodge', 'RAM', 'GMC', 'Jeep', 'Cadillac', 'Lincoln', 'Buick', 'Chrysler')
      AND year >= 2000 AND year <= 2026
  `);
  console.log(`\nTotal domestic records (2000-2026): ${total.rows[0].cnt}`);
  
  await pool.end();
}
main();
