/**
 * Check wheel tables schema
 */
const pg = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function main() {
  console.log('=== wp_wheels columns ===');
  const cols = await pool.query(`
    SELECT column_name, data_type
    FROM information_schema.columns 
    WHERE table_name = 'wp_wheels'
    ORDER BY ordinal_position
  `);
  cols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}`));
  
  // Sample a wheel
  console.log('\n=== Sample wheel data ===');
  const sample = await pool.query(`SELECT * FROM wp_wheels LIMIT 1`);
  console.log(JSON.stringify(sample.rows[0], null, 2));
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
