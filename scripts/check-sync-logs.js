const pg = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

async function main() {
  // Check sync_logs table
  const logs = await pool.query(`
    SELECT sync_type, started_at, completed_at, status, records_processed, error_message
    FROM sync_logs 
    ORDER BY started_at DESC 
    LIMIT 15
  `);
  
  console.log(`\n=== Recent sync_logs ===`);
  logs.rows.forEach(row => {
    console.log(`${row.sync_type} | ${row.started_at} | ${row.status} | ${row.records_processed} records`);
    if (row.error_message) console.log(`  ERROR: ${row.error_message}`);
  });
  
  // Check for inventory-specific syncs
  const invLogs = await pool.query(`
    SELECT sync_type, started_at, status, records_processed
    FROM sync_logs 
    WHERE sync_type ILIKE '%inventory%' OR sync_type ILIKE '%sftp%'
    ORDER BY started_at DESC 
    LIMIT 5
  `);
  
  console.log(`\n=== Inventory-related syncs ===`);
  if (invLogs.rows.length === 0) {
    console.log('No inventory sync logs found');
  } else {
    invLogs.rows.forEach(row => {
      console.log(`${row.sync_type} | ${row.started_at} | ${row.status} | ${row.records_processed}`);
    });
  }
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
