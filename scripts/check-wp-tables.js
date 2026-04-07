const pg = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function main() {
  // List all wp_ tables
  const tables = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE 'wp_%'
    ORDER BY table_name
  `);
  
  console.log(`\n=== wp_* tables ===`);
  tables.rows.forEach(r => console.log(`  ${r.table_name}`));
  
  // Check wp_inventory structure
  const cols = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'wp_inventory'
    ORDER BY ordinal_position
  `);
  
  console.log(`\n=== wp_inventory columns ===`);
  cols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`));
  
  // Check when inventory was last updated by product_type
  const lastUpdate = await pool.query(`
    SELECT product_type, COUNT(*) as cnt, MAX(updated_at) as last_update
    FROM wp_inventory
    GROUP BY product_type
  `);
  
  console.log(`\n=== wp_inventory by product_type ===`);
  lastUpdate.rows.forEach(r => {
    console.log(`  ${r.product_type}: ${r.cnt} rows, last updated: ${r.last_update}`);
  });
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
