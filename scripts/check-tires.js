require('dotenv').config({ path: '.env.local' });
const pg = require('pg');

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  // Check what the actual simple_size looks like for 195/60R15
  const result = await pool.query(
    `SELECT sku, tire_size, simple_size FROM wp_tires WHERE tire_size ILIKE '%195/60%15%' OR tire_size ILIKE '%195/60R15%' LIMIT 10`
  );
  console.log('195/60R15 tires in WheelPros:');
  for (const row of result.rows) {
    console.log(`  SKU: ${row.sku}, size: ${row.tire_size}, simple: ${row.simple_size}`);
  }
  
  // Check inventory for these SKUs
  if (result.rows.length > 0) {
    const skus = result.rows.map(r => r.sku);
    const invResult = await pool.query(
      `SELECT sku, qoh FROM wp_inventory WHERE sku = ANY($1) AND location_id = 'TOTAL'`,
      [skus]
    );
    console.log('\nInventory:');
    for (const row of invResult.rows) {
      console.log(`  SKU: ${row.sku}, QOH: ${row.qoh}`);
    }
  }
  
  await pool.end();
}

check().catch(e => { console.error(e); process.exit(1); });
