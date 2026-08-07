require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  // Check if wsi_wheels table exists and has data
  try {
    const { rows: count } = await pool.query(`SELECT COUNT(*) as cnt FROM wsi_wheels`);
    console.log(`wsi_wheels table: ${count[0].cnt} rows`);
    
    // Check for 5x120.65 wheels
    const { rows: gbody } = await pool.query(`
      SELECT diameter, COUNT(*) as cnt
      FROM wsi_wheels
      WHERE bp1 LIKE '%120.65%' OR bp1 LIKE '%4.75%'
      GROUP BY diameter
      ORDER BY diameter::numeric
    `);
    console.log('\n5x120.65 wheels in wsi_wheels by diameter:');
    gbody.forEach(r => console.log(`  ${r.diameter}": ${r.cnt}`));
    
    // Check total with stock
    const { rows: inStock } = await pool.query(`
      SELECT diameter, COUNT(*) as cnt
      FROM wsi_wheels
      WHERE (bp1 LIKE '%120.65%' OR bp1 LIKE '%4.75%')
        AND total_qty > 0
      GROUP BY diameter
      ORDER BY diameter::numeric
    `);
    console.log('\n5x120.65 wheels IN STOCK by diameter:');
    inStock.forEach(r => console.log(`  ${r.diameter}": ${r.cnt}`));
    
  } catch (e) {
    if (e.code === '42P01') {
      console.log('wsi_wheels table does not exist!');
    } else {
      throw e;
    }
  }
  
  await pool.end();
}
check();
