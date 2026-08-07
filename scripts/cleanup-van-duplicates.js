require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  const dryRun = process.argv.includes('--dry-run');
  
  try {
    console.log(dryRun ? '=== DRY RUN ===' : '=== CLEANING UP DUPLICATES ===\n');
    
    // Delete lowercase/hyphenated duplicates where proper case exists
    const duplicates = [
      { make: 'Chevrolet', bad: 'express-3500', good: 'Express 3500' },
      { make: 'Dodge', bad: 'grand-caravan', good: 'Grand Caravan' },
      { make: 'Ford', bad: 'e-150-econoline', good: 'E-150' },
      { make: 'Ford', bad: 'e-250-econoline', good: 'E-250 Econoline' },
      { make: 'Ford', bad: 'e-350-econoline', good: 'E-350 Econoline' },
      { make: 'Lincoln', bad: 'town-car', good: 'Town Car' },
    ];
    
    for (const dup of duplicates) {
      const count = await client.query(`
        SELECT COUNT(*) as cnt FROM vehicle_fitments WHERE make = $1 AND model = $2
      `, [dup.make, dup.bad]);
      
      if (parseInt(count.rows[0].cnt) > 0) {
        console.log(`Deleting ${count.rows[0].cnt} "${dup.make} ${dup.bad}" records (keeping "${dup.good}")`);
        if (!dryRun) {
          await client.query(`DELETE FROM vehicle_fitments WHERE make = $1 AND model = $2`, [dup.make, dup.bad]);
          console.log('  ✅ Deleted');
        }
      }
    }
    
    // Get final count
    const total = await client.query(`
      SELECT COUNT(*) as cnt FROM vehicle_fitments 
      WHERE make IN ('Ford', 'Chevrolet', 'Dodge', 'RAM', 'GMC', 'Jeep', 'Cadillac', 'Lincoln', 'Buick', 'Chrysler')
        AND year >= 2000 AND year <= 2026
    `);
    console.log(`\nTotal domestic records (2000-2026): ${total.rows[0].cnt}`);
    
  } finally {
    client.release();
    await pool.end();
  }
}
main();
