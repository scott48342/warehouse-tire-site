import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  // Check vehicles table (legacy)
  const vehicles = await pool.query(`
    SELECT id, year, make, model, trim, slug 
    FROM vehicles 
    WHERE make ILIKE 'bmw' AND model ILIKE '%3%' AND year = 2007
  `);
  console.log('Legacy vehicles table (2007 BMW):');
  console.log(JSON.stringify(vehicles.rows, null, 2));
  console.log('Count:', vehicles.rows.length);
  
  // Check vehicle_fitments table (new)
  const fitments = await pool.query(`
    SELECT id, year, make, model, display_trim, modification_id
    FROM vehicle_fitments 
    WHERE make ILIKE 'bmw' AND model ILIKE '%3%' AND year = 2007
  `);
  console.log('\nvehicle_fitments table (2007 BMW):');
  console.log(JSON.stringify(fitments.rows, null, 2));
  console.log('Count:', fitments.rows.length);
  
  await pool.end();
}

check().catch(e => { console.error(e); process.exit(1); });
