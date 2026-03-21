import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  
  try {
    console.log('Clearing records with empty technical data...');
    
    // Delete fitments that have null bolt_pattern (imported with wrong endpoint)
    const fitResult = await client.query(`
      DELETE FROM vehicle_fitments 
      WHERE bolt_pattern IS NULL 
      RETURNING id, year, make, model, display_trim
    `);
    
    console.log(`Deleted ${fitResult.rowCount} fitment records with null bolt_pattern`);
    fitResult.rows.slice(0, 5).forEach(r => {
      console.log(`  - ${r.year} ${r.make} ${r.model} (${r.display_trim})`);
    });
    
    // Delete corresponding source records
    const srcResult = await client.query(`
      DELETE FROM fitment_source_records 
      WHERE id NOT IN (SELECT source_record_id FROM vehicle_fitments WHERE source_record_id IS NOT NULL)
      RETURNING id
    `);
    
    console.log(`Deleted ${srcResult.rowCount} orphaned source records`);
    
    console.log('\n✅ Cleanup complete. Records will be re-imported with correct API endpoint.');
    
  } finally {
    client.release();
    pool.end();
  }
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
