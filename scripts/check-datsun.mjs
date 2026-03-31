import pg from 'pg';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const dbMatch = envContent.match(/DATABASE_URL=(.+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

try {
  // Check for datsun/nissan
  const r = await pool.query(`
    SELECT DISTINCT make FROM vehicle_fitments 
    WHERE make ILIKE '%datsun%' OR make ILIKE '%nissan%'
  `);
  console.log('Makes found:', r.rows);

  // Check what QA tested
  const r2 = await pool.query(`
    SELECT year, make, model FROM vehicle_fitments 
    WHERE make ILIKE '%datsun%'
    ORDER BY year
  `);
  console.log('Datsun in DB:', r2.rowCount);
  for (const row of r2.rows) {
    console.log(`  ${row.year} ${row.make} ${row.model}`);
  }

} finally {
  await pool.end();
}
