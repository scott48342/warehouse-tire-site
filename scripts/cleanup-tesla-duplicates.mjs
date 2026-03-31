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
    console.log('=== TESLA DUPLICATE CLEANUP ===\n');
    
    // First, check current state
    const before = await client.query(`
      SELECT source, COUNT(*) as count 
      FROM vehicle_fitments 
      WHERE make = 'tesla' 
      GROUP BY source
    `);
    
    console.log('Current Tesla records by source:');
    before.rows.forEach(r => console.log(`  ${r.source}: ${r.count}`));
    
    // Delete Tesla records from wheelsize (duplicates of our generation imports)
    const result = await client.query(`
      DELETE FROM vehicle_fitments 
      WHERE make = 'tesla' 
        AND source = 'wheelsize'
      RETURNING id, year, model, display_trim
    `);
    
    console.log(`\nDeleted ${result.rowCount} wheelsize records:`);
    result.rows.slice(0, 10).forEach(r => {
      console.log(`  - ${r.year} ${r.model} (${r.display_trim})`);
    });
    if (result.rowCount > 10) {
      console.log(`  ... and ${result.rowCount - 10} more`);
    }
    
    // Check final state
    const after = await client.query(`
      SELECT source, COUNT(*) as count, 
             COUNT(bolt_pattern) as with_bolt_pattern
      FROM vehicle_fitments 
      WHERE make = 'tesla' 
      GROUP BY source
    `);
    
    console.log('\nAfter cleanup:');
    after.rows.forEach(r => console.log(`  ${r.source}: ${r.count} records (${r.with_bolt_pattern} with bolt pattern)`));
    
    console.log('\n✅ Tesla cleanup complete');
    
  } finally {
    client.release();
    pool.end();
  }
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
