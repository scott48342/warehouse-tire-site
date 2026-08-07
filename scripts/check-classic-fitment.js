require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  // Check what tables exist for classic fitment
  const { rows: tables } = await pool.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE '%classic%'
  `);
  console.log('Classic-related tables:', tables.map(t => t.table_name));

  // Check the classic_fitments table
  try {
    const { rows: sample } = await pool.query(`
      SELECT * FROM classic_fitments LIMIT 5
    `);
    console.log('\nSample classic_fitments:');
    sample.forEach(r => console.log(JSON.stringify(r, null, 2)));
  } catch (e) {
    console.log('No classic_fitments table found');
  }

  // Check if there's a platform mapping for GM G-body (Regal's platform)
  try {
    const { rows: platforms } = await pool.query(`
      SELECT * FROM classic_fitments 
      WHERE platform_code ILIKE '%gbody%' OR platform_code ILIKE '%g-body%' OR platform_code ILIKE '%regal%'
      LIMIT 5
    `);
    console.log('\nG-body platform fitments:', platforms);
  } catch (e) {
    console.log('Error querying classic fitments:', e.message);
  }

  await pool.end();
}

main().catch(e => { console.error(e); pool.end(); });
