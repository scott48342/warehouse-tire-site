const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function check() {
  try {
    // Count total
    const countRes = await pool.query('SELECT COUNT(*) as cnt FROM vehicle_fitments');
    console.log('Total vehicle_fitments:', countRes.rows[0].cnt);

    // Check Ford specifically
    const fordRes = await pool.query(
      "SELECT year, make, model, modification_id, bolt_pattern FROM vehicle_fitments WHERE LOWER(make) = 'ford' LIMIT 10"
    );
    console.log('\nFord vehicles in DB:', fordRes.rows.length);
    fordRes.rows.forEach(row => console.log(JSON.stringify(row)));

    // Check what makes exist
    const makesRes = await pool.query(
      "SELECT DISTINCT make, COUNT(*) as cnt FROM vehicle_fitments GROUP BY make ORDER BY cnt DESC LIMIT 10"
    );
    console.log('\nTop makes in DB:');
    makesRes.rows.forEach(row => console.log(`  ${row.make}: ${row.cnt}`));

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

check();
