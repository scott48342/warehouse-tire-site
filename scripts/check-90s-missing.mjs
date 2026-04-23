import pg from 'pg';
import { config } from 'dotenv';
config({ path: '.env.local' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function check() {
  const client = await pool.connect();
  try {
    // Makes with 90s coverage
    const makes = await client.query(`
      SELECT make, COUNT(DISTINCT model) as models, COUNT(*) as total_records
      FROM vehicle_fitments
      WHERE year >= 1990 AND year < 2000
      GROUP BY make
      ORDER BY total_records DESC
    `);
    
    console.log('Makes with 90s coverage:');
    makes.rows.forEach(row => {
      console.log(`  ${row.make}: ${row.models} models (${row.total_records} records)`);
    });
    
    // Check what's MISSING
    const found = new Set(makes.rows.map(r => r.make.toLowerCase()));
    const expected = ['honda', 'nissan', 'subaru', 'mazda', 'volkswagen', 'acura', 'infiniti', 
                      'hyundai', 'kia', 'volvo', 'saturn', 'oldsmobile', 'plymouth', 'buick', 
                      'cadillac', 'lincoln', 'geo', 'isuzu', 'suzuki', 'saab', 'chrysler'];
    const missing = expected.filter(m => !found.has(m));
    
    console.log('\nMajor makes MISSING from 90s data:');
    console.log('  ' + (missing.length ? missing.join(', ') : '(none)'));
    
    // Estimate: how many YMMs would a full 90s catalog have?
    // Using 2000-2005 as proxy (similar vehicle counts, pre-SUV boom)
    const proxy = await client.query(`
      SELECT COUNT(DISTINCT year::text || make || model) as ymm_count
      FROM vehicle_fitments
      WHERE year >= 2000 AND year <= 2005
    `);
    
    console.log('\n--- EFFORT ESTIMATE ---');
    console.log(`YMM combos in 2000-2005 (proxy): ${proxy.rows[0]?.ymm_count}`);
    console.log(`YMM combos we have for 90s: 717`);
    console.log(`Estimated missing: ~${Math.round(proxy.rows[0]?.ymm_count * 10/6 - 717)} YMMs`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
