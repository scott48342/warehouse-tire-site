const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function find() {
  // Check tireweb cache
  const tireweb = await pool.query(
    `SELECT * FROM tireweb_sku_cache WHERE part_number = $1`,
    ['358060']
  );
  
  if (tireweb.rows.length > 0) {
    console.log('Found in tireweb_sku_cache:');
    console.log(JSON.stringify(tireweb.rows[0], null, 2));
  } else {
    console.log('Not found in tireweb_sku_cache');
  }
  
  // Check wp_tires (WheelPros tires)
  const wp = await pool.query(
    `SELECT * FROM wp_tires WHERE part_number = $1`,
    ['358060']
  );
  
  if (wp.rows.length > 0) {
    console.log('\nFound in wp_tires:');
    console.log(JSON.stringify(wp.rows[0], null, 2));
  } else {
    console.log('\nNot found in wp_tires');
  }
  
  await pool.end();
}

find().catch(console.error);
