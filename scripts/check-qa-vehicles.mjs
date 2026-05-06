import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL });

async function check() {
  console.log('=== Staggered QA Test Vehicles ===');
  const r = await pool.query(`
    SELECT year, make, model, trim, category, is_canary, is_performance 
    FROM qa_test_vehicles 
    WHERE category = 'staggered' 
    ORDER BY make, model, trim
  `);
  console.table(r.rows);
  
  await pool.end();
}

check().catch(e => { console.error(e); process.exit(1); });
