import pg from 'pg';
import fs from 'fs';

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

try {
  const sql = fs.readFileSync('scripts/migrations/0032_qa_fix_types.sql', 'utf8');
  await pool.query(sql);
  console.log('Migration 0032 applied successfully');
  
  const result = await pool.query(`
    SELECT year, make, model, trim, expected_staggered 
    FROM qa_canary_vehicles 
    WHERE category = 'staggered'
  `);
  
  console.log('\nStaggered canary vehicles:');
  for (const v of result.rows) {
    console.log(`  ${v.year} ${v.make} ${v.model} ${v.trim || ''} -> staggered=${v.expected_staggered}`);
  }
} catch (err) {
  console.error('Error:', err.message);
} finally {
  await pool.end();
}
