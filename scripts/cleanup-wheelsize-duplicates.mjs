import pg from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

// Makes to clean
const MAKES = ['bmw', 'mercedes', 'audi', 'buick', 'cadillac', 'chevrolet', 'ford', 'dodge', 'kia', 'lexus', 'genesis', 'hyundai', 'chrysler', 'jeep', 'toyota', 'mazda', 'volkswagen'];

async function main() {
  const client = await pool.connect();
  
  try {
    console.log('=== WHEELSIZE DUPLICATE CLEANUP ===\n');
    
    for (const make of MAKES) {
      // Check records
      const before = await client.query(`
        SELECT source, COUNT(*) as count, COUNT(bolt_pattern) as with_bolt 
        FROM vehicle_fitments 
        WHERE make = $1 
        GROUP BY source
      `, [make]);
      
      const hasWheelsize = before.rows.find(r => r.source === 'wheelsize');
      const hasComplete = before.rows.find(r => r.source !== 'wheelsize' && r.with_bolt > 0);
      
      if (!hasWheelsize) continue;
      
      // Only delete wheelsize if we have complete records from another source
      if (hasComplete) {
        const result = await client.query(`
          DELETE FROM vehicle_fitments 
          WHERE make = $1 AND source = 'wheelsize' AND bolt_pattern IS NULL
          RETURNING id
        `, [make]);
        
        if (result.rowCount > 0) {
          console.log(`${make.toUpperCase()}: Deleted ${result.rowCount} incomplete wheelsize records`);
        }
      } else {
        console.log(`${make.toUpperCase()}: Skipped - no complete records to keep`);
      }
    }
    
    console.log('\n✅ Cleanup complete');
    
  } finally {
    client.release();
    pool.end();
  }
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
